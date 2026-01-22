import express, { Express } from "express";
import { dbConnection } from "./database";
import { App } from "./app";
import { config } from "./config";

class Server {
	public start(): void {
		const app: Express = express();
		const application: App = new App(app);
		config.cloudinaryConfig();
		dbConnection();
		application.start();
	}
}

const server: Server = new Server();
server.start();
