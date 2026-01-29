import express, { Router } from "express";
import authController from "./auth.controller";
import { validate } from "../middleware/validation.middleware";
import scheme from "./auth.scheme";
import { requireAdmin } from "../middleware/auth.middleware";

class AuthRoutes {
	private router: Router;

	constructor() {
		this.router = express.Router();
		this.initializeRoutes();
	}
	public routes(): Router {
		return this.router;
	}

	private initializeRoutes(): void {
		this.router.post(
			"/otp/send",
			validate(scheme.sendOtp()),
			authController.sendOtp,
		);
		this.router.post(
			"/otp/resend",
			validate(scheme.resendOtp()),
			authController.resendOtp,
		);
		this.router.post(
			"/otp/verify",
			validate(scheme.verifyOtp()),
			authController.verifyOtp,
		);
		this.router.post(
			"/register",
			validate(scheme.register()),
			authController.register,
		);
		this.router.post("/login", validate(scheme.login()), authController.login);
		this.router.post("/refresh", authController.refresh);
		this.router.post("/logout", authController.logout);
		this.router.patch(
			"/role",
			requireAdmin,
			validate(scheme.updateRole()),
			authController.updateRole,
		);
		this.router.patch(
			"/disable",
			requireAdmin,
			validate(scheme.setAccountDisabled()),
			authController.setAccountDisabled,
		);
	}
}
export const authRoutes: AuthRoutes = new AuthRoutes();
