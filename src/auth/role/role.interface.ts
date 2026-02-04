import {
	ActionValue,
	RolePermissionRecord,
	RoleValue,
	ResourceValue,
} from "./role.model";

export type PermissionName = `${ResourceValue}:${ActionValue}`;

export type WildcardPermissionName =
	| PermissionName
	| `${ResourceValue}:*`
	| "*:*";

export type PermissionCondition = Record<string, string | number | boolean>;

export interface PermissionDefinition {
	name: PermissionName;
	resource: ResourceValue;
	action: ActionValue;
	description?: string;
}

export interface RolePermissionDefinition {
	permission: WildcardPermissionName;
	conditions?: PermissionCondition;
}

export interface RoleDefinitionSeed {
	role: RoleValue;
	permissions: RolePermissionDefinition[];
}

export interface PermissionCheckContext extends PermissionCondition {}

export interface ResolvedRolePermission extends Omit<
	RolePermissionRecord,
	"conditions"
> {
	conditions?: PermissionCondition;
	permissionName: PermissionName;
}
