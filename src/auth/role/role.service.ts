import { StatusCodes } from "http-status-codes";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../../database";

type RoleServiceError = Error & { statusCode?: number };

class RoleService {
	private createError(message: string, statusCode: number): RoleServiceError {
		const error = new Error(message) as RoleServiceError;
		error.statusCode = statusCode;
		return error;
	}
}

export const roleService = new RoleService();
