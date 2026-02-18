import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { db } from "../database";
import {
	RoleRecord,
	PermissionRecord,
	roles,
	permissions,
	rolePermissions,
	userRoles,
	ResourceValue,
	ActionValue,
	resourceEnum,
	actionEnum,
} from "./role.model";
import {
	CreatePermissionDTO,
	CreateRoleDTO,
	PermissionName,
	PermissionResponse,
	RoleResponse,
	UpdatePermissionDTO,
	UpdateRoleDTO,
} from "./role.interface";

type RoleServiceError = Error & { statusCode?: number };

type SelectClient = Pick<typeof db, "select">;

class RoleService {
	public async listRoles(): Promise<RoleResponse[]> {
		const roleRecords = await db
			.select()
			.from(roles)
			.orderBy(asc(roles.displayName));
		if (!roleRecords.length) {
			return [];
		}
		const roleIds = roleRecords.map((role) => role.id);
		const [permissionMap, userCounts] = await Promise.all([
			this.getPermissionsByRole(roleIds),
			this.getUserCounts(roleIds),
		]);
		return roleRecords.map((role) =>
			this.buildRoleResponse(
				role,
				permissionMap.get(role.id) ?? [],
				userCounts.get(role.id) ?? 0,
			),
		);
	}

	public async getRole(roleId: string): Promise<RoleResponse> {
		const role = await this.requireRole(roleId);
		const [permissionsForRole, userCount] = await Promise.all([
			this.getPermissionsForRole(roleId),
			this.getUserCount(roleId),
		]);
		return this.buildRoleResponse(role, permissionsForRole, userCount);
	}

	public async createRole(payload: CreateRoleDTO): Promise<RoleResponse> {
		const displayName = this.toRequiredTrim(payload.displayName);
		let createdRoleId: string | undefined;
		try {
			await db.transaction(async (tx) => {
				await this.ensureRoleNameUnique(tx, displayName);
				const [inserted] = await tx
					.insert(roles)
					.values({
						displayName,
						description: this.toNullable(payload.description),
						isSystem: payload.isSystem ?? false,
						isActive: payload.isActive ?? true,
					})
					.returning();
				if (!inserted) {
					throw this.createError(
						"Failed to create role.",
						StatusCodes.INTERNAL_SERVER_ERROR,
					);
				}
				createdRoleId = inserted.id;
				const resolvedPermissions = await this.resolvePermissions(
					tx,
					payload.permissionIds,
					payload.permissionNames,
				);
				if (resolvedPermissions.length) {
					await tx
						.insert(rolePermissions)
						.values(
							resolvedPermissions.map((permission) => ({
								roleId: inserted.id,
								permissionId: permission.id,
							})),
						)
						.onConflictDoNothing();
				}
			});
		} catch (error) {
			this.handleDatabaseError(
				error,
				"Role with the same name already exists.",
			);
		}
		const roleId = this.ensureId(createdRoleId);
		return this.getRole(roleId);
	}

	public async updateRole(
		roleId: string,
		payload: UpdateRoleDTO,
	): Promise<RoleResponse> {
		await db.transaction(async (tx) => {
			await this.requireRole(roleId, tx);
			const updates: Partial<RoleRecord> = {};
			let hasUpdates = false;
			if (payload.displayName !== undefined) {
				const trimmedName = this.toRequiredTrim(payload.displayName);
				await this.ensureRoleNameUnique(tx, trimmedName, roleId);
				updates.displayName = trimmedName;
				hasUpdates = true;
			}
			if (payload.description !== undefined) {
				updates.description = this.toNullable(payload.description);
				hasUpdates = true;
			}
			if (payload.isSystem !== undefined) {
				updates.isSystem = payload.isSystem;
				hasUpdates = true;
			}
			if (payload.isActive !== undefined) {
				updates.isActive = payload.isActive;
				hasUpdates = true;
			}
			if (hasUpdates) {
				await tx.update(roles).set(updates).where(eq(roles.id, roleId));
			}
			const shouldSyncPermissions =
				payload.permissionIds !== undefined ||
				payload.permissionNames !== undefined;
			if (shouldSyncPermissions) {
				const resolvedPermissions = await this.resolvePermissions(
					tx,
					payload.permissionIds,
					payload.permissionNames,
				);
				await tx
					.delete(rolePermissions)
					.where(eq(rolePermissions.roleId, roleId));
				if (resolvedPermissions.length) {
					await tx
						.insert(rolePermissions)
						.values(
							resolvedPermissions.map((permission) => ({
								roleId,
								permissionId: permission.id,
							})),
						)
						.onConflictDoNothing();
				}
			}
		});
		return this.getRole(roleId);
	}

