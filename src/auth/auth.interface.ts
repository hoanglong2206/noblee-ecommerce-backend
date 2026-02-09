export interface sendOtpDTO {
	email: string;
}

export interface verifyOtpDTO {
	email: string;
	otp: string;
}

export interface registerDTO {
	fullName: string;
	email: string;
	password: string;
}

export interface loginDTO {
	email: string;
	password: string;
}

export interface refreshTokenDTO {
	refreshToken: string;
}
