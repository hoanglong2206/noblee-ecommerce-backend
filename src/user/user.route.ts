import express, { Router } from "express";
import { validate } from "../shared/middleware/validation.middleware";
import { requireAuth } from "../shared/middleware/auth.middleware";
import { userController } from "./user.controller";
import scheme from "./user.scheme";

class UserRoutes {
	private router: Router;

	constructor() {
		this.router = express.Router();
		this.initializeRoutes();
	}

	public routes(): Router {
		return this.router;
	}

	private initializeRoutes(): void {
		this.router.get("/me", requireAuth, userController.getProfile);
		this.router.patch(
			"/me",
			requireAuth,
			validate(scheme.updateProfile()),
			userController.updateProfile,
		);
		this.router.post(
			"/me/avatar",
			requireAuth,
			validate(scheme.updateAvatar()),
			userController.updateAvatar,
		);
		this.router.get("/addresses", requireAuth, userController.getAddresses);
		this.router.post(
			"/addresses",
			requireAuth,
			validate(scheme.createAddress()),
			userController.createAddress,
		);
		this.router.patch(
			"/addresses/:addressId",
			requireAuth,
			validate(scheme.updateAddress()),
			userController.updateAddress,
		);
		this.router.delete(
			"/addresses/:addressId",
			requireAuth,
			userController.deleteAddress,
		);
		this.router.patch(
			"/addresses/:addressId/default",
			requireAuth,
			userController.setDefaultAddress,
		);
	}
}

export const userRoutes = new UserRoutes();
