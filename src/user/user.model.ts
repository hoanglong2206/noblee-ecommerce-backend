import { relations } from "drizzle-orm";
import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	text,
	date,
	uniqueIndex,
	boolean,
	pgEnum,
	index,
} from "drizzle-orm/pg-core";

export const userGenderEnum = pgEnum("user_gender", [
	"male",
	"female",
	"other",
	"prefer_not_to_say",
]);

export const addressTypeEnum = pgEnum("address_type", ["shipping", "billing"]);

export const userProfileTable = pgTable(
	"user_profiles",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		fullName: varchar("fullname", { length: 100 }).notNull(),
		email: varchar("email", { length: 255 }).notNull(),
		phoneNumber: varchar("phone_number", { length: 20 }),
		gender: userGenderEnum("gender"),
		dateOfBirth: date("date_of_birth", { mode: "string" }),
		avatarUrl: varchar("avatar_url", { length: 255 }),
		bio: text("bio"),
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
		emailIdx: uniqueIndex("user_profiles_email_idx").on(table.email),
	}),
);

export const userAddressTable = pgTable(
	"user_addresses",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => userProfileTable.id, { onDelete: "cascade" }),
		addressType: addressTypeEnum("address_type").notNull(),
		fullName: varchar("full_name", { length: 100 }).notNull(),
		phoneNumber: varchar("phone_number", { length: 20 }),
		streetLine1: text("street_line1").notNull(),
		streetLine2: text("street_line2"),
		city: varchar("city", { length: 100 }).notNull(),
		district: varchar("district", { length: 100 }),
		ward: varchar("ward", { length: 100 }),
		postalCode: varchar("postal_code", { length: 20 }),
		country: varchar("country", { length: 100 }).notNull(),
		isDefault: boolean("is_default").notNull().default(false),
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
		userIdIdx: index("user_addresses_user_id_idx").on(table.userId),
		defaultIdx: index("user_addresses_default_idx").on(
			table.userId,
			table.isDefault,
		),
	}),
);

export type UserProfileRecord = typeof userProfileTable.$inferSelect;
export type NewUserProfileRecord = typeof userProfileTable.$inferInsert;
export type UserGender = (typeof userGenderEnum.enumValues)[number];

export type UserAddressRecord = typeof userAddressTable.$inferSelect;
export type NewUserAddressRecord = typeof userAddressTable.$inferInsert;
export type AddressType = (typeof addressTypeEnum.enumValues)[number];

export const userProfileRelations = relations(userProfileTable, ({ many }) => ({
	addresses: many(userAddressTable),
}));

export const userAddressRelations = relations(userAddressTable, ({ one }) => ({
	user: one(userProfileTable, {
		fields: [userAddressTable.userId],
		references: [userProfileTable.id],
	}),
}));
