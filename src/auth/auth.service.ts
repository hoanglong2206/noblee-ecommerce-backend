import { db } from "../database";
import { eq } from "drizzle-orm";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { StatusCodes } from "http-status-codes";
import { config } from "../config";
import { verifyToken } from "../middleware/auth.middleware";
import { authTable, AuthRecord, AuthRole } from "./auth.model";
import {
	sendOtpDTO,
	verifyOtpDTO,
	registerDTO,
	loginDTO,
	refreshTokenDTO,
} from "./auth.interface";
import { mailer } from "../helpers/mailer";
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
} from "../redis/otp.store";

type ServiceError = Error & { statusCode?: number };

type AuthTokens = {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresIn: string;
	refreshTokenExpiresIn: string;
};

type PublicAuthRecord = Omit<AuthRecord, "passwordHash">;

type AuthResponse = {
	user: PublicAuthRecord;
	tokens: AuthTokens;
};

type RefreshTokenPayload = JwtPayload & {
	sub?: string;
	tokenVersion?: number;
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
				isVerified: true,
			})
			.returning();
		if (!record) {
			throw this.createError(
				"Failed to create user.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		await deleteOtpData(email);
		const tokens = this.createTokens(record);
		return {
			user: this.sanitizeUser(record),
			tokens,
		};
	}

	public async login(payload: loginDTO): Promise<AuthResponse> {
		const email = this.normalizeEmail(payload.email);
		const user = await this.getUserByEmail(email);
		if (!user) {
			throw this.createError("Invalid credentials.", StatusCodes.UNAUTHORIZED);
		}
		if (!user.isVerified) {
			throw this.createError("Account not verified.", StatusCodes.FORBIDDEN);
		}
		if (user.isDisabled) {
			throw this.createError("Account disabled.", StatusCodes.FORBIDDEN);
		}
		const isMatch = await bcrypt.compare(payload.password, user.passwordHash);
		if (!isMatch) {
			throw this.createError("Invalid credentials.", StatusCodes.UNAUTHORIZED);
		}
		const tokens = this.createTokens(user);
		return {
			user: this.sanitizeUser(user),
			tokens,
		};
	}

	public async refreshTokens(payload: refreshTokenDTO): Promise<AuthResponse> {
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
			throw this.createError(
				"Refresh token expired.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		if (!verification.valid || !verification.payload) {
			throw this.createError(
				"Invalid refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		if (
			!verification.payload.sub ||
			verification.payload.tokenVersion === undefined
		) {
			throw this.createError(
				"Malformed refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		const user = await this.getUserById(verification.payload.sub);
		if (!user || user.tokenVersion !== verification.payload.tokenVersion) {
			throw this.createError(
				"Invalid refresh token.",
				StatusCodes.UNAUTHORIZED,
			);
		}
		const tokens = this.createTokens(user);
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
		await this.revokeRefreshTokens(verification.payload.sub);
	}

	public async updateUserRole(
		actorId: string,
		targetUserId: string,
		role: AuthRole,
	): Promise<PublicAuthRecord> {
		if (!this.isAssignableRole(role)) {
			throw this.createError("Invalid target role.", StatusCodes.BAD_REQUEST);
		}
		const actor = await this.getUserById(actorId);
		if (!actor) {
			throw this.createError("Actor not found.", StatusCodes.NOT_FOUND);
		}
		if (!this.isAdmin(actor)) {
			throw this.createError(
				"Insufficient permissions.",
				StatusCodes.FORBIDDEN,
			);
		}
		const target = await this.getUserById(targetUserId);
		if (!target) {
			throw this.createError("User not found.", StatusCodes.NOT_FOUND);
		}
		if (this.isAdmin(target)) {
			throw this.createError(
				"Cannot modify another admin.",
				StatusCodes.FORBIDDEN,
			);
		}
		const [updated] = await db
			.update(authTable)
			.set({ role })
			.where(eq(authTable.id, targetUserId))
			.returning();
		if (!updated) {
			throw this.createError(
				"Failed to update role.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return this.sanitizeUser(updated);
	}

	public async setAccountDisabled(
		actorId: string,
		targetUserId: string,
		disabled: boolean,
	): Promise<PublicAuthRecord> {
		const actor = await this.getUserById(actorId);
		if (!actor) {
			throw this.createError("Actor not found.", StatusCodes.NOT_FOUND);
		}
		if (!this.isAdmin(actor)) {
			throw this.createError(
				"Insufficient permissions.",
				StatusCodes.FORBIDDEN,
			);
		}
		const target = await this.getUserById(targetUserId);
		if (!target) {
			throw this.createError("User not found.", StatusCodes.NOT_FOUND);
		}
		if (this.isAdmin(target)) {
			throw this.createError(
				"Cannot disable another admin.",
				StatusCodes.FORBIDDEN,
			);
		}
		const [updated] = await db
			.update(authTable)
			.set({ isDisabled: disabled })
			.where(eq(authTable.id, targetUserId))
			.returning();
		if (!updated) {
			throw this.createError(
				"Failed to update account status.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return this.sanitizeUser(updated);
	}

	private async revokeRefreshTokens(userId: string): Promise<void> {
		const nextVersion = await this.getNextTokenVersion(userId);
		await db
			.update(authTable)
			.set({ tokenVersion: nextVersion })
			.where(eq(authTable.id, userId));
	}

	private async getNextTokenVersion(userId: string): Promise<number> {
		const user = await this.getUserById(userId);
		if (!user) {
			throw this.createError("User not found.", StatusCodes.NOT_FOUND);
		}
		return user.tokenVersion + 1;
	}

	private async ensureEmailNotRegistered(email: string): Promise<void> {
		const user = await this.getUserByEmail(email);
		if (user) {
			throw this.createError("Email already registered.", StatusCodes.CONFLICT);
		}
	}

	private async getUserByEmail(email: string): Promise<AuthRecord | undefined> {
		const result = await db
			.select()
			.from(authTable)
			.where(eq(authTable.email, email))
			.limit(1);
		return result[0];
	}

	private async getUserById(id: string): Promise<AuthRecord | undefined> {
		const result = await db
			.select()
			.from(authTable)
			.where(eq(authTable.id, id))
			.limit(1);
		return result[0];
	}

	private sanitizeUser(user: AuthRecord): PublicAuthRecord {
		const { passwordHash, ...rest } = user;
		return rest;
	}

	private createTokens(user: AuthRecord): AuthTokens {
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
			},
			accessSecret,
			{ expiresIn: accessExpiresSeconds },
		);
		const refreshToken = jwt.sign(
			{
				sub: user.id,
				tokenVersion: user.tokenVersion,
			},
			refreshSecret,
			{ expiresIn: refreshExpiresSeconds },
		);
		return {
			accessToken,
			refreshToken,
			accessTokenExpiresIn: accessExpires,
			refreshTokenExpiresIn: refreshExpires,
		};
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

	private isAdmin(user: AuthRecord): boolean {
		return user.role === "admin";
	}

	private isAssignableRole(role: AuthRole): boolean {
		return role === "user" || role === "staff";
	}
}

export const authService: AuthService = new AuthService();
