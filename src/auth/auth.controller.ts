import { StatusCodes } from "http-status-codes";
import { CookieOptions, Request, Response } from "express";
import { authService } from "./auth.service";
import { config } from "../config";

const ACCESS_TOKEN_COOKIE = "accessToken";
const REFRESH_TOKEN_COOKIE = "refreshToken";

class AuthController {
	public sendOtp = async (req: Request, res: Response): Promise<void> => {
		try {
			const result = await authService.sendOtp(req.body);
			res.status(StatusCodes.OK).json({
				message: "OTP sent successfully.",
				expiresIn: result.expiresIn,
			});
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public resendOtp = async (req: Request, res: Response): Promise<void> => {
		try {
			const result = await authService.resendOtp(req.body);
			res.status(StatusCodes.OK).json({
				message: "OTP resent successfully.",
				expiresIn: result.expiresIn,
			});
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public verifyOtp = async (req: Request, res: Response): Promise<void> => {
		try {
			await authService.verifyOtp(req.body);
			res.status(StatusCodes.OK).json({
				message: "OTP verified successfully.",
			});
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public register = async (req: Request, res: Response): Promise<void> => {
		try {
			const result = await authService.register(req.body);
			this.setAuthCookies(res, result.tokens);
			res.status(StatusCodes.CREATED).json(result);
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public login = async (req: Request, res: Response): Promise<void> => {
		try {
			const result = await authService.login(req.body, {
				ipAddress: req.ip,
				userAgent: req.get("user-agent") ?? undefined,
			});
			this.setAuthCookies(res, result.tokens);
			res.status(StatusCodes.OK).json(result);
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public refresh = async (req: Request, res: Response): Promise<void> => {
		try {
			const token =
				req.body?.refreshToken ||
				(req.cookies && req.cookies[REFRESH_TOKEN_COOKIE]);
			if (!token) {
				res.status(StatusCodes.BAD_REQUEST).json({
					message: "Refresh token is required.",
				});
				return;
			}
			const result = await authService.refreshTokens(
				{ refreshToken: token },
				{
					ipAddress: req.ip,
					userAgent: req.get("user-agent") ?? undefined,
				},
			);
			this.setAuthCookies(res, result.tokens);
			res.status(StatusCodes.OK).json(result);
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public logout = async (req: Request, res: Response): Promise<void> => {
		try {
			const token =
				req.body?.refreshToken ||
				(req.cookies && req.cookies[REFRESH_TOKEN_COOKIE]);
			if (!token) {
				res.status(StatusCodes.BAD_REQUEST).json({
					message: "Refresh token is required.",
				});
				return;
			}
			await authService.logout(token);
			this.clearAuthCookies(res);
			res.status(StatusCodes.OK).json({ message: "Logged out successfully." });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	private setAuthCookies(
		res: Response,
		tokens: {
			accessToken: string;
			refreshToken: string;
			accessTokenExpiresIn: string;
			refreshTokenExpiresIn: string;
		},
	): void {
		const secure = config.NODE_ENV === "production";
		const accessCookieOptions: CookieOptions = {
			httpOnly: true,
			sameSite: "lax",
			secure,
			path: "/",
			maxAge: this.durationToMs(tokens.accessTokenExpiresIn),
		};
		const refreshCookieOptions: CookieOptions = {
			httpOnly: true,
			sameSite: "lax",
			secure,
			path: "/",
			maxAge: this.durationToMs(tokens.refreshTokenExpiresIn),
		};
		res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, accessCookieOptions);
		res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, refreshCookieOptions);
	}

	private clearAuthCookies(res: Response): void {
		const secure = config.NODE_ENV === "production";
		const baseOptions: CookieOptions = {
			httpOnly: true,
			sameSite: "lax",
			secure,
			path: "/",
		};
		res.clearCookie(ACCESS_TOKEN_COOKIE, baseOptions);
		res.clearCookie(REFRESH_TOKEN_COOKIE, baseOptions);
	}

	private durationToMs(duration: string): number {
		const trimmed = duration.trim();
		const match = trimmed.match(/^([0-9]+)(ms|s|m|h|d)$/i);
		if (!match) {
			return 0;
		}
		const value = Number(match[1]);
		switch (match[2].toLowerCase()) {
			case "ms":
				return value;
			case "s":
				return value * 1000;
			case "m":
				return value * 60 * 1000;
			case "h":
				return value * 60 * 60 * 1000;
			case "d":
				return value * 24 * 60 * 60 * 1000;
			default:
				return 0;
		}
	}

	private handleError(error: unknown, res: Response): void {
		const err = error as { message: string; statusCode?: number };
		const status = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
		res.status(status).json({
			message: err.message || "Unexpected error occurred.",
		});
	}
}

export default new AuthController();
