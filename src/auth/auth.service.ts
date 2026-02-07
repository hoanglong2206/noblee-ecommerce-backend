import { db } from "../database";
import { eq } from "drizzle-orm";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";
import { config } from "../config";
import { verifyToken } from "../shared/middleware/auth.middleware";
import {
	auth as authTable,
	Auth,
	refreshTokens,
	RefreshToken,
	sessions,
	Session,
} from "./auth.model";
import {
	sendOtpDTO,
	verifyOtpDTO,
	registerDTO,
	loginDTO,
	refreshTokenDTO,
} from "./auth.interface";
import { mailer } from "../shared/helpers/mailer";
import { publishDirectMessage } from "../shared/queues/publisher";
import { authConnection } from "./auth.connection";
import { UserRegisteredMessage } from "../user/user.interface";
import {
	storeOtpHash,
	getOtpHash,
	clearOtpHash,
	deleteOtpData,
	incrementOtpRequestCount,
	incrementOtpVerificationAttempts,
	clearOtpVerificationAttempts,
	markOtpVerified,
	isOtpVerified,
	clearOtpVerified,
} from "../shared/redis/otp.store";

type ServiceError = Error & { statusCode?: number };

type AuthTokens = {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresIn: string;
	refreshTokenExpiresIn: string;
};

type PublicAuthRecord = Omit<Auth, "passwordHash">;

type AuthResponse = {
	user: PublicAuthRecord;
	tokens: AuthTokens;
};

type RefreshTokenPayload = JwtPayload & {
	sub?: string;
	jti?: string;
};

type SessionContext = {
	ipAddress?: string;
	userAgent?: string;
};

class AuthService {
	private readonly saltRounds = 10;

	public async sendOtp(payload: sendOtpDTO): Promise<{ expiresIn: number }> {
		const email = this.normalizeEmail(payload.email);
		await this.ensureEmailNotRegistered(email);
		await this.rateLimitOtpRequests(email);
		await clearOtpHash(email);
		await clearOtpVerificationAttempts(email);
		await clearOtpVerified(email);
		const otp = this.generateOtp();
		const hashedOtp = await bcrypt.hash(otp, this.saltRounds);
		const expireSeconds = this.getOtpExpirySeconds();
		await storeOtpHash(email, hashedOtp, expireSeconds);
		await mailer.sendOtp(email, otp);
		return { expiresIn: expireSeconds };
	}

	public async resendOtp(payload: sendOtpDTO): Promise<{ expiresIn: number }> {
		return this.sendOtp(payload);
	}

	public async verifyOtp(
		payload: verifyOtpDTO,
	): Promise<{ verified: boolean }> {
		const email = this.normalizeEmail(payload.email);
		const hashed = await getOtpHash(email);
		if (!hashed) {
			throw this.createError(
				"OTP expired or not found.",
				StatusCodes.BAD_REQUEST,
			);
		}
		const attempt = await incrementOtpVerificationAttempts(
			email,
			config.OTP_RATE_LIMIT_WINDOW,
		);
		if (attempt > config.OTP_MAX_VERIFICATION_ATTEMPTS) {
			throw this.createError(
				"Too many incorrect attempts. Please request a new OTP.",
				StatusCodes.TOO_MANY_REQUESTS,
			);
		}
		const isMatch = await bcrypt.compare(payload.otp, hashed);
		if (!isMatch) {
			throw this.createError("Invalid OTP.", StatusCodes.BAD_REQUEST);
		}
		const expireSeconds = this.getOtpExpirySeconds();
		await markOtpVerified(email, expireSeconds);
		await clearOtpHash(email);
		await clearOtpVerificationAttempts(email);
		return { verified: true };
	}

