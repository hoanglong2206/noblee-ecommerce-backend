import express, { Router } from "express";
import { requireAuth } from "../shared/middleware/auth.middleware";
import { validate } from "../shared/middleware/validation.middleware";
import scheme from "./role.scheme";
import { roleController } from "./role.controller";

class AuthorizationRoutes {
	private readonly roleRouter: Router;
	private readonly permissionRouter: Router;

	constructor() {
		this.roleRouter = express.Router();
		this.permissionRouter = express.Router();
		this.initializeRoleRoutes();
		this.initializePermissionRoutes();
	}

	public roles(): Router {
		return this.roleRouter;
	}

	public permissions(): Router {
		return this.permissionRouter;
	}

	private initializeRoleRoutes(): void {
		this.roleRouter.get("/", requireAuth, roleController.listRoles);
		this.roleRouter.post(
			"/",
			requireAuth,
			validate(scheme.createRole()),
			roleController.createRole,
		);
		this.roleRouter.get("/:roleId", requireAuth, roleController.getRole);
		this.roleRouter.patch(
			"/:roleId",
			requireAuth,
			validate(scheme.updateRole()),
			roleController.updateRole,
		);
		this.roleRouter.delete("/:roleId", requireAuth, roleController.deleteRole);
	}

	private initializePermissionRoutes(): void {
		this.permissionRouter.get("/", requireAuth, roleController.listPermissions);
		this.permissionRouter.post(
			"/",
			requireAuth,
			validate(scheme.createPermission()),
			roleController.createPermission,
		);
		this.permissionRouter.get(
			"/:permissionId",
			requireAuth,
			roleController.getPermission,
		);
		this.permissionRouter.patch(
			"/:permissionId",
			requireAuth,
			validate(scheme.updatePermission()),
			roleController.updatePermission,
		);
		this.permissionRouter.delete(
			"/:permissionId",
			requireAuth,
			roleController.deletePermission,
		);
	}
}

export const authorizationRoutes = new AuthorizationRoutes();
