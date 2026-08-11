const amqp = require('amqplib');
const config = require('../config');

let _channel = null;

async function getChannel() {
  if (_channel) return _channel;

  const conn = await amqp.connect(config.rabbitmq.url);
  const ch = await conn.createChannel();

  await ch.assertExchange(config.rabbitmq.exchanges.contentDiscovered, 'fanout', { durable: true });

  // Kad se konekcija neocekivano ugasi, resetujemo kanal da se sledeci poziv
  // ponovo poveze (amqplib ne radi automatski reconnect).
  conn.on('close', () => { _channel = null; });
  conn.on('error', () => { _channel = null; });

  _channel = ch;
  return ch;
}

async function publishContentDiscovered(payload) {
  try {
    const ch = await getChannel();
    ch.publish(
      config.rabbitmq.exchanges.contentDiscovered,
      '',
      Buffer.from(JSON.stringify(payload)),
      { persistent: true }
    );
  } catch (err) {
    // Publisher greska ne sme da sruši korisnički zahtev - logujemo i nastavljamo.
    console.error('[publisher] ContentDiscovered publish failed:', err.message);
    _channel = null;
  }
}

module.exports = { publishContentDiscovered };
