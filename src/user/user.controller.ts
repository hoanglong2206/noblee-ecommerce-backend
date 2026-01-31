import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { userService } from "./user.service";

class UserController {
	public getProfile = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const profile = await userService.getProfile(actor.id);
			res.status(StatusCodes.OK).json({ profile });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public updateProfile = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const profile = await userService.updateProfile(actor.id, req.body);
			res.status(StatusCodes.OK).json({ message: "Profile updated.", profile });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public updateAvatar = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const result = await userService.updateAvatar(actor.id, req.body);
			res.status(StatusCodes.OK).json({
				message: "Avatar updated.",
				avatarUrl: result.avatarUrl,
				publicId: result.publicId,
			});
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public getAddresses = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const addresses = await userService.getAddresses(actor.id);
			res.status(StatusCodes.OK).json({ addresses });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public createAddress = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const address = await userService.createAddress(actor.id, req.body);
			res
				.status(StatusCodes.CREATED)
				.json({ message: "Address created.", address });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public updateAddress = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const addressId = this.resolveSingleParam(req.params.addressId);
			if (!addressId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Address id is required." });
				return;
			}
			const address = await userService.updateAddress(
				actor.id,
				addressId,
				req.body,
			);
			res.status(StatusCodes.OK).json({ message: "Address updated.", address });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public deleteAddress = async (req: Request, res: Response): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const addressId = this.resolveSingleParam(req.params.addressId);
			if (!addressId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Address id is required." });
				return;
			}
			await userService.deleteAddress(actor.id, addressId);
			res.status(StatusCodes.NO_CONTENT).send();
		} catch (error) {
			this.handleError(error, res);
		}
	};

	public setDefaultAddress = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const actor = req.authUser;
			if (!actor) {
				res.status(StatusCodes.UNAUTHORIZED).json({ message: "Unauthorized." });
				return;
			}
			const addressId = this.resolveSingleParam(req.params.addressId);
			if (!addressId) {
				res
					.status(StatusCodes.BAD_REQUEST)
					.json({ message: "Address id is required." });
				return;
			}
			const address = await userService.setDefaultAddress(actor.id, addressId);
			res
				.status(StatusCodes.OK)
				.json({ message: "Default address set.", address });
		} catch (error) {
			this.handleError(error, res);
		}
	};

	private handleError(error: unknown, res: Response): void {
		const err = error as { message?: string; statusCode?: number };
		const status = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
		res.status(status).json({ message: err.message || "Unexpected error." });
	}

	private resolveSingleParam(
		value: string | string[] | undefined,
	): string | undefined {
		if (Array.isArray(value)) {
			return value[0];
		}
		return value;
	}
}

export const userController = new UserController();
