// auth-service/src/db/schema.ts
// STANDARDIZED VERSION - Updated naming conventions and data types

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

// ============================================================================
// AUTH TABLES
// ============================================================================

export const auth = pgTable(
	"auth",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: varchar("email", { length: 255 }).notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		isActive: boolean("is_active").notNull().default(true),
		isDisabled: boolean("is_disabled").notNull().default(false),
		isEmailVerified: boolean("is_email_verified").notNull().default(false),
		lastLoginAt: timestamp("last_login_at", {
			withTimezone: true,
			mode: "string",
		}),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		emailIdx: index("auth_email_idx").on(table.email),
		isActiveIdx: index("auth_is_active_idx").on(table.isActive),
		emailVerifiedIdx: index("auth_email_verified_idx").on(
			table.isEmailVerified,
		),
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
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
			mode: "string",
		}).notNull(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		tokenIdx: index("refresh_tokens_token_idx").on(table.token),
		expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
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
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
			mode: "string",
		}).notNull(),
		usedAt: timestamp("used_at", {
			withTimezone: true,
			mode: "string",
		}),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		tokenIdx: index("password_resets_token_idx").on(table.token),
		userIdIdx: index("password_resets_user_id_idx").on(table.userId),
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
		ipAddress: varchar("ip_address", { length: 45 }), // IPv6 compatible
		userAgent: text("user_agent"),
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
			mode: "string",
		}).notNull(),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		userIdIdx: index("sessions_user_id_idx").on(table.userId),
		tokenIdx: index("sessions_token_idx").on(table.token),
		expiresAtIdx: index("sessions_expires_at_idx").on(table.expiresAt),
	}),
);

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

export const emailVerifications = pgTable(
	"email_verifications",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.references(() => auth.id, { onDelete: "cascade" })
			.notNull(),
		token: text("token").notNull().unique(),
		expiresAt: timestamp("expires_at", {
			withTimezone: true,
			mode: "string",
		}).notNull(),
		verifiedAt: timestamp("verified_at", {
			withTimezone: true,
			mode: "string",
		}),
		createdAt: timestamp("created_at", {
			withTimezone: true,
			mode: "string",
		})
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		tokenIdx: index("email_verifications_token_idx").on(table.token),
		userIdIdx: index("email_verifications_user_id_idx").on(table.userId),
	}),
);

// ============================================================================
// RELATIONS
// ============================================================================

export const authRelations = relations(auth, ({ many }) => ({
	refreshTokens: many(refreshTokens),
	sessions: many(sessions),
	passwordResets: many(passwordResets),
	emailVerifications: many(emailVerifications),
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

export const passwordResetsRelations = relations(passwordResets, ({ one }) => ({
	user: one(auth, {
		fields: [passwordResets.userId],
		references: [auth.id],
	}),
}));

export const emailVerificationsRelations = relations(
	emailVerifications,
	({ one }) => ({
		user: one(auth, {
			fields: [emailVerifications.userId],
			references: [auth.id],
		}),
	}),
);

// ============================================================================
// TYPES
// ============================================================================

export type Auth = typeof auth.$inferSelect;
export type NewAuth = typeof auth.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type PasswordReset = typeof passwordResets.$inferSelect;
export type NewPasswordReset = typeof passwordResets.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
