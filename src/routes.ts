import { Application } from "express";
import { authRoutes } from "./auth/auth.route";
import { userRoutes } from "./user/user.route";
import { authorizationRoutes } from "./role/role.route";

const BASE_API = "/api";
export const appRoutes = (app: Application) => {
	app.get("/", (_req, res) => {
		res.status(200).send("API is running...");
	});
	app.use(`${BASE_API}/auth`, authRoutes.routes());
	app.use(`${BASE_API}/users`, userRoutes.routes());
	app.use(`${BASE_API}/roles`, authorizationRoutes.roles());
	app.use(`${BASE_API}/permissions`, authorizationRoutes.permissions());
};
