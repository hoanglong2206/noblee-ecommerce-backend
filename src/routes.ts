import { Application } from "express";

const BASE_API = "/api";
export const appRoutes = (app: Application) => {
	app.get("/", (_req, res) => {
		res.status(200).send("API is running...");
	});
};
