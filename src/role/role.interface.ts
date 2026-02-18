import { ActionValue, ResourceValue } from "./role.model";

export type PermissionName = `${ResourceValue}:${ActionValue}`;

export type WildcardPermissionName =
	| PermissionName
	| `${ResourceValue}:*`
	| "*:*";

export interface PermissionDefinition {
	name: PermissionName;
	resource: ResourceValue;
	action: ActionValue;
	description?: string;
}

export interface CreateRoleDTO {
	displayName: string;
	description?: string;
	isSystem?: boolean;
	isActive?: boolean;
	permissionIds?: string[];
	permissionNames?: PermissionName[];
}

export interface UpdateRoleDTO {
	displayName?: string;
	description?: string;
	isSystem?: boolean;
	isActive?: boolean;
	permissionIds?: string[];
	permissionNames?: PermissionName[];
}

export interface CreatePermissionDTO {
	displayName: string;
	description?: string;
	resource: ResourceValue;
	action: ActionValue;
	isActive?: boolean;
}

export interface UpdatePermissionDTO {
	displayName?: string;
	description?: string;
	resource?: ResourceValue;
	action?: ActionValue;
	isActive?: boolean;
}

export interface PermissionResponse {
	id: string;
	displayName: string;
	name: PermissionName;
	resource: ResourceValue;
	action: ActionValue;
	description?: string | null;
	isActive: boolean;
	createdAt: string;
}

export interface RoleResponse {
	id: string;
	name: string;
	description?: string | null;
	isSystem: boolean;
	isActive: boolean;
	userCount: number;
	permissions: PermissionName[];
	permissionDetails: PermissionResponse[];
	createdAt: string;
	color?: string | null;
}
