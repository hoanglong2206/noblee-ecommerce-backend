import jwt, {
	JwtPayload,
	TokenExpiredError,
	VerifyOptions,
} from "jsonwebtoken";

export type VerifyTokenResult<T extends JwtPayload = JwtPayload> = {
	valid: boolean;
	expired: boolean;
	payload?: T;
	error?: Error;
};

export const verifyToken = <T extends JwtPayload = JwtPayload>(
	token: string,
	secret: string,
	options: VerifyOptions = {},
): VerifyTokenResult<T> => {
	try {
		const payload = jwt.verify(token, secret, options) as T;
		return { valid: true, expired: false, payload };
	} catch (error) {
		if (error instanceof TokenExpiredError) {
			try {
				const payload = jwt.verify(token, secret, {
					...options,
					ignoreExpiration: true,
				}) as T;
				return { valid: false, expired: true, payload };
			} catch (innerError) {
				return {
					valid: false,
					expired: true,
					error: innerError as Error,
				};
			}
		}
		return { valid: false, expired: false, error: error as Error };
	}
};
