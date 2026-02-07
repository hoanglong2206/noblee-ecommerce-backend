// auth-service/src/db/schema.ts
import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	boolean,
	text,
	index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tables
export const auth = pgTable(
	"auth",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		fullname: varchar("full_name", { length: 255 }).notNull(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		role: varchar("role", { length: 50 }).notNull().default("customer"),
		isActive: boolean("is_active").notNull().default(true),
		isDisabled: boolean("is_disabled").notNull().default(false),
		isEmailVerified: boolean("is_email_verified").notNull().default(false),
		lastLoginAt: timestamp("last_login_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => ({
		emailIdx: index("email_idx").on(table.email),
		roleIdx: index("role_idx").on(table.role),
	}),
);

export const refreshTokens = pgTable(
	"refresh_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.references(() => auth.id, { onDelete: "cascade" })
			.notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		tokenIdx: index("refresh_tokens_token_idx").on(table.token),
	}),
);

export const passwordResets = pgTable(
	"password_resets",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.references(() => auth.id, { onDelete: "cascade" })
			.notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at").notNull(),
		usedAt: timestamp("used_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		tokenIdx: index("password_resets_token_idx").on(table.token),
	}),
);

export const sessions = pgTable(
	"sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.references(() => auth.id, { onDelete: "cascade" })
			.notNull(),
		token: text("token").notNull().unique(),
		ipAddress: varchar("ip_address", { length: 45 }),
		userAgent: text("user_agent"),
		expiresAt: timestamp("expires_at").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		userIdIdx: index("sessions_user_id_idx").on(table.userId),
		tokenIdx: index("sessions_token_idx").on(table.token),
	}),
);

// Relations
export const authRelations = relations(auth, ({ many }) => ({
	refreshTokens: many(refreshTokens),
	sessions: many(sessions),
	passwordResets: many(passwordResets),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
	user: one(auth, {
		fields: [refreshTokens.userId],
		references: [auth.id],
	}),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(auth, {
		fields: [sessions.userId],
		references: [auth.id],
	}),
}));

// Types
export type Auth = typeof auth.$inferSelect;
export type NewAuth = typeof auth.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type PasswordReset = typeof passwordResets.$inferSelect;
