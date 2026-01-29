import Joi, { ObjectSchema } from "joi";

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
}

export default new AuthScheme();
