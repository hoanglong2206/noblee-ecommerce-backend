import Joi, { ObjectSchema } from "joi";
import { actionEnum, resourceEnum } from "./role.model";

class RoleScheme {
	public createRole(): ObjectSchema {
		return Joi.object({
			displayName: this.displayNameSchema().required(),
			description: this.descriptionSchema(),
			isSystem: Joi.boolean(),
			isActive: Joi.boolean(),
			permissionIds: Joi.array().items(this.uuidSchema()).default([]),
			permissionNames: Joi.array()
				.items(this.permissionNameSchema())
				.default([]),
		});
	}

	public updateRole(): ObjectSchema {
		return Joi.object({
			displayName: this.displayNameSchema(),
			description: this.descriptionSchema(),
			isSystem: Joi.boolean(),
			isActive: Joi.boolean(),
			permissionIds: Joi.array().items(this.uuidSchema()),
			permissionNames: Joi.array().items(this.permissionNameSchema()),
		}).min(1);
	}

	public createPermission(): ObjectSchema {
		return Joi.object({
			displayName: this.displayNameSchema().required(),
			description: this.descriptionSchema(),
			resource: Joi.string()
				.valid(...resourceEnum.enumValues)
				.required(),
			action: Joi.string()
				.valid(...actionEnum.enumValues)
				.required(),
			isActive: Joi.boolean(),
		});
	}

	public updatePermission(): ObjectSchema {
		return Joi.object({
			displayName: this.displayNameSchema(),
			description: this.descriptionSchema(),
			resource: Joi.string().valid(...resourceEnum.enumValues),
			action: Joi.string().valid(...actionEnum.enumValues),
			isActive: Joi.boolean(),
		}).min(1);
	}

	private displayNameSchema() {
		return Joi.string().trim().min(3).max(200);
	}

	private descriptionSchema() {
		return Joi.string().allow(null, "").max(500).optional();
	}

	private uuidSchema() {
		return Joi.string().guid({ version: "uuidv4" });
	}

	private permissionNameSchema() {
		return Joi.string()
			.trim()
			.custom((value, helpers) => {
				const [resource, action] = value
					.split(":")
					.map((part: string) => part.trim());
				if (!resource || !action) {
					return helpers.error("any.invalid", {
						message: "Permission name must follow resource:action format.",
					});
				}
				if (!resourceEnum.enumValues.includes(resource)) {
					return helpers.error("any.invalid", {
						message: `Unknown resource '${resource}'.`,
					});
				}
				if (!actionEnum.enumValues.includes(action)) {
					return helpers.error("any.invalid", {
						message: `Unknown action '${action}'.`,
					});
				}
				return value;
			});
	}
}

export default new RoleScheme();
