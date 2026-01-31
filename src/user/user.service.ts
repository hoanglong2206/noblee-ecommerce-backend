import { and, desc, eq, ne } from "drizzle-orm";
import { StatusCodes } from "http-status-codes";
import { db } from "../database";
import {
	AddressType,
	NewUserAddressRecord,
	NewUserProfileRecord,
	UserAddressRecord,
	UserProfileRecord,
	userAddressTable,
	userProfileTable,
} from "./user.model";
import {
	CreateAddressDTO,
	UpdateAddressDTO,
	UpdateAvatarDTO,
	UpdateUserProfileDTO,
} from "./user.interface";
import { isUploadSuccess, uploads } from "../shared/helpers/cloudinary";

type ServiceError = Error & { statusCode?: number };

class UserService {
	public async getProfile(userId: string): Promise<UserProfileRecord> {
		return this.requireProfile(userId);
	}

	public async updateProfile(
		userId: string,
		payload: UpdateUserProfileDTO,
	): Promise<UserProfileRecord> {
		await this.requireProfile(userId);
		const isoNow = this.now();
		const profileUpdates: Partial<NewUserProfileRecord> = {};
		let hasChanges = false;
		if (payload.fullname !== undefined) {
			const name = this.toRequiredTrim(payload.fullname);
			profileUpdates.fullName = name;
			hasChanges = true;
		}
		if (payload.phoneNumber !== undefined) {
			profileUpdates.phoneNumber = this.toNullable(payload.phoneNumber);
			hasChanges = true;
		}
		if (payload.gender !== undefined) {
			profileUpdates.gender = payload.gender ?? null;
			hasChanges = true;
		}
		if (payload.dateOfBirth !== undefined) {
			profileUpdates.dateOfBirth = this.toNullable(payload.dateOfBirth);
			hasChanges = true;
		}
		if (payload.bio !== undefined) {
			profileUpdates.bio = this.toNullable(payload.bio);
			hasChanges = true;
		}
		if (!hasChanges) {
			throw this.createError(
				"No profile fields provided.",
				StatusCodes.BAD_REQUEST,
			);
		}
		profileUpdates.updatedAt = isoNow;
		const [updated] = await db
			.update(userProfileTable)
			.set(profileUpdates)
			.where(eq(userProfileTable.id, userId))
			.returning();
		if (!updated) {
			throw this.createError("Profile not found.", StatusCodes.NOT_FOUND);
		}
		return updated;
	}

	public async updateAvatar(
		userId: string,
		payload: UpdateAvatarDTO,
	): Promise<{ avatarUrl: string; publicId?: string }> {
		await this.requireProfile(userId);
		const uploadResult = await uploads(
			payload.file,
			payload.publicId,
			payload.overwrite,
			payload.invalidate,
		);
		if (!uploadResult || !isUploadSuccess(uploadResult)) {
			const message =
				uploadResult && "message" in uploadResult
					? uploadResult.message
					: "Failed to upload avatar.";
			throw this.createError(message, StatusCodes.BAD_REQUEST);
		}
		const isoNow = this.now();
		await db
			.update(userProfileTable)
			.set({ avatarUrl: uploadResult.secure_url, updatedAt: isoNow })
			.where(eq(userProfileTable.id, userId));
		return {
			avatarUrl: uploadResult.secure_url,
			publicId: uploadResult.public_id,
		};
	}

	public async getAddresses(userId: string): Promise<UserAddressRecord[]> {
		await this.requireProfile(userId);
		return db
			.select()
			.from(userAddressTable)
			.where(eq(userAddressTable.userId, userId))
			.orderBy(
				desc(userAddressTable.isDefault),
				desc(userAddressTable.updatedAt),
			);
	}