	public async deleteRole(roleId: string): Promise<void> {
		const role = await this.requireRole(roleId);
		if (role.isSystem) {
			throw this.createError(
				"System roles cannot be deleted.",
				StatusCodes.FORBIDDEN,
			);
		}
		await db.delete(roles).where(eq(roles.id, roleId));
	}

	public async listPermissions(): Promise<PermissionResponse[]> {
		const records = await db
			.select()
			.from(permissions)
			.orderBy(asc(permissions.resource), asc(permissions.action));
		return records.map((record) => this.buildPermissionResponse(record));
	}

	public async getPermission(
		permissionId: string,
	): Promise<PermissionResponse> {
		const record = await this.requirePermission(permissionId);
		return this.buildPermissionResponse(record);
	}

	public async createPermission(
		payload: CreatePermissionDTO,
	): Promise<PermissionResponse> {
		await this.ensurePermissionUnique(payload.resource, payload.action);
		const [inserted] = await db
			.insert(permissions)
			.values({
				displayName: this.toRequiredTrim(payload.displayName),
				description: this.toNullable(payload.description),
				resource: payload.resource,
				action: payload.action,
				isActive: payload.isActive ?? true,
			})
			.returning();
		if (!inserted) {
			throw this.createError(
				"Failed to create permission.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return this.buildPermissionResponse(inserted);
	}

	public async updatePermission(
		permissionId: string,
		payload: UpdatePermissionDTO,
	): Promise<PermissionResponse> {
		const current = await this.requirePermission(permissionId);
		const updates: Partial<PermissionRecord> = {};
		let hasUpdates = false;
		if (payload.displayName !== undefined) {
			updates.displayName = this.toRequiredTrim(payload.displayName);
			hasUpdates = true;
		}
		if (payload.description !== undefined) {
			updates.description = this.toNullable(payload.description);
			hasUpdates = true;
		}
		const nextResource = payload.resource ?? current.resource;
		const nextAction = payload.action ?? current.action;
		const resourceChanged = payload.resource !== undefined;
		const actionChanged = payload.action !== undefined;
		if (resourceChanged || actionChanged) {
			await this.ensurePermissionUnique(nextResource, nextAction, permissionId);
			updates.resource = nextResource;
			updates.action = nextAction;
			hasUpdates = true;
		}
		if (payload.isActive !== undefined) {
			updates.isActive = payload.isActive;
			hasUpdates = true;
		}
		if (!hasUpdates) {
			return this.buildPermissionResponse(current);
		}
		const [updated] = await db
			.update(permissions)
			.set(updates)
			.where(eq(permissions.id, permissionId))
			.returning();
		if (!updated) {
			throw this.createError("Permission not found.", StatusCodes.NOT_FOUND);
		}
		return this.buildPermissionResponse(updated);
	}

	public async deletePermission(permissionId: string): Promise<void> {
		await this.requirePermission(permissionId);
		const assignments = await db
			.select({ total: sql<number>`count(*)` })
			.from(rolePermissions)
			.where(eq(rolePermissions.permissionId, permissionId));
		const assignedTotal = Number(assignments[0]?.total ?? 0);
		if (assignedTotal > 0) {
			throw this.createError(
				"Permission is assigned to one or more roles.",
				StatusCodes.CONFLICT,
			);
		}
		await db.delete(permissions).where(eq(permissions.id, permissionId));
	}

	private async resolvePermissions(
		client: SelectClient,
		permissionIds?: string[],
		permissionNames?: PermissionName[],
	): Promise<PermissionRecord[]> {
		const idSet = new Set(
			(permissionIds ?? [])
				.map((value) => value.trim())
				.filter((value) => value.length > 0),
		);
		const nameTuples = (permissionNames ?? [])
			.map((name) => name.trim())
			.filter((name): name is PermissionName => name.length > 0)
			.map((name) => this.parsePermissionName(name));
		if (!idSet.size && !nameTuples.length) {
			return [];
		}
		let records: PermissionRecord[] = [];
		if (idSet.size && nameTuples.length) {
			records = await client
				.select()
				.from(permissions)
				.where(
					or(
						inArray(permissions.id, Array.from(idSet)),
						...nameTuples.map((tuple) =>
							and(
								eq(permissions.resource, tuple.resource),
								eq(permissions.action, tuple.action),
							),
						),
					),
				);
		} else if (idSet.size) {
			records = await client
				.select()
				.from(permissions)
				.where(inArray(permissions.id, Array.from(idSet)));
		} else {
			const tupleConditions = nameTuples.map((tuple) =>
				and(
					eq(permissions.resource, tuple.resource),
					eq(permissions.action, tuple.action),
				),
			);
			const combinedCondition =
				tupleConditions.length === 1
					? tupleConditions[0]
					: or(...tupleConditions);
			records = await client
				.select()
				.from(permissions)
				.where(combinedCondition);
		}
		const uniqueRecords = new Map<string, PermissionRecord>();
		records.forEach((record) => {
			uniqueRecords.set(record.id, record);
		});
		if (idSet.size) {
			const missingIds = Array.from(idSet).filter(
				(id) => !uniqueRecords.has(id),
			);
			if (missingIds.length) {
				throw this.createError(
					`Unknown permission ids: ${missingIds.join(", ")}.`,
					StatusCodes.BAD_REQUEST,
				);
			}
		}
		if (nameTuples.length) {
			const availableNames = new Set(
				Array.from(uniqueRecords.values()).map((record) =>
					this.buildPermissionName(record.resource, record.action),
				),
			);
			const missingNames = nameTuples
				.map((tuple) => this.buildPermissionName(tuple.resource, tuple.action))
				.filter((name) => !availableNames.has(name));
			if (missingNames.length) {
				throw this.createError(
					`Unknown permissions: ${missingNames.join(", ")}.`,
					StatusCodes.BAD_REQUEST,
				);
			}
		}
		return Array.from(uniqueRecords.values());
	}

	private async requireRole(
		roleId: string,
		client: SelectClient = db,
	): Promise<RoleRecord> {
		const result = await client
			.select()
			.from(roles)
			.where(eq(roles.id, roleId))
			.limit(1);
		const role = result[0];
		if (!role) {
			throw this.createError("Role not found.", StatusCodes.NOT_FOUND);
		}
		return role;
	}

	private async requirePermission(
		permissionId: string,
	): Promise<PermissionRecord> {
		const result = await db
			.select()
			.from(permissions)
			.where(eq(permissions.id, permissionId))
			.limit(1);
		const permission = result[0];
		if (!permission) {
			throw this.createError("Permission not found.", StatusCodes.NOT_FOUND);
		}
		return permission;
	}

	private async ensurePermissionUnique(
		resource: ResourceValue,
		action: ActionValue,
		excludeId?: string,
	): Promise<void> {
		const conditions = [
			eq(permissions.resource, resource),
			eq(permissions.action, action),
		];
		if (excludeId) {
			conditions.push(ne(permissions.id, excludeId));
		}
		const existing = await db
			.select({ id: permissions.id })
			.from(permissions)
			.where(and(...conditions))
			.limit(1);
		if (existing[0]) {
			throw this.createError(
				"Permission with the same resource and action already exists.",
				StatusCodes.CONFLICT,
			);
		}
	}

	private async ensureRoleNameUnique(
		client: SelectClient,
		displayName: string,
		excludeId?: string,
	): Promise<void> {
		const condition = excludeId
			? and(eq(roles.displayName, displayName), ne(roles.id, excludeId))
			: eq(roles.displayName, displayName);
		const existing = await client
			.select({ id: roles.id })
			.from(roles)
			.where(condition)
			.limit(1);
		if (existing[0]) {
			throw this.createError(
				"Role with the same name already exists.",
				StatusCodes.CONFLICT,
			);
		}
	}

	private handleDatabaseError(error: unknown, duplicateMessage: string): never {
		if (this.isRoleServiceError(error)) {
			throw error;
		}
		if (this.isUniqueViolation(error)) {
			throw this.createError(duplicateMessage, StatusCodes.CONFLICT);
		}
		throw error instanceof Error
			? error
			: this.createError(
					"Unexpected database error.",
					StatusCodes.INTERNAL_SERVER_ERROR,
				);
	}

	private isRoleServiceError(error: unknown): error is RoleServiceError {
		return (
			typeof error === "object" &&
			error !== null &&
			"statusCode" in error &&
			typeof (error as { statusCode?: unknown }).statusCode === "number"
		);
	}

	private isUniqueViolation(error: unknown): boolean {
		const pgError = this.extractPostgresError(error);
		return typeof pgError?.code === "string" && pgError.code === "23505";
	}

	private extractPostgresError(error: unknown): { code?: string } | undefined {
		if (!error || typeof error !== "object") {
			return undefined;
		}
		if (
			"code" in error &&
			typeof (error as { code?: unknown }).code === "string"
		) {
			return error as { code?: string };
		}
		if ("cause" in error) {
			return this.extractPostgresError((error as { cause?: unknown }).cause);
		}
		return undefined;
	}

	private async getPermissionsForRole(
		roleId: string,
	): Promise<PermissionResponse[]> {
		const map = await this.getPermissionsByRole([roleId]);
		return map.get(roleId) ?? [];
	}

	private async getPermissionsByRole(
		roleIds: string[],
	): Promise<Map<string, PermissionResponse[]>> {
		if (!roleIds.length) {
			return new Map();
		}
		const rows = await db
			.select({
				roleId: rolePermissions.roleId,
				permission: permissions,
			})
			.from(rolePermissions)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(inArray(rolePermissions.roleId, roleIds));
		const map = new Map<string, PermissionResponse[]>();
		for (const row of rows) {
			const current = map.get(row.roleId) ?? [];
			current.push(this.buildPermissionResponse(row.permission));
			map.set(row.roleId, current);
		}
		for (const [key, list] of map.entries()) {
			list.sort((a, b) => a.name.localeCompare(b.name));
			map.set(key, list);
		}
		return map;
	}

	private async getUserCount(roleId: string): Promise<number> {
		const map = await this.getUserCounts([roleId]);
		return map.get(roleId) ?? 0;
	}

	private async getUserCounts(roleIds: string[]): Promise<Map<string, number>> {
		if (!roleIds.length) {
			return new Map();
		}
		const rows = await db
			.select({
				roleId: userRoles.roleId,
				total: sql<number>`count(*)`,
			})
			.from(userRoles)
			.where(inArray(userRoles.roleId, roleIds))
			.groupBy(userRoles.roleId);
		const map = new Map<string, number>();
		rows.forEach((row) => {
			map.set(row.roleId, Number(row.total ?? 0));
		});
		return map;
	}

	private buildRoleResponse(
		role: RoleRecord,
		permissionsForRole: PermissionResponse[],
		userCount: number,
	): RoleResponse {
		const permissionNames = permissionsForRole.map(
			(permission) => permission.name,
		);
		permissionNames.sort();
		const permissionDetails = [...permissionsForRole].sort((a, b) =>
			a.name.localeCompare(b.name),
		);
		return {
			id: role.id,
			name: role.displayName,
			description: role.description ?? null,
			isSystem: role.isSystem ?? false,
			isActive: role.isActive ?? false,
			userCount,
			permissions: permissionNames,
			permissionDetails,
			createdAt: this.toIsoString(role.createdAt),
			color: this.deriveColor(role.displayName),
		};
	}

	private buildPermissionResponse(
		record: PermissionRecord,
	): PermissionResponse {
		return {
			id: record.id,
			displayName: record.displayName,
			description: record.description ?? null,
			resource: record.resource,
			action: record.action,
			isActive: record.isActive ?? false,
			name: this.buildPermissionName(record.resource, record.action),
			createdAt: this.toIsoString(record.createdAt),
		};
	}

	private parsePermissionName(value: string): {
		resource: ResourceValue;
		action: ActionValue;
	} {
		const [resourceRaw, actionRaw] = value
			.split(":")
			.map((segment) => segment.trim());
		if (!resourceRaw || !actionRaw) {
			throw this.createError(
				`Invalid permission name: ${value}. Expected format resource:action.`,
				StatusCodes.BAD_REQUEST,
			);
		}
		const resource = resourceRaw as ResourceValue;
		const action = actionRaw as ActionValue;
		if (!this.isValidResource(resource) || !this.isValidAction(action)) {
			throw this.createError(
				`Invalid permission name: ${value}.`,
				StatusCodes.BAD_REQUEST,
			);
		}
		return { resource, action };
	}

	private buildPermissionName(
		resource: ResourceValue,
		action: ActionValue,
	): PermissionName {
		return `${resource}:${action}` as PermissionName;
	}

	private isValidResource(value: string): value is ResourceValue {
		return resourceEnum.enumValues.includes(value as ResourceValue);
	}

	private isValidAction(value: string): value is ActionValue {
		return actionEnum.enumValues.includes(value as ActionValue);
	}

	private deriveColor(input: string): string {
		const normalized = input.trim().toLowerCase();
		let hash = 0;
		for (let index = 0; index < normalized.length; index += 1) {
			hash = (hash * 31 + normalized.charCodeAt(index)) % 360;
		}
		const hue = Math.abs(hash % 360);
		return `hsl(${hue}, 70%, 50%)`;
	}

	private toRequiredTrim(value: string): string {
		const trimmed = value.trim();
		if (!trimmed) {
			throw this.createError("Value cannot be empty.", StatusCodes.BAD_REQUEST);
		}
		return trimmed;
	}

	private toNullable(value?: string | null): string | null {
		if (value === undefined || value === null) {
			return null;
		}
		const trimmed = value.trim();
		return trimmed.length ? trimmed : null;
	}

	private toIsoString(value: Date | string): string {
		if (value instanceof Date) {
			return value.toISOString();
		}
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime())
			? new Date().toISOString()
			: parsed.toISOString();
	}

	private createError(message: string, statusCode: number): RoleServiceError {
		const error = new Error(message) as RoleServiceError;
		error.statusCode = statusCode;
		return error;
	}

	private ensureId(value: string | undefined): string {
		if (!value) {
			throw this.createError(
				"Failed to resolve role identifier.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return value;
	}
}

export const roleService = new RoleService();
