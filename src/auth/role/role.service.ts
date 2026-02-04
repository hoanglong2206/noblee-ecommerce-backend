import { StatusCodes } from "http-status-codes";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../database";
import {
	RoleValue,
	permissionsTable,
	rolePermissionsTable,
	PermissionRecord,
	actionEnum,
	resourceEnum,
} from "./role.model";
import {
	PermissionCheckContext,
	PermissionCondition,
	PermissionDefinition,
	PermissionName,
	ResolvedRolePermission,
	RoleDefinitionSeed,
	WildcardPermissionName,
} from "./role.interface";

type RoleServiceError = Error & { statusCode?: number };

type PermissionGrant = {
	role: RoleValue;
	permission: PermissionName;
	conditions?: PermissionCondition;
};

const DEFAULT_ROLE_DEFINITIONS: RoleDefinitionSeed[] = [
	{
		role: "super_admin",
		permissions: [
			{
				permission: "*:*",
			},
		],
	},
	{
		role: "admin",
		permissions: [
			{ permission: "staff:list" },
			{ permission: "staff:read" },
			{ permission: "staff:create" },
			{ permission: "staff:update" },
			{ permission: "staff:delete" },
			{ permission: "customers:*" },
			{ permission: "products:*" },
			{ permission: "categories:*" },
			{ permission: "orders:*" },
			{ permission: "transactions:*" },
			{ permission: "coupons:*" },
			{ permission: "reports:*" },
			{ permission: "audit_logs:*" },
		],
	},
	{
		role: "manager",
		permissions: [
			{ permission: "customers:list" },
			{ permission: "customers:read" },
			{ permission: "products:*" },
			{ permission: "categories:*" },
			{ permission: "orders:*" },
			{ permission: "transactions:list" },
			{ permission: "transactions:read" },
			{ permission: "coupons:list" },
			{ permission: "coupons:read" },
		],
	},
	{
		role: "support",
		permissions: [
			{ permission: "customers:read" },
			{ permission: "customers:update" },
			{ permission: "products:read" },
			{ permission: "categories:read" },
			{ permission: "orders:read" },
			{ permission: "orders:update" },
			{ permission: "transactions:read" },
			{ permission: "coupons:read" },
		],
	},
	{
		role: "customer",
		permissions: [
			{ permission: "products:list" },
			{ permission: "products:read" },
			{
				permission: "customers:read",
				conditions: { owner: "${userId}" },
			},
			{
				permission: "customers:update",
				conditions: { owner: "${userId}" },
			},
			{
				permission: "orders:list",
				conditions: { owner: "${userId}" },
			},
			{
				permission: "orders:read",
				conditions: { owner: "${userId}" },
			},
			{
				permission: "orders:update",
				conditions: { owner: "${userId}" },
			},
		],
	},
];

class RoleService {
	private readonly cache = new Map<RoleValue, ResolvedRolePermission[]>();
	private defaultsInitialized = false;
	private syncInFlight?: Promise<void>;

	public async ensureDefaults(): Promise<void> {
		if (this.defaultsInitialized) {
			return;
		}
		if (!this.syncInFlight) {
			this.syncInFlight = this.syncDefaults().finally(() => {
				this.syncInFlight = undefined;
			});
		}
		await this.syncInFlight;
		this.defaultsInitialized = true;
	}

	public async refreshCache(role?: RoleValue): Promise<void> {
		if (role) {
			this.cache.delete(role);
			return;
		}
		this.cache.clear();
	}

	public async getPermissionsForRole(
		role: RoleValue,
	): Promise<ResolvedRolePermission[]> {
		await this.ensureDefaults();
		const cached = this.cache.get(role);
		if (cached) {
			return cached;
		}
		const records = await db
			.select({
				id: rolePermissionsTable.id,
				role: rolePermissionsTable.role,
				permissionId: rolePermissionsTable.permissionId,
				conditions: rolePermissionsTable.conditions,
				createdAt: rolePermissionsTable.createdAt,
				permissionName: permissionsTable.name,
			})
			.from(rolePermissionsTable)
			.innerJoin(
				permissionsTable,
				eq(rolePermissionsTable.permissionId, permissionsTable.id),
			)
			.where(eq(rolePermissionsTable.role, role));
		const resolved = records.map((record) => ({
			id: record.id,
			role: record.role,
			permissionId: record.permissionId,
			createdAt: record.createdAt,
			conditions: (record.conditions ?? undefined) as
				| PermissionCondition
				| undefined,
			permissionName: record.permissionName as PermissionName,
		}));
		this.cache.set(role, resolved);
		return resolved;
	}

	public async hasPermission(
		role: RoleValue,
		permission: PermissionName,
		context?: PermissionCheckContext,
	): Promise<boolean> {
		const grants = await this.getPermissionsForRole(role);
		return grants.some(
			(grant) =>
				grant.permissionName === permission &&
				this.matchesConditions(grant.conditions, context),
		);
	}

	public async assertPermission(params: {
		role: RoleValue;
		permission: PermissionName;
		context?: PermissionCheckContext;
		message?: string;
	}): Promise<void> {
		const allowed = await this.hasPermission(
			params.role,
			params.permission,
			params.context,
		);
		if (!allowed) {
			throw this.createError(
				params.message ?? "Insufficient permissions.",
				StatusCodes.FORBIDDEN,
			);
		}
	}

	private async syncDefaults(): Promise<void> {
		const expanded = this.expandRoleSeeds(DEFAULT_ROLE_DEFINITIONS);
		const permissionMap = await this.ensurePermissions(expanded.permissions);
		await this.ensureRolePermissions(expanded.grants, permissionMap);
		this.cache.clear();
	}

