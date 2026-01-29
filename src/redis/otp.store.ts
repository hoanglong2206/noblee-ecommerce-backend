import { redisClient } from "./redis.client";

const OTP_KEY_PREFIX = "auth:otp:";
const OTP_REQUEST_PREFIX = "auth:otp:request:";
const OTP_VERIFY_PREFIX = "auth:otp:verify:";
const OTP_VERIFIED_PREFIX = "auth:otp:verified:";

const buildKey = (prefix: string, email: string) =>
	`${prefix}${email.toLowerCase()}`;

export const storeOtpHash = async (
	email: string,
	hashedOtp: string,
	expireSeconds: number,
): Promise<void> => {
	const key = buildKey(OTP_KEY_PREFIX, email);
	await redisClient.set(key, hashedOtp, "EX", expireSeconds);
};

export const getOtpHash = async (email: string): Promise<string | null> => {
	const key = buildKey(OTP_KEY_PREFIX, email);
	return redisClient.get(key);
};

export const clearOtpHash = async (email: string): Promise<void> => {
	const key = buildKey(OTP_KEY_PREFIX, email);
	await redisClient.del(key);
};

export const deleteOtpData = async (email: string): Promise<void> => {
	const keys = [
		buildKey(OTP_KEY_PREFIX, email),
		buildKey(OTP_REQUEST_PREFIX, email),
		buildKey(OTP_VERIFY_PREFIX, email),
		buildKey(OTP_VERIFIED_PREFIX, email),
	];
	if (keys.length) {
		await redisClient.del(...keys);
	}
};

export const incrementOtpRequestCount = async (
	email: string,
	windowSeconds: number,
): Promise<number> => {
	const key = buildKey(OTP_REQUEST_PREFIX, email);
	const count = await redisClient.incr(key);
	if (count === 1) {
		await redisClient.expire(key, windowSeconds);
	}
	return count;
};

export const clearOtpVerificationAttempts = async (
	email: string,
): Promise<void> => {
	const key = buildKey(OTP_VERIFY_PREFIX, email);
	await redisClient.del(key);
};

export const clearOtpRequestCount = async (email: string): Promise<void> => {
	const key = buildKey(OTP_REQUEST_PREFIX, email);
	await redisClient.del(key);
};

export const markOtpVerified = async (
	email: string,
	windowSeconds: number,
): Promise<void> => {
	const key = buildKey(OTP_VERIFIED_PREFIX, email);
	await redisClient.set(key, "true", "EX", windowSeconds);
};

export const isOtpVerified = async (email: string): Promise<boolean> => {
	const key = buildKey(OTP_VERIFIED_PREFIX, email);
	const value = await redisClient.get(key);
	return value === "true";
};

export const clearOtpVerified = async (email: string): Promise<void> => {
	const key = buildKey(OTP_VERIFIED_PREFIX, email);
	await redisClient.del(key);
};

export const incrementOtpVerificationAttempts = async (
	email: string,
	windowSeconds: number,
): Promise<number> => {
	const key = buildKey(OTP_VERIFY_PREFIX, email);
	const count = await redisClient.incr(key);
	if (count === 1) {
		await redisClient.expire(key, windowSeconds);
	}
	return count;
};
