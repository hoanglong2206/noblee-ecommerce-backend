import { config } from "./src/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/models/**/*.ts",
	out: "./migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: config.DATABASE_URL!,
	},
});
