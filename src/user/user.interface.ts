import { AddressType, UserGender } from "./user.model";

export interface UserRegisteredMessage {
	id: string;
	fullname: string;
	email: string;
}

export interface UpdateUserProfileDTO {
	fullname?: string;
	phoneNumber?: string | null;
	gender?: UserGender;
	dateOfBirth?: string | null;
	bio?: string | null;
	address?: string | null;
	isProfileComplete?: boolean;
}

export interface UpdateAvatarDTO {
	file: string;
	publicId?: string;
	overwrite?: boolean;
	invalidate?: boolean;
}

export interface CreateAddressDTO {
	recipientName: string;
	streetLine1: string;
	streetLine2?: string | null;
	city: string;
	district?: string | null;
	state?: string | null;
	ward?: string | null;
	postalCode?: string | null;
	country: string;
	phoneNumber?: string | null;
	label?: string | null;
	addressType?: AddressType;
	isDefault?: boolean;
}

export interface UpdateAddressDTO {
	recipientName?: string;
	streetLine1?: string;
	streetLine2?: string | null;
	city?: string;
	district?: string | null;
	ward?: string | null;
	state?: string | null;
	postalCode?: string | null;
	country?: string;
	phoneNumber?: string | null;
	label?: string | null;
	addressType?: AddressType;
	isDefault?: boolean;
}
