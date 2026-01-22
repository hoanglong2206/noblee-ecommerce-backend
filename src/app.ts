import express, { Application, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import session from "express-session";
import cors from "cors";
import { config } from "./config";
import { appRoutes } from "./routes";
import http from "http";

export class App {
	private app: Application;

	constructor(app: Application) {
		this.app = app;
	}

	public start(): void {
		this.securityMiddleware(this.app);
		this.standardMiddleware(this.app);
		this.routesMiddleware(this.app);
		this.startQueues();
		this.errorHandler(this.app);
		this.startServer(this.app);
	}

	private securityMiddleware(app: Application): void {
		app.set("trust proxy", 1);
		app.use(cookieParser());
		app.use(
			session({
				secret: config.SESSION_SECRET || "default_session_secret",
				resave: false,
				saveUninitialized: true,
				cookie: {
					maxAge: 1000 * 60 * 60 * 24, // 1 day
					secure: config.NODE_ENV === "production",
				},
			}),
		);
		app.use(helmet());
		app.use(
			cors({
				origin: config.CORS_ORIGIN || "*",
				credentials: true,
				methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			}),
		);
		if (config.NODE_ENV === "development") {
			app.use(morgan("dev"));
		}
	}

	private standardMiddleware(app: Application): void {
		// Standard middlewares
		app.use(compression());
		app.use(express.json({ limit: "50mb" }));
		app.use(express.urlencoded({ limit: "50mb", extended: true }));
	}

	private routesMiddleware(app: Application): void {
		appRoutes(app);
	}

	private async startQueues(): Promise<void> {
		try {
			// Initialize your queues here
			console.log("Queues initialized successfully.");
		} catch (error) {
			console.error("Failed to initialize queues:", error);
		}
	}

	private errorHandler(app: Application): void {
		app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
			console.error(err.stack);
			res.status(500).send("Something went wrong!");

			next();
		});
	}

	private startServer(app: Application): void {
		try {
			const httpServer: http.Server = new http.Server(app);

			httpServer.listen(config.PORT, () => {
				console.log(
					`Server running in ${config.NODE_ENV} mode on port ${config.PORT}`,
				);
			});
		} catch (error) {
			console.error("Failed to start server:", error);
		}
	}
}
