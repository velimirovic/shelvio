const Redis = require('ioredis');
const config = require('./index');

// Jedna deljena Redis konekcija (singleton) za ceo servis.
const redisClient = new Redis(config.redis.url);

redisClient.on('connect', () => console.log('Redis: connected'));
redisClient.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redisClient;
