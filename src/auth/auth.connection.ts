import { Channel } from "amqplib";
import { createQueueChannel } from "../shared/queues/connection";

async function authConnection(): Promise<Channel> {
	return createQueueChannel({ logContext: "Auth server" });
}

export { authConnection };
