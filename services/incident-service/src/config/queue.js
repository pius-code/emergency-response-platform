const amqp = require('amqplib');

let channel = null;

const connectQueue = async () => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost:5672');
    channel = await connection.createChannel();
    await channel.assertExchange('emergency.events', 'topic', { durable: true });
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.warn('RabbitMQ not available — running without message queue:', error.message);
  }
};

const publishEvent = async (routingKey, payload) => {
  try {
    if (!channel) return;
    const message = JSON.stringify({
      event: routingKey,
      timestamp: new Date().toISOString(),
      payload,
    });
    channel.publish('emergency.events', routingKey, Buffer.from(message), { persistent: true });
    console.log(`Event published: ${routingKey}`);
  } catch (error) {
    console.error('Failed to publish event:', error.message);
  }
};

module.exports = { connectQueue, publishEvent };
