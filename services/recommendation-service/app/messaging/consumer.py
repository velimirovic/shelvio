import asyncio
import json
import logging

import aio_pika
import redis.asyncio as aioredis

from app.core.config import settings

logger = logging.getLogger(__name__)

EXCHANGE_USER_RATED = "user.rated_content"
QUEUE_USER_RATED = "recommendation.user_rated"


async def _handle_user_rated(message: aio_pika.IncomingMessage) -> None:
    """Brise Redis kes za korisnika kad promijeni ocjenu — sljedeci generate ce biti svjez."""
    async with message.process():
        try:
            data = json.loads(message.body)
            user_id = data["userId"]
            r = aioredis.from_url(settings.redis_url, decode_responses=True)
            for t in ("movie", "series", "book", "all"):
                await r.delete(f"rec:{user_id}:{t}")
            await r.aclose()
            logger.info(f"Recommendation cache cleared for user {user_id}")
        except Exception:
            logger.exception("Failed to process UserRatedContent message")


async def start_consumer() -> None:
    while True:
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            channel = await connection.channel()
            await channel.set_qos(prefetch_count=10)

            ur_exchange = await channel.declare_exchange(
                EXCHANGE_USER_RATED, aio_pika.ExchangeType.FANOUT, durable=True
            )
            ur_queue = await channel.declare_queue(QUEUE_USER_RATED, durable=True)
            await ur_queue.bind(ur_exchange)
            await ur_queue.consume(_handle_user_rated)

            logger.info("RabbitMQ consumer started, listening for rating changes.")
            await asyncio.Future()
        except Exception:
            logger.exception("RabbitMQ consumer error — retrying in 5s")
            await asyncio.sleep(5)
