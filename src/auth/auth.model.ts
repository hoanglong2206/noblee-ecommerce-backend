import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	boolean,
	integer,
	uniqueIndex,
	text,
} from "drizzle-orm/pg-core";

export const authTable = pgTable(
	"auth",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		fullname: varchar("fullname", { length: 100 }).notNull(),
		username: varchar("username", { length: 60 }).notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		passwordHash: varchar("password_hash", { length: 255 }).notNull(),
		isVerified: boolean("is_verified").notNull().default(false),
		tokenVersion: integer("token_version").notNull().default(0),
		profilePicture: text("profile_picture"),
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
		emailUnique: uniqueIndex("auth_email_unique").on(table.email),
		usernameUnique: uniqueIndex("auth_username_unique").on(table.username),
	}),
);

export type AuthRecord = typeof authTable.$inferSelect;
export type NewAuthRecord = typeof authTable.$inferInsert;
