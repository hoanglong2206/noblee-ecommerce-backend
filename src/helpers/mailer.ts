import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";

class Mailer {
	private transporter: Transporter;

	constructor() {
		this.transporter = nodemailer.createTransport({
			host: config.SMTP_HOST,
			port: config.SMTP_PORT,
			secure: config.SMTP_SECURE,
			auth: {
				user: config.SMTP_USER,
				pass: config.SMTP_PASSWORD,
			},
		});
	}

	public async sendOtp(email: string, otp: string): Promise<void> {
		const from = config.SMTP_FROM || config.SMTP_USER;
		if (!from) {
			throw new Error("SMTP_FROM or SMTP_USER must be configured");
		}

		await this.transporter.sendMail({
			from,
			to: email,
			subject: "Your verification code",
			text: `Your verification code is ${otp}. It will expire soon.`,
			html: `<p>Your verification code is <strong>${otp}</strong>. It will expire soon.</p>`,
		});
	}
}

export const mailer = new Mailer();
