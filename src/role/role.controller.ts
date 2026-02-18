import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { roleService } from "./role.service";

class RoleController {
	public listRoles = async (_req: Request, res: Response): Promise<void> => {
		try {
			const roles = await roleService.listRoles();
			res.status(StatusCodes.OK).json({ roles });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public getRole = async (req: Request, res: Response): Promise<void> => {
		try {
			const roleId = this.resolveParam(req.params.roleId);
			if (!roleId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Role id is required." });
				return;
			}
			const role = await roleService.getRole(roleId);
			res.status(StatusCodes.OK).json({ role });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public createRole = async (req: Request, res: Response): Promise<void> => {
		try {
			const role = await roleService.createRole(req.body);
			res.status(StatusCodes.CREATED).json({ message: "Role created.", role });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public updateRole = async (req: Request, res: Response): Promise<void> => {
		try {
			const roleId = this.resolveParam(req.params.roleId);
			if (!roleId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Role id is required." });
				return;
			}
			const role = await roleService.updateRole(roleId, req.body);
			res.status(StatusCodes.OK).json({ message: "Role updated.", role });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public deleteRole = async (req: Request, res: Response): Promise<void> => {
		try {
			const roleId = this.resolveParam(req.params.roleId);
			if (!roleId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Role id is required." });
				return;
			}
			await roleService.deleteRole(roleId);
			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public listPermissions = async (
		_req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const permissions = await roleService.listPermissions();
			res.status(StatusCodes.OK).json({ permissions });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public getPermission = async (req: Request, res: Response): Promise<void> => {
		try {
			const permissionId = this.resolveParam(req.params.permissionId);
			if (!permissionId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Permission id is required." });
				return;
			}
			const permission = await roleService.getPermission(permissionId);
			res.status(StatusCodes.OK).json({ permission });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public createPermission = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const permission = await roleService.createPermission(req.body);
			res
				.status(StatusCodes.CREATED)
				.json({ message: "Permission created.", permission });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public updatePermission = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const permissionId = this.resolveParam(req.params.permissionId);
			if (!permissionId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Permission id is required." });
				return;
			}
			const permission = await roleService.updatePermission(
				permissionId,
				req.body,
			);
			res
				.status(StatusCodes.OK)
				.json({ message: "Permission updated.", permission });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public deletePermission = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const permissionId = this.resolveParam(req.params.permissionId);
			if (!permissionId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Permission id is required." });
				return;
			}
			await roleService.deletePermission(permissionId);
			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			this.handleError(error, res);
		}
	};

	private handleError(error: unknown, res: Response): void {
		const err = error as { message?: string; statusCode?: number };
		const status = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
		res.status(status).json({ message: err.message || "Unexpected error." });
	}

	private resolveParam(value?: string | string[]): string | undefined {
		if (!value) {
			return undefined;
		}
		return Array.isArray(value) ? value[0] : value;
	}
}

export const roleController = new RoleController();
