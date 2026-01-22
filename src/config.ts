import dotenv from "dotenv";
import cloudinary from "cloudinary";

dotenv.config({});

class Config {
	public DATABASE_URL: string | undefined;
	public CORS_ORIGIN: string | undefined;
	public NODE_ENV: string | undefined;
	public PORT: string | number | undefined;
	public JWT_SECRET: string | undefined;
	public SESSION_SECRET: string | undefined;
	public RABBITMQ_ENDPOINT: string | undefined;
	public CLOUD_NAME: string | undefined;
	public CLOUD_API_KEY: string | undefined;
	public CLOUD_API_SECRET: string | undefined;

	constructor() {
		this.DATABASE_URL = process.env.DATABASE_URL || "";
		this.CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
		this.NODE_ENV = process.env.NODE_ENV || "development";
		this.PORT = process.env.PORT || 5001;
		this.JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
		this.SESSION_SECRET =
			process.env.SESSION_SECRET || "default_session_secret";
		this.RABBITMQ_ENDPOINT = process.env.RABBITMQ_ENDPOINT || "";
		this.CLOUD_NAME = process.env.CLOUD_NAME || "";
		this.CLOUD_API_KEY = process.env.CLOUD_API_KEY || "";
		this.CLOUD_API_SECRET = process.env.CLOUD_API_SECRET || "";
	}

	public cloudinaryConfig(): void {
		cloudinary.v2.config({
			cloud_name: this.CLOUD_NAME,
			api_key: this.CLOUD_API_KEY,
			api_secret: this.CLOUD_API_SECRET,
		});
	}
}

export const config: Config = new Config();