	private expandRoleSeeds(seeds: RoleDefinitionSeed[]): {
		permissions: PermissionDefinition[];
		grants: PermissionGrant[];
	} {
		const permissionMap = new Map<PermissionName, PermissionDefinition>();
		const grantMap = new Map<string, PermissionGrant>();
		for (const seed of seeds) {
			for (const entry of seed.permissions) {
				for (const permission of this.expandWildcard(entry.permission)) {
					if (!permissionMap.has(permission)) {
						permissionMap.set(
							permission,
							this.createPermissionDefinition(permission),
						);
					}
					const key = `${seed.role}|${permission}`;
					grantMap.set(key, {
						role: seed.role,
						permission,
						conditions: entry.conditions,
					});
				}
			}
		}
		return {
			permissions: Array.from(permissionMap.values()),
			grants: Array.from(grantMap.values()),
		};
	}

	private expandWildcard(permission: WildcardPermissionName): PermissionName[] {
		if (permission === "*:*") {
			return resourceEnum.enumValues.flatMap((resource) =>
				actionEnum.enumValues.map(
					(action) => `${resource}:${action}` as PermissionName,
				),
			);
		}
		const [resource, action] = permission.split(":");
		if (!resource || !action) {
			throw this.createError(
				`Invalid permission name: ${permission}`,
				StatusCodes.BAD_REQUEST,
			);
		}
		if (action === "*") {
			return actionEnum.enumValues.map(
				(actionValue) => `${resource}:${actionValue}` as PermissionName,
			);
		}
		return [`${resource}:${action}` as PermissionName];
	}

	private createPermissionDefinition(
		permission: PermissionName,
	): PermissionDefinition {
		const [resource, action] = permission.split(":");
		if (!resourceEnum.enumValues.includes(resource)) {
			throw this.createError(
				`Unknown resource in permission: ${permission}`,
				StatusCodes.BAD_REQUEST,
			);
		}
		if (!actionEnum.enumValues.includes(action)) {
			throw this.createError(
				`Unknown action in permission: ${permission}`,
				StatusCodes.BAD_REQUEST,
			);
		}
		return {
			name: permission,
			resource: resource as (typeof resourceEnum.enumValues)[number],
			action: action as (typeof actionEnum.enumValues)[number],
			description: this.describePermission(
				resource as (typeof resourceEnum.enumValues)[number],
				action as (typeof actionEnum.enumValues)[number],
			),
		};
	}

	private describePermission(
		resource: (typeof resourceEnum.enumValues)[number],
		action: (typeof actionEnum.enumValues)[number],
	): string {
		const format = (value: string): string =>
			value
				.split("_")
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join(" ");
		return `${format(resource)} ${format(action)}`;
	}

	private async ensurePermissions(
		definitions: PermissionDefinition[],
	): Promise<Map<PermissionName, PermissionRecord>> {
		if (definitions.length === 0) {
			return new Map();
		}
		await db
			.insert(permissionsTable)
			.values(
				definitions.map((definition) => ({
					name: definition.name,
					resource: definition.resource,
					action: definition.action,
					description: definition.description ?? null,
				})),
			)
			.onConflictDoUpdate({
				target: permissionsTable.name,
				set: {
					description: sql`excluded.description`,
				},
			});
		const names = definitions.map((definition) => definition.name);
		const rows = await db
			.select()
			.from(permissionsTable)
			.where(inArray(permissionsTable.name, names));
		const map = new Map<PermissionName, PermissionRecord>();
		for (const row of rows) {
			map.set(row.name as PermissionName, row);
		}
		return map;
	}

	private async ensureRolePermissions(
		grants: PermissionGrant[],
		permissionMap: Map<PermissionName, PermissionRecord>,
	): Promise<void> {
		if (grants.length === 0) {
			return;
		}
		const records = grants.map((grant) => {
			const permission = permissionMap.get(grant.permission);
			if (!permission) {
				throw this.createError(
					`Permission not found for grant: ${grant.permission}`,
					StatusCodes.INTERNAL_SERVER_ERROR,
				);
			}
			return {
				role: grant.role,
				permissionId: permission.id,
				conditions: grant.conditions ?? null,
			};
		});
		await db
			.insert(rolePermissionsTable)
			.values(records)
			.onConflictDoUpdate({
				target: [rolePermissionsTable.role, rolePermissionsTable.permissionId],
				set: {
					conditions: sql`excluded.conditions`,
				},
			});
	}

	private matchesConditions(
		conditions: PermissionCondition | undefined,
		context?: PermissionCheckContext,
	): boolean {
		if (!conditions || Object.keys(conditions).length === 0) {
			return true;
		}
		if (!context) {
			return false;
		}
		for (const [key, value] of Object.entries(conditions)) {
			const expected = this.resolveConditionValue(value, context);
			if (expected === undefined || context[key] !== expected) {
				return false;
			}
		}
		return true;
	}

	private resolveConditionValue(
		value: string | number | boolean,
		context?: PermissionCheckContext,
	): string | number | boolean | undefined {
		if (typeof value !== "string") {
			return value;
		}
		const placeholderMatch = value.match(/^\$\{(.+)}$/);
		if (!placeholderMatch) {
			return value;
		}
		const key = placeholderMatch[1];
		return context ? context[key] : undefined;
	}

	private createError(message: string, statusCode: number): RoleServiceError {
		const error = new Error(message) as RoleServiceError;
		error.statusCode = statusCode;
		return error;
	}
}

export const roleService = new RoleService();
