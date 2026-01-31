import { Channel, ConsumeMessage, Replies } from "amqplib";
import { userConnection } from "./user.connection";
import { userService } from "./user.service";
import { UserRegisteredMessage } from "./user.interface";

const consumeCreateUserMessage = async (channel?: Channel): Promise<void> => {
	try {
		const queueChannel: Channel =
			channel ?? ((await userConnection()) as Channel);

		const exchangeName = "user.register";
		const queueName = "user.registration.queue";
		const routingKey = "user.create";

		await queueChannel.assertExchange(exchangeName, "direct", {
			durable: true,
		});
		const assertedQueue: Replies.AssertQueue = await queueChannel.assertQueue(
			queueName,
			{
				durable: true,
				autoDelete: false,
			},
		);
		await queueChannel.bindQueue(assertedQueue.queue, exchangeName, routingKey);
		queueChannel.consume(
			assertedQueue.queue,
			async (msg: ConsumeMessage | null) => {
				if (!msg) {
					return;
				}
				try {
					const parsed = JSON.parse(msg.content.toString()) as {
						data?: UserRegisteredMessage;
					};
					if (!parsed?.data) {
						console.warn(
							"Received user registration message without payload data.",
						);
						return;
					}
					await userService.syncProfileFromAuth(parsed.data);
				} catch (error) {
					console.error("Failed to process user registration message:", error);
				} finally {
					queueChannel.ack(msg);
				}
			},
		);
	} catch (error) {
		console.error("Error in user consumer:", error);
	}
};

export { consumeCreateUserMessage };
