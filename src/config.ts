import dotenv from "dotenv";
import cloudinary from "cloudinary";

dotenv.config({});

class Config {
	public DATABASE_URL: string | undefined;
	public CORS_ORIGIN: string | undefined;
	public NODE_ENV: string | undefined;
	public PORT: string | number | undefined;
	public JWT_SECRET: string | undefined;
	public JWT_REFRESH_SECRET: string | undefined;
	public JWT_ACCESS_EXPIRES_IN: string | undefined;
	public JWT_REFRESH_EXPIRES_IN: string | undefined;
	public SESSION_SECRET: string | undefined;
	public RABBITMQ_ENDPOINT: string | undefined;
	public CLOUD_NAME: string | undefined;
	public CLOUD_API_KEY: string | undefined;
	public CLOUD_API_SECRET: string | undefined;
	public REDIS_HOST: string | undefined;
	public REDIS_PORT: number | undefined;
	public REDIS_USERNAME: string | undefined;
	public REDIS_PASSWORD: string | undefined;
	public REDIS_TLS: boolean;

	public SMTP_HOST: string | undefined;
	public SMTP_PORT: number | undefined;
	public SMTP_SECURE: boolean;
	public SMTP_USER: string | undefined;
	public SMTP_PASSWORD: string | undefined;
	public SMTP_FROM: string | undefined;
	public OTP_EXPIRATION_MINUTES: number;
	public OTP_RATE_LIMIT_WINDOW: number;
	public OTP_MAX_REQUESTS: number;
	public OTP_MAX_VERIFICATION_ATTEMPTS: number;

	constructor() {
		this.DATABASE_URL = process.env.DATABASE_URL || "";
		this.CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
		this.NODE_ENV = process.env.NODE_ENV || "development";
		this.PORT = process.env.PORT || 5001;
		this.JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret";
		this.JWT_REFRESH_SECRET =
			process.env.JWT_REFRESH_SECRET || this.JWT_SECRET || "default_jwt_secret";
		this.JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
		this.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
		this.SESSION_SECRET =
			process.env.SESSION_SECRET || "default_session_secret";
		this.RABBITMQ_ENDPOINT = process.env.RABBITMQ_ENDPOINT || "";
		this.CLOUD_NAME = process.env.CLOUD_NAME || "";
		this.CLOUD_API_KEY = process.env.CLOUD_API_KEY || "";
		this.CLOUD_API_SECRET = process.env.CLOUD_API_SECRET || "";

		this.REDIS_HOST = process.env.REDIS_HOST || "";
		this.REDIS_PORT = Number(process.env.REDIS_PORT) || 0;
		this.REDIS_USERNAME = process.env.REDIS_USERNAME || "";
		this.REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";
		this.REDIS_TLS =
			(process.env.REDIS_TLS || "false").toLowerCase() === "true";
		this.SMTP_HOST = process.env.SMTP_HOST || "";
		this.SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
		this.SMTP_SECURE =
			(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
		this.SMTP_USER = process.env.SMTP_USER || "";
		this.SMTP_PASSWORD = process.env.SMTP_PASSWORD || "";
		this.SMTP_FROM = process.env.SMTP_FROM || this.SMTP_USER || "";
		this.OTP_EXPIRATION_MINUTES =
			Number(process.env.OTP_EXPIRATION_MINUTES) || 5;
		this.OTP_RATE_LIMIT_WINDOW =
			Number(process.env.OTP_RATE_LIMIT_WINDOW) || 300;
		this.OTP_MAX_REQUESTS = Number(process.env.OTP_MAX_REQUESTS) || 5;
		this.OTP_MAX_VERIFICATION_ATTEMPTS =
			Number(process.env.OTP_MAX_VERIFICATION_ATTEMPTS) || 5;
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
