const amqp = require('amqplib');

let channel = null;

const connectQueue = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    channel = await connection.createChannel();
    await channel.assertExchange('emergency.events', 'topic', { durable: true });
    console.log('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    console.warn('RabbitMQ not available — running without message queue:', error.message);
    return null;
  }
};

const subscribeToEvent = async (routingKey, handler) => {
  try {
    if (!channel) return;
    const q = await channel.assertQueue('', { exclusive: true });
    await channel.bindQueue(q.queue, 'emergency.events', routingKey);
    channel.consume(q.queue, (msg) => {
      if (msg !== null) {
        const content = JSON.parse(msg.content.toString());
        handler(content);
        channel.ack(msg);
      }
    });
    console.log(`Subscribed to: ${routingKey}`);
  } catch (error) {
    console.error('Failed to subscribe:', error.message);
  }
};

module.exports = { connectQueue, subscribeToEvent };
