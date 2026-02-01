import Redis, { RedisOptions } from "ioredis";

import { config } from "../../config";

const redisOptions: RedisOptions = {
	username: config.REDIS_USERNAME,
	password: config.REDIS_PASSWORD,
};

if (config.REDIS_HOST) {
	redisOptions.host = config.REDIS_HOST;
}

if (config.REDIS_PORT) {
	redisOptions.port = config.REDIS_PORT;
}

if (config.REDIS_TLS) {
	redisOptions.tls = {
		rejectUnauthorized: false,
		servername: config.REDIS_HOST,
	};
}

export const redisClient = new Redis(redisOptions);

redisClient.on("error", (err) => {
	console.error("Redis Client Error", err);
});
