import { config } from "../../config";
import client, { Channel, ChannelModel } from "amqplib";

interface QueueConnectionOptions {
	logContext?: string;
}

async function createQueueChannel(
	options: QueueConnectionOptions = {},
): Promise<Channel> {
	const { logContext } = options;

	try {
		const connection: ChannelModel = await client.connect(
			`${config.RABBITMQ_ENDPOINT}`,
		);
		const channel: Channel = await connection.createChannel();
		const message = logContext
			? `${logContext} connected to queue successfully...`
			: "Connected to queue successfully...";
		console.log(message);
		registerCloseHandlers(channel, connection);
		return channel;
	} catch (error) {
		const context = logContext ? `${logContext.toLowerCase()} queue` : "queue";
		console.error(`Failed to establish ${context} connection:`, error);
		throw error;
	}
}

function registerCloseHandlers(
	channel: Channel,
	connection: ChannelModel,
): void {
	process.once("SIGINT", async () => {
		await channel.close();
		await connection.close();
	});
}

export { createQueueChannel };
