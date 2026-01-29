import { Application } from "express";
import { authRoutes } from "./auth/auth.route";

const BASE_API = "/api";
export const appRoutes = (app: Application) => {
	app.get("/", (_req, res) => {
		res.status(200).send("API is running...");
	});
	app.use(`${BASE_API}/auth`, authRoutes.routes());
};
