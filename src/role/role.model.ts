// authorization-service/src/db/schema.ts
import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	text,
	pgEnum,
	boolean,
	jsonb,
	index,
	uniqueIndex,
	integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// RBAC (Role-Based Access Control) SCHEMA
// ============================================================================

export const resourceEnum = pgEnum("resource", [
	"user",
	"product",
	"order",
	"payment",
	"voucher",
	"category",
	"inventory",
	"report",
	"setting",
	"staff",
	"customer",
	"review",
	"audit_log",
]);

export const actionEnum = pgEnum("action", [
	"manage",
	"create",
	"read",
	"update",
	"delete",
	"approve",
	"reject",
	"export",
	"import",
	"publish",
]);

export const roles = pgTable(
	"roles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		displayName: varchar("display_name", { length: 200 }).notNull(),
		description: text("description"),
		isSystem: boolean("is_system").default(false),
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		isActiveIdx: index("roles_is_active_idx").on(table.isActive),
	}),
);

export const permissions = pgTable(
	"permissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		displayName: varchar("display_name", { length: 200 }).notNull(),
		description: text("description"),
		resource: resourceEnum("resource").notNull(),
		action: actionEnum("action").notNull(),
		isActive: boolean("is_active").default(true),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		resourceActionIdx: index("permissions_resource_action_idx").on(
			table.resource,
			table.action,
		),
	}),
);

export const rolePermissions = pgTable(
	"role_permissions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		roleId: uuid("role_id")
			.references(() => roles.id, { onDelete: "cascade" })
			.notNull(),
		permissionId: uuid("permission_id")
			.references(() => permissions.id, { onDelete: "cascade" })
			.notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		rolePermissionIdx: uniqueIndex("role_permissions_unique_idx").on(
			table.roleId,
			table.permissionId,
		),
		roleIdIdx: index("role_permissions_role_id_idx").on(table.roleId),
		permissionIdIdx: index("role_permissions_permission_id_idx").on(
			table.permissionId,
		),
	}),
);

export const userRoles = pgTable(
	"user_roles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(), // Reference to auth service
		roleId: uuid("role_id")
			.references(() => roles.id, { onDelete: "cascade" })
			.notNull(),
		assignedBy: uuid("assigned_by"), // User ID who assigned this role
		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
		expiresAt: timestamp("expires_at"), // Optional: time-limited roles
		isActive: boolean("is_active").default(true),
	},
	(table) => ({
		userRoleIdx: uniqueIndex("user_roles_unique_idx").on(
			table.userId,
			table.roleId,
		),
		userIdIdx: index("user_roles_user_id_idx").on(table.userId),
		roleIdIdx: index("user_roles_role_id_idx").on(table.roleId),
	}),
);

// ============================================================================
// ABAC (Attribute-Based Access Control) SCHEMA
// ============================================================================

// export const policyEffectEnum = pgEnum("policy_effect", ["allow", "deny"]);
// export const conditionOperatorEnum = pgEnum("condition_operator", [
// 	"equals",
// 	"not_equals",
// 	"in",
// 	"not_in",
// 	"greater_than",
// 	"less_than",
// 	"greater_than_or_equal",
// 	"less_than_or_equal",
// 	"contains",
// 	"not_contains",
// 	"starts_with",
// 	"ends_with",
// 	"exists",
// 	"not_exists",
// 	"matches_regex",
// ]);

// export const abacPolicies = pgTable(
// 	"abac_policies",
// 	{
// 		id: uuid("id").defaultRandom().primaryKey(),
// 		name: varchar("name", { length: 200 }).notNull(),
// 		description: text("description"),
// 		effect: policyEffectEnum("effect").notNull().default("allow"),

// 		resource: resourceEnum("resource").notNull(),
// 		actions: text("actions").notNull(),

// 		priority: integer("priority").default(0),
// 		conditions: jsonb("conditions").notNull(),

// 		isActive: boolean("is_active").default(true),
// 		createdBy: uuid("created_by").notNull(),
// 		createdAt: timestamp("created_at").defaultNow().notNull(),
// 		updatedAt: timestamp("updated_at").defaultNow().notNull(),
// 	},
// 	(table) => ({
// 		resourceIdx: index("abac_policies_resource_idx").on(table.resource),
// 		priorityIdx: index("abac_policies_priority_idx").on(table.priority),
// 	}),
// );

// export const policyAssignments = pgTable(
// 	"policy_assignments",
// 	{
// 		id: uuid("id").defaultRandom().primaryKey(),
// 		policyId: uuid("policy_id")
// 			.references(() => abacPolicies.id, { onDelete: "cascade" })
// 			.notNull(),

// 		// Có thể gán cho role hoặc user cụ thể
// 		roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
// 		userId: uuid("user_id"), // Direct user assignment

// 		assignedBy: uuid("assigned_by").notNull(),
// 		assignedAt: timestamp("assigned_at").defaultNow().notNull(),
// 		expiresAt: timestamp("expires_at"),
// 		isActive: boolean("is_active").default(true),
// 	},
// 	(table) => ({
// 		policyIdIdx: index("policy_assignments_policy_id_idx").on(table.policyId),
// 		roleIdIdx: index("policy_assignments_role_id_idx").on(table.roleId),
// 		userIdIdx: index("policy_assignments_user_id_idx").on(table.userId),
// 	}),
// );