	public async createAddress(
		userId: string,
		payload: CreateAddressDTO,
	): Promise<UserAddressRecord> {
		await this.requireProfile(userId);
		const isoNow = this.now();
		const addressType = payload.addressType ?? "shipping";
		if (payload.isDefault) {
			await this.clearDefaultAddress(userId, addressType);
		}
		const newAddress: NewUserAddressRecord = {
			userId,
			addressType,
			fullName: this.toRequiredTrim(payload.recipientName),
			phoneNumber: this.toNullable(payload.phoneNumber),
			streetLine1: this.toRequiredTrim(payload.streetLine1),
			streetLine2: this.toNullable(payload.streetLine2),
			city: this.toRequiredTrim(payload.city),
			district: this.toNullable(payload.district ?? payload.state),
			ward: this.toNullable(payload.ward ?? payload.label),
			postalCode: this.toNullable(payload.postalCode),
			country: this.toRequiredTrim(payload.country),
			isDefault: payload.isDefault ?? false,
			createdAt: isoNow,
			updatedAt: isoNow,
		};
		const [inserted] = await db
			.insert(userAddressTable)
			.values(newAddress)
			.returning();
		if (!inserted) {
			throw this.createError(
				"Failed to create address.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return inserted;
	}

	public async updateAddress(
		userId: string,
		addressId: string,
		payload: UpdateAddressDTO,
	): Promise<UserAddressRecord> {
		await this.requireProfile(userId);
		const address = await this.getAddressRecord(userId, addressId);
		if (!address) {
			throw this.createError("Address not found.", StatusCodes.NOT_FOUND);
		}
		const isoNow = this.now();
		const updates: Partial<NewUserAddressRecord> = {};
		let hasChanges = false;
		if (payload.recipientName !== undefined) {
			updates.fullName = this.toRequiredTrim(payload.recipientName);
			hasChanges = true;
		}
		if (payload.streetLine1 !== undefined) {
			updates.streetLine1 = this.toRequiredTrim(payload.streetLine1);
			hasChanges = true;
		}
		if (payload.streetLine2 !== undefined) {
			updates.streetLine2 = this.toNullable(payload.streetLine2);
			hasChanges = true;
		}
		if (payload.city !== undefined) {
			updates.city = this.toRequiredTrim(payload.city);
			hasChanges = true;
		}
		const districtInput =
			payload.district !== undefined || payload.state !== undefined
				? this.toNullable(payload.district ?? payload.state)
				: undefined;
		if (districtInput !== undefined) {
			updates.district = districtInput;
			hasChanges = true;
		}
		const wardInput =
			payload.ward !== undefined || payload.label !== undefined
				? this.toNullable(payload.ward ?? payload.label)
				: undefined;
		if (wardInput !== undefined) {
			updates.ward = wardInput;
			hasChanges = true;
		}
		if (payload.postalCode !== undefined) {
			updates.postalCode = this.toNullable(payload.postalCode);
			hasChanges = true;
		}
		if (payload.country !== undefined) {
			updates.country = this.toRequiredTrim(payload.country);
			hasChanges = true;
		}
		if (payload.phoneNumber !== undefined) {
			updates.phoneNumber = this.toNullable(payload.phoneNumber);
			hasChanges = true;
		}
		let effectiveAddressType = address.addressType;
		if (payload.addressType !== undefined) {
			effectiveAddressType = payload.addressType;
			updates.addressType = payload.addressType;
			hasChanges = true;
			if (payload.isDefault === undefined && address.isDefault) {
				await this.clearDefaultAddress(userId, effectiveAddressType, addressId);
			}
		}
		if (payload.isDefault !== undefined) {
			updates.isDefault = payload.isDefault;
			hasChanges = true;
			if (payload.isDefault) {
				await this.clearDefaultAddress(userId, effectiveAddressType, addressId);
			}
		}
		if (!hasChanges) {
			throw this.createError(
				"No address fields provided.",
				StatusCodes.BAD_REQUEST,
			);
		}
		updates.updatedAt = isoNow;
		const [updated] = await db
			.update(userAddressTable)
			.set(updates)
			.where(
				and(
					eq(userAddressTable.id, addressId),
					eq(userAddressTable.userId, userId),
				),
			)
			.returning();
		if (!updated) {
			throw this.createError(
				"Failed to update address.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return updated;
	}

	public async deleteAddress(userId: string, addressId: string): Promise<void> {
		await this.requireProfile(userId);
		const [deleted] = await db
			.delete(userAddressTable)
			.where(
				and(
					eq(userAddressTable.id, addressId),
					eq(userAddressTable.userId, userId),
				),
			)
			.returning();
		if (!deleted) {
			throw this.createError("Address not found.", StatusCodes.NOT_FOUND);
		}
	}

	public async setDefaultAddress(
		userId: string,
		addressId: string,
	): Promise<UserAddressRecord> {
		await this.requireProfile(userId);
		const address = await this.getAddressRecord(userId, addressId);
		if (!address) {
			throw this.createError("Address not found.", StatusCodes.NOT_FOUND);
		}
		const isoNow = this.now();
		await this.clearDefaultAddress(userId, address.addressType, addressId);
		const [updated] = await db
			.update(userAddressTable)
			.set({ isDefault: true, updatedAt: isoNow })
			.where(
				and(
					eq(userAddressTable.id, addressId),
					eq(userAddressTable.userId, userId),
				),
			)
			.returning();
		if (!updated) {
			throw this.createError(
				"Failed to set default address.",
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
		}
		return updated;
	}

	private async getProfileRecord(
		userId: string,
	): Promise<UserProfileRecord | undefined> {
		const result = await db
			.select()
			.from(userProfileTable)
			.where(eq(userProfileTable.id, userId))
			.limit(1);
		return result[0];
	}

	private async requireProfile(userId: string): Promise<UserProfileRecord> {
		const profile = await this.getProfileRecord(userId);
		if (!profile) {
			throw this.createError("Profile not found.", StatusCodes.NOT_FOUND);
		}
		return profile;
	}
	private async getAddressRecord(
		userId: string,
		addressId: string,
	): Promise<UserAddressRecord | undefined> {
		const result = await db
			.select()
			.from(userAddressTable)
			.where(
				and(
					eq(userAddressTable.id, addressId),
					eq(userAddressTable.userId, userId),
				),
			)
			.limit(1);
		return result[0];
	}

	private async clearDefaultAddress(
		userId: string,
		addressType: AddressType,
		excludeAddressId?: string,
	): Promise<void> {
		let condition = and(
			eq(userAddressTable.userId, userId),
			eq(userAddressTable.addressType, addressType),
			eq(userAddressTable.isDefault, true),
		);
		if (excludeAddressId) {
			condition = and(condition, ne(userAddressTable.id, excludeAddressId));
		}
		const isoNow = this.now();
		await db
			.update(userAddressTable)
			.set({ isDefault: false, updatedAt: isoNow })
			.where(condition);
	}

	private toRequiredTrim(value: string): string {
		const trimmed = value.trim();
		if (!trimmed) {
			throw this.createError("Value cannot be empty.", StatusCodes.BAD_REQUEST);
		}
		return trimmed;
	}

	private toNullable(value?: string | null): string | null {
		if (value === undefined || value === null) {
			return null;
		}
		const trimmed = value.trim();
		return trimmed ? trimmed : null;
	}

	private createError(message: string, statusCode: number): ServiceError {
		const error = new Error(message) as ServiceError;
		error.statusCode = statusCode;
		return error;
	}

	private now(): string {
		return new Date().toISOString();
	}
}

export const userService: UserService = new UserService();
