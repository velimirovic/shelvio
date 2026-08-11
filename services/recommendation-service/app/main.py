import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.messaging.consumer import start_consumer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    consumer_task = asyncio.create_task(start_consumer())
    logger.info("Recommendation service ready.")
    yield
    consumer_task.cancel()


app = FastAPI(
    title="Shelvio Recommendation Service",
    version="1.0.0",
    lifespan=lifespan,
)

from app.api.routes.recommendations import router  # noqa: E402
app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "recommendation-service"}
