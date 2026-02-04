import Joi, { ObjectSchema } from "joi";
import { roleEnum } from "./role/role.model";

const assignableRoles = roleEnum.enumValues.filter(
	(role) => role !== "super_admin",
);

class AuthScheme {
	public sendOtp(): ObjectSchema {
		return Joi.object({
			email: Joi.string().email().lowercase().trim().required(),
		});
	}

	public verifyOtp(): ObjectSchema {
		return Joi.object({
			email: Joi.string().email().lowercase().trim().required(),
			otp: Joi.string()
				.pattern(/^[0-9]{6}$/)
				.required(),
		});
	}

	public register(): ObjectSchema {
		return Joi.object({
			email: Joi.string().email().lowercase().trim().required(),
			fullname: Joi.string().min(3).max(100).trim().required(),
			password: Joi.string().min(8).max(128).required(),
		});
	}

	public login(): ObjectSchema {
		return Joi.object({
			email: Joi.string().email().lowercase().trim().required(),
			password: Joi.string().min(8).max(128).required(),
		});
	}

	public resendOtp(): ObjectSchema {
		return this.sendOtp();
	}

	public updateRole(): ObjectSchema {
		return Joi.object({
			targetUserId: Joi.string().guid({ version: "uuidv4" }).required(),
			role: Joi.string()
				.valid(...assignableRoles)
				.required(),
		});
	}

	public setAccountDisabled(): ObjectSchema {
		return Joi.object({
			targetUserId: Joi.string().guid({ version: "uuidv4" }).required(),
			disabled: Joi.boolean().required(),
		});
	}
}

export default new AuthScheme();
