import { Channel } from "amqplib";

interface PublishOptions {
	channel?: Channel;
	channelFactory: () => Promise<Channel>;
	exchangeName: string;
	routingKey: string;
	message: string | Buffer;
	logMessage?: string;
}

export async function publishDirectMessage({
	channel,
	channelFactory,
	exchangeName,
	routingKey,
	message,
	logMessage,
}: PublishOptions): Promise<void> {
	try {
		if (!channel && channelFactory) {
			channel = await channelFactory();
		}

		if (!channel) {
			throw new Error("Unable to determine channel for publishing message");
		}

		await channel.assertExchange(exchangeName, "direct", {
			durable: true,
		});

		const payload =
			typeof message === "string" ? Buffer.from(message) : message;
		channel.publish(exchangeName, routingKey, payload);
		if (logMessage) {
			console.log(logMessage);
		}
	} catch (error) {
		console.error("Failed to publish message:", error);
		throw error;
	}
}
