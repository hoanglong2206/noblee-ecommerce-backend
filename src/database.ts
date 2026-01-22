import { config } from "./config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!config.DATABASE_URL) {
	throw new Error("DATABASE_URL is not set. Check your environment variables.");
}

const client = postgres(config.DATABASE_URL, { prepare: false });
export const db = drizzle({ client });

export async function dbConnection(): Promise<void> {
	try {
		await client`SELECT 1`;
		console.log("Connected to the database successfully.");
	} catch (error) {
		console.error("Failed to connect to the database:", error);
		throw error;
	}
}