	public async register(payload: registerDTO): Promise<AuthResponse> {
		const email = this.normalizeEmail(payload.email);
		const otpVerified = await isOtpVerified(email);
		if (!otpVerified) {
			throw this.createError(
				"OTP verification required before registration.",
				StatusCodes.FORBIDDEN,
			);
		}
		await this.ensureEmailNotRegistered(email);
		const passwordHash = await bcrypt.hash(payload.password, this.saltRounds);
		const [record] = await db
			.insert(authTable)
			.values({
				fullname: payload.fullname.trim(),
				email,
				passwordHash,
				isEmailVerified: true,
			})
			.returning();
		if (!record) {
			throw this.createError(
				"Failed to create user.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		await deleteOtpData(email);
		const tokens = await this.createTokens(record);
		await this.enqueueUserProfileCreation(record);
		return {
			user: this.sanitizeUser(record),
			tokens,
		};
	}

	public async login(
		payload: loginDTO,
		context: SessionContext = {},
	): Promise<AuthResponse> {
		const email = this.normalizeEmail(payload.email);
		const user = await this.getUserByEmail(email);
		if (!user) {
			throw this.createError("Invalid credentials.", StatusCodes.UNAUTHORIZED);
		}
		if (!user.isEmailVerified) {
			throw this.createError("Account not verified.", StatusCodes.FORBIDDEN);
		}
		if (!user.isActive || user.isDisabled) {
			throw this.createError("Account disabled.", StatusCodes.FORBIDDEN);
		}
		const isMatch = await bcrypt.compare(payload.password, user.passwordHash);
		if (!isMatch) {
			throw this.createError("Invalid credentials.", StatusCodes.UNAUTHORIZED);
		}
		const loginAt = new Date();
		await this.updateLastLogin(user.id, loginAt);
		const currentUser: Auth = {
			...user,
			lastLoginAt: loginAt,
			updatedAt: loginAt,
		};
		const sessionContext = this.normalizeSessionContext(context);
		const tokens = await this.createTokens(currentUser, {
			sessionContext,
		});
		return {
			user: this.sanitizeUser(currentUser),
			tokens,
		};
	}

	public async refreshTokens(
		payload: refreshTokenDTO,
		context: SessionContext = {},
	): Promise<AuthResponse> {
		const refreshSecret = config.JWT_REFRESH_SECRET;
		if (!refreshSecret) {
			throw this.createError(
				"Refresh token secret not configured.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		const verification = verifyToken<RefreshTokenPayload>(
			payload.refreshToken,
			refreshSecret,
		);
		if (verification.expired) {
			await this.deleteRefreshToken(payload.refreshToken);
			throw this.createError(
				"Refresh token expired.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		if (!verification.valid || !verification.payload?.sub) {
			throw this.createError(
				"Invalid refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		const storedToken = await this.getRefreshTokenRecord(payload.refreshToken);
		if (!storedToken || storedToken.userId !== verification.payload.sub) {
			throw this.createError(
				"Invalid refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		const sessionRecord = await this.getSessionByToken(payload.refreshToken);
		if (storedToken.expiresAt <= new Date()) {
			await this.deleteRefreshToken(payload.refreshToken);
			throw this.createError(
				"Refresh token expired.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		const user = await this.getUserById(verification.payload.sub);
		if (!user) {
			await this.deleteRefreshToken(payload.refreshToken);
			throw this.createError("User not found.", StatusCodes.UNAUTHORIZED);
		}
		if (!user.isActive || user.isDisabled) {
			await this.deleteRefreshToken(payload.refreshToken);
			throw this.createError("Account disabled.", StatusCodes.FORBIDDEN);
		}
		if (!user.isEmailVerified) {
			await this.deleteRefreshToken(payload.refreshToken);
			throw this.createError("Account not verified.", StatusCodes.FORBIDDEN);
		}
		const sessionContext = this.normalizeSessionContext(context, sessionRecord);
		const tokens = await this.createTokens(user, {
			replaceRefreshToken: payload.refreshToken,
			sessionContext,
		});
		return {
			user: this.sanitizeUser(user),
			tokens,
		};
	}

	public async logout(refreshToken: string): Promise<void> {
		const refreshSecret = config.JWT_REFRESH_SECRET;
		if (!refreshSecret) {
			throw this.createError(
				"Refresh token secret not configured.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		const verification = verifyToken<JwtPayload & { sub?: string }>(
			refreshToken,
			refreshSecret,
		);
		if (verification.expired) {
			await this.deleteRefreshToken(refreshToken);
			throw this.createError(
				"Refresh token expired.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		if (!verification.valid || !verification.payload?.sub) {
			throw this.createError(
				"Malformed refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		await this.deleteUserRefreshTokens(verification.payload.sub);
	}

	private async ensureEmailNotRegistered(email: string): Promise<void> {
		const user = await this.getUserByEmail(email);
		if (user) {
			throw this.createError("Email already registered.", StatusCodes.CONFLICT);
		}
	}

	private async getUserByEmail(email: string): Promise<Auth | undefined> {
		const result = await db
			.select()
			.from(authTable)
			.where(eq(authTable.email, email))
			.limit(1);
		return result[0];
	}

	private async getUserById(id: string): Promise<Auth | undefined> {
		const result = await db
			.select()
			.from(authTable)
			.where(eq(authTable.id, id))
			.limit(1);
		return result[0];
	}

	private sanitizeUser(user: Auth): PublicAuthRecord {
		const { passwordHash, ...rest } = user;
		return rest;
	}

	private async createTokens(
		user: Auth,
		options: { replaceRefreshToken?: string; sessionContext?: SessionContext } = {},
	): Promise<AuthTokens> {
		const accessSecret = config.JWT_SECRET ?? "";
		const refreshSecret = config.JWT_REFRESH_SECRET ?? "";
		if (!accessSecret || !refreshSecret) {
			throw this.createError(
				"JWT secrets not configured.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		const accessExpires = config.JWT_ACCESS_EXPIRES_IN ?? "15m";
		const refreshExpires = config.JWT_REFRESH_EXPIRES_IN ?? "7d";
		const accessExpiresSeconds = this.durationToSeconds(accessExpires, 900);
		const refreshExpiresSeconds = this.durationToSeconds(
			refreshExpires,
			604800,
		);
		const accessToken = jwt.sign(
			{
				sub: user.id,
				email: user.email,
				role: user.role,
			},
			accessSecret,
			{ expiresIn: accessExpiresSeconds },
		);
		const refreshToken = jwt.sign(
			{
				sub: user.id,
				jti: randomUUID(),
			},
			refreshSecret,
			{ expiresIn: refreshExpiresSeconds },
		);
		const expiresAt = this.getRefreshTokenExpiryDate(refreshExpiresSeconds);
		if (options.replaceRefreshToken) {
			await this.deleteRefreshToken(options.replaceRefreshToken);
		}
		await this.saveRefreshToken(user.id, refreshToken, expiresAt);
		await this.saveSession(user.id, refreshToken, expiresAt, options.sessionContext);
		return {
			accessToken,
			refreshToken,
			accessTokenExpiresIn: accessExpires,
			refreshTokenExpiresIn: refreshExpires,
		};
	}

	private getRefreshTokenExpiryDate(seconds: number): Date {
		return new Date(Date.now() + seconds * 1000);
	}

	private async saveRefreshToken(
		userId: string,
		token: string,
		expiresAt: Date,
	): Promise<void> {
		await db.insert(refreshTokens).values({ userId, token, expiresAt });
	}

	private async deleteRefreshToken(token: string): Promise<void> {
		await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
		await this.deleteSessionByToken(token);
	}

	private async deleteUserRefreshTokens(userId: string): Promise<void> {
		await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
		await this.deleteSessionsByUser(userId);
	}

	private async getRefreshTokenRecord(
		token: string,
	): Promise<RefreshToken | undefined> {
		const result = await db
			.select()
			.from(refreshTokens)
			.where(eq(refreshTokens.token, token))
			.limit(1);
		return result[0];
	}

	private async saveSession(
		userId: string,
		token: string,
		expiresAt: Date,
		context?: SessionContext,
	): Promise<void> {
		await db.insert(sessions).values({
			userId,
			token,
			expiresAt,
			ipAddress: context?.ipAddress,
			userAgent: context?.userAgent,
		});
	}

	private async deleteSessionByToken(token: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.token, token));
	}

	private async deleteSessionsByUser(userId: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.userId, userId));
	}

	private async getSessionByToken(
		token: string,
	): Promise<Session | undefined> {
		const result = await db
			.select()
			.from(sessions)
			.where(eq(sessions.token, token))
			.limit(1);
		return result[0];
	}

	private normalizeSessionContext(
		context: SessionContext = {},
		session?: Session,
	): SessionContext {
		return {
			ipAddress: context.ipAddress ?? session?.ipAddress ?? undefined,
			userAgent: context.userAgent ?? session?.userAgent ?? undefined,
		};
	}

	private async updateLastLogin(
		userId: string,
		timestamp: Date,
	): Promise<void> {
		await db
			.update(authTable)
			.set({ lastLoginAt: timestamp, updatedAt: timestamp })
			.where(eq(authTable.id, userId));
	}

	private generateOtp(): string {
		return Math.floor(100000 + Math.random() * 900000).toString();
	}

	private getOtpExpirySeconds(): number {
		return Math.max(config.OTP_EXPIRATION_MINUTES, 1) * 60;
	}

	private durationToSeconds(duration: string, fallbackSeconds: number): number {
		const match = duration.trim().match(/^([0-9]+)(ms|s|m|h|d)$/i);
		if (!match) {
			return fallbackSeconds;
		}
		const value = Number(match[1]);
		switch (match[2].toLowerCase()) {
			case "ms":
				return Math.max(Math.floor(value / 1000), 1);
			case "s":
				return Math.max(value, 1);
			case "m":
				return Math.max(value * 60, 1);
			case "h":
				return Math.max(value * 60 * 60, 1);
			case "d":
				return Math.max(value * 24 * 60 * 60, 1);
			default:
				return fallbackSeconds;
		}
	}

	private async rateLimitOtpRequests(email: string): Promise<void> {
		const count = await incrementOtpRequestCount(
			email,
			config.OTP_RATE_LIMIT_WINDOW,
		);
		if (count > config.OTP_MAX_REQUESTS) {
			throw this.createError(
				"Too many OTP requests. Please try again later.",
				StatusCodes.TOO_MANY_REQUESTS,
			);
		}
	}

	private normalizeEmail(email: string): string {
		return email.trim().toLowerCase();
	}

	private createError(message: string, statusCode: number): ServiceError {
		const error = new Error(message) as ServiceError;
		error.statusCode = statusCode;
		return error;
	}

	private async enqueueUserProfileCreation(user: Auth): Promise<void> {
		const message: UserRegisteredMessage = {
			id: user.id,
			fullname: user.fullname,
			email: user.email,
		};
		try {
			await publishDirectMessage({
				channelFactory: authConnection,
				exchangeName: "user.register",
				routingKey: "user.create",
				message: JSON.stringify({ data: message }),
				logMessage: `Queued profile creation for ${user.email}`,
			});
		} catch (error) {
			console.error("Failed to enqueue user profile creation:", error);
		}
	}
}

export const authService: AuthService = new AuthService();
