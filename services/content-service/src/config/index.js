module.exports = {
  port: process.env.PORT || 3000,
  tmdb: {
    apiKey: process.env.TMDB_API_KEY,
    baseUrl: 'https://api.themoviedb.org/3',
  },
  googleBooks: {
    apiKey: process.env.GOOGLE_BOOKS_API_KEY,
    baseUrl: 'https://www.googleapis.com/books/v1',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
    ttlSeconds: 60 * 60 * 24, // 24h
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672',
    exchanges: {
      contentDiscovered: 'content.discovered',
    },
  },
};
