const redisClient = require('../config/redisClient');
const config = require('../config');

async function getCached(key) {
  const raw = await redisClient.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function setCached(key, value, ttlSeconds = config.redis.ttlSeconds) {
  await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

module.exports = { getCached, setCached };
