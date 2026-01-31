import Joi, { ObjectSchema } from "joi";

class UserScheme {
	public updateProfile(): ObjectSchema {
		return Joi.object({
			fullname: Joi.string().min(3).max(100).trim(),
			phoneNumber: Joi.string().max(20).trim().allow("", null),
			gender: Joi.string()
				.valid("male", "female", "other", "prefer_not_to_say")
				.optional(),
			dateOfBirth: Joi.string().isoDate().allow("", null),
			bio: Joi.string().max(500).trim().allow("", null),
			address: Joi.string().max(500).trim().allow("", null),
			isProfileComplete: Joi.boolean(),
		})
			.min(1)
			.messages({
				"object.min": "At least one field must be provided.",
			});
	}

	public updateAvatar(): ObjectSchema {
		return Joi.object({
			file: Joi.string().trim().min(10).required(),
			overwrite: Joi.boolean().optional(),
			invalidate: Joi.boolean().optional(),
			publicId: Joi.string().trim().optional(),
		});
	}

	public createAddress(): ObjectSchema {
		return Joi.object({
			recipientName: Joi.string().min(3).max(100).trim().required(),
			streetLine1: Joi.string().min(3).max(255).trim().required(),
			streetLine2: Joi.string().max(255).trim().allow("", null),
			city: Joi.string().min(2).max(100).trim().required(),
			state: Joi.string().max(100).trim().allow("", null),
			postalCode: Joi.string().max(20).trim().allow("", null),
			country: Joi.string().min(2).max(100).trim().required(),
			phoneNumber: Joi.string().max(20).trim().allow("", null),
			label: Joi.string().max(100).trim().allow("", null),
			isDefault: Joi.boolean().optional(),
		});
	}

	public updateAddress(): ObjectSchema {
		return Joi.object({
			recipientName: Joi.string().min(3).max(100).trim(),
			streetLine1: Joi.string().min(3).max(255).trim(),
			streetLine2: Joi.string().max(255).trim().allow("", null),
			city: Joi.string().min(2).max(100).trim(),
			state: Joi.string().max(100).trim().allow("", null),
			postalCode: Joi.string().max(20).trim().allow("", null),
			country: Joi.string().min(2).max(100).trim(),
			phoneNumber: Joi.string().max(20).trim().allow("", null),
			label: Joi.string().max(100).trim().allow("", null),
			isDefault: Joi.boolean(),
		})
			.min(1)
			.messages({
				"object.min": "At least one address field must be provided.",
			});
	}
}

export default new UserScheme();
