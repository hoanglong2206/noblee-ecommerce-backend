import { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { eq, inArray } from "drizzle-orm";
import jwt, {
	JwtPayload,
	TokenExpiredError,
	VerifyOptions,
} from "jsonwebtoken";
import { db } from "../../database";
import { config } from "../../config";
import { auth as authTable, Auth } from "../../auth/auth.model";
import {
	userRoles,
	roles,
	rolePermissions,
	permissions,
} from "../../role/role.model";

export type VerifyTokenResult<T extends JwtPayload = JwtPayload> = {
	valid: boolean;
	expired: boolean;
	payload?: T;
	error?: Error;
};

type AuthenticatedUser = {
	id: string;
	email: string;
	roles: string[];
	permissions: string[];
};

declare module "express-serve-static-core" {
	interface Request {
		authUser?: AuthenticatedUser;
	}
}

const ACCESS_TOKEN_COOKIE = "accessToken";
const BEARER_PREFIX = "Bearer ";

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

const extractAccessToken = (req: Request): string | undefined => {
	const authorization = req.headers.authorization;
	if (authorization && authorization.startsWith(BEARER_PREFIX)) {
		return authorization.slice(BEARER_PREFIX.length).trim();
	}
	if (req.cookies && typeof req.cookies[ACCESS_TOKEN_COOKIE] === "string") {
		return req.cookies[ACCESS_TOKEN_COOKIE];
	}
	return undefined;
};

const authenticateRequest = async (
	req: Request,
	res: Response,
): Promise<Auth | undefined> => {
	const accessSecret = config.JWT_SECRET;
	if (!accessSecret) {
		res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
			message: "JWT secret not configured.",
		});
		return undefined;
	}
	const token = extractAccessToken(req);
	if (!token) {
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: "Access token is required.",
		});
		return undefined;
	}
	const verification = verifyToken<JwtPayload & { sub?: string }>(
		token,
		accessSecret,
	);
	if (verification.expired) {
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: "Access token expired.",
		});
		return undefined;
	}
	if (!verification.valid || !verification.payload?.sub) {
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: "Invalid access token.",
		});
		return undefined;
	}
	const result = await db
		.select()
		.from(authTable)
		.where(eq(authTable.id, verification.payload.sub))
		.limit(1);
	const user = result[0];
	if (!user) {
		res.status(StatusCodes.UNAUTHORIZED).json({
			message: "User not found.",
		});
		return undefined;
	}
	if (user.isDisabled) {
		res.status(StatusCodes.FORBIDDEN).json({
			message: "Account disabled.",
		});
		return undefined;
	}
	if (!user.isEmailVerified) {
		res.status(StatusCodes.FORBIDDEN).json({
			message: "Account not verified.",
		});
		return undefined;
	}

	const { roles: userRoleNames, permissions: userPermissions } =
		await getUserRolesAndPermissions(user.id);

	req.authUser = {
		id: user.id,
		email: user.email,
		roles: userRoleNames,
		permissions: userPermissions,
	};
	return user;
};

export const requireAuth = async (
	req: Request,
	res: Response,
	next: NextFunction,
): Promise<void> => {
	try {
		const user = await authenticateRequest(req, res);
		if (!user) {
			return;
		}
		console.log(req.authUser);
		next();
	} catch (error) {
		next(error);
	}
};

export const requirePermission = (permission: string) => {
	return async (req: Request, res: Response, next: NextFunction) => {
		await requireAuth(req, res, async () => {
			if (!req.authUser?.permissions.includes(permission)) {
				res.status(StatusCodes.FORBIDDEN).json({
					message: `Required permission: ${permission}`,
				});
				return;
			}
			next();
		});
	};
};

const getUserRolesAndPermissions = async (userId: string) => {
	const userRoleRows = await db
		.select({ roleId: userRoles.roleId, roleName: roles.displayName })
		.from(userRoles)
		.innerJoin(roles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userId, userId));

	if (!userRoleRows.length) {
		return { roles: [], permissions: [] };
	}

	const roleIds = userRoleRows.map((r) => r.roleId);
	const roleNames = userRoleRows.map((r) => r.roleName);

	const permissionRows = await db
		.select({
			resource: permissions.resource,
			action: permissions.action,
		})
		.from(rolePermissions)
		.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
		.where(inArray(rolePermissions.roleId, roleIds));

	const permissionNames = [
		...new Set(permissionRows.map((p) => `${p.resource}:${p.action}`)),
	];

	return { roles: roleNames, permissions: permissionNames };
};