// ============================================================================
// ATTRIBUTE SCHEMA
// ============================================================================

// export const attributeDataTypeEnum = pgEnum("attribute_data_type", [
// 	"string",
// 	"number",
// 	"boolean",
// 	"datetime",
// 	"json",
// ]);

// export const attributes = pgTable(
// 	"attributes",
// 	{
// 		id: uuid("id").defaultRandom().primaryKey(),
// 		key: varchar("key", { length: 100 }).notNull(),
// 		name: varchar("name", { length: 200 }).notNull(),
// 		description: text("description"),

// 		entityType: resourceEnum("entity_type").notNull(),
// 		dataType: attributeDataTypeEnum("data_type").default("string").notNull(),

// 		isSystem: boolean("is_system").default(false),
// 		isActive: boolean("is_active").default(true),

// 		createdAt: timestamp("created_at").defaultNow().notNull(),
// 		updatedAt: timestamp("updated_at").defaultNow().notNull(),
// 	},
// 	(table) => ({
// 		attributeKeyIdx: uniqueIndex("attributes_key_entity_idx").on(
// 			table.key,
// 			table.entityType,
// 		),
// 	}),
// );

// export const entityAttributeValues = pgTable(
// 	"entity_attribute_values",
// 	{
// 		id: uuid("id").defaultRandom().primaryKey(),

// 		attributeId: uuid("attribute_id")
// 			.references(() => attributes.id, { onDelete: "cascade" })
// 			.notNull(),

// 		entityId: uuid("entity_id").notNull(),

// 		value: text("value").notNull(),

// 		createdAt: timestamp("created_at").defaultNow().notNull(),
// 		updatedAt: timestamp("updated_at").defaultNow().notNull(),
// 		updatedBy: uuid("updated_by"),
// 	},
// 	(table) => ({
// 		entityAttrUniqueIdx: uniqueIndex("entity_attr_values_unique_idx").on(
// 			table.entityId,
// 			table.attributeId,
// 		),
// 		entityIdIdx: index("entity_attr_values_entity_id_idx").on(table.entityId),
// 	}),
// );

// ============================================================================
// RELATIONS
// ============================================================================

export const rolesRelations = relations(roles, ({ many }) => ({
	rolePermissions: many(rolePermissions),
	userRoles: many(userRoles),
	// policyAssignments: many(policyAssignments),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
	rolePermissions: many(rolePermissions),
}));

export const rolePermissionsRelations = relations(
	rolePermissions,
	({ one }) => ({
		role: one(roles, {
			fields: [rolePermissions.roleId],
			references: [roles.id],
		}),
		permission: one(permissions, {
			fields: [rolePermissions.permissionId],
			references: [permissions.id],
		}),
	}),
);

// export const userRolesRelations = relations(userRoles, ({ one }) => ({
// 	role: one(roles, {
// 		fields: [userRoles.roleId],
// 		references: [roles.id],
// 	}),
// }));

// export const abacPoliciesRelations = relations(abacPolicies, ({ many }) => ({
// 	assignments: many(policyAssignments),
// }));

// export const policyAssignmentsRelations = relations(
// 	policyAssignments,
// 	({ one }) => ({
// 		policy: one(abacPolicies, {
// 			fields: [policyAssignments.policyId],
// 			references: [abacPolicies.id],
// 		}),
// 		role: one(roles, {
// 			fields: [policyAssignments.roleId],
// 			references: [roles.id],
// 		}),
// 	}),
// );

// export const attributesRelations = relations(attributes, ({ many }) => ({
// 	values: many(entityAttributeValues),
// }));

// export const entityAttributeValuesRelations = relations(
// 	entityAttributeValues,
// 	({ one }) => ({
// 		definition: one(attributes, {
// 			fields: [entityAttributeValues.attributeId],
// 			references: [attributes.id],
// 		}),
// 	}),
// );

// ============================================================================
// TYPES
// ============================================================================

export type ActionValue = (typeof actionEnum.enumValues)[number];
export type ResourceValue = (typeof resourceEnum.enumValues)[number];

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleRecord = Role;

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type PermissionRecord = Permission;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type RolePermissionRecord = RolePermission;

export type UserRole = typeof userRoles.$inferSelect;
export type UserRoleRecord = UserRole;
export type NewUserRole = typeof userRoles.$inferInsert;

// export type AbacPolicy = typeof abacPolicies.$inferSelect;
// export type NewAbacPolicy = typeof abacPolicies.$inferInsert;
// export type PolicyAssignment = typeof policyAssignments.$inferSelect;

// export type Attribute = typeof attributes.$inferSelect;
// export type NewAttribute = typeof attributes.$inferInsert;
// export type EntityAttributeValue = typeof entityAttributeValues.$inferSelect;
// export type NewEntityAttributeValue = typeof entityAttributeValues.$inferInsert;
