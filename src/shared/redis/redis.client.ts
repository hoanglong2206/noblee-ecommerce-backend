import Redis from "ioredis";
import { config } from "../../config";

const redisUrl = config.REDIS_URL?.trim() || undefined;

export const redisClient = redisUrl
	? new Redis(redisUrl, { lazyConnect: false })
	: new Redis({
			lazyConnect: false,
			host: config.REDIS_HOST?.trim() || "127.0.0.1",
			port: config.REDIS_PORT || 6379,
			password: config.REDIS_PASSWORD || undefined,
			tls: config.REDIS_TLS ? {} : undefined,
		});

redisClient.on("error", (error) => {
	console.error("Redis error:", error);
});

redisClient.on("ready", () => {
	console.log("Redis connected");
});
