import {
	jsonb,
	pgEnum,
	pgTable,
	timestamp,
	text,
	uuid,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
	"super_admin",
	"admin",
	"manager",
	"support",
	"customer",
]);

export const resourceEnum = pgEnum("resource", [
	"products",
	"categories",
	"orders",
	"coupons",
	"transactions",
	"customers",
	"staff",
	"reports",
	"audit_logs",
]);

export const actionEnum = pgEnum("action", [
	"list",
	"create",
	"read",
	"update",
	"delete",
	"export",
	"approve",
	"reject",
]);

export const permissionsTable = pgTable(
	"permissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		resource: resourceEnum("resource").notNull(),
		action: actionEnum("action").notNull(),
		name: varchar("name", { length: 100 }).notNull(),
		description: text("description"),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		nameUnique: uniqueIndex("permissions_name_unique").on(table.name),
	}),
);

export const rolePermissionsTable = pgTable(
	"role_permissions",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		role: roleEnum("role").notNull(),
		permissionId: uuid("permission_id")
			.notNull()
			.references(() => permissionsTable.id, { onDelete: "cascade" }),
		conditions: jsonb("conditions"),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		rolePermissionUnique: uniqueIndex(
			"role_permission_role_permission_unique",
		).on(table.role, table.permissionId),
	}),
);

export type RoleValue = (typeof roleEnum.enumValues)[number];
export type ResourceValue = (typeof resourceEnum.enumValues)[number];
export type ActionValue = (typeof actionEnum.enumValues)[number];
export type PermissionRecord = typeof permissionsTable.$inferSelect;
export type NewPermissionRecord = typeof permissionsTable.$inferInsert;
export type RolePermissionRecord = typeof rolePermissionsTable.$inferSelect;
export type NewRolePermissionRecord = typeof rolePermissionsTable.$inferInsert;
