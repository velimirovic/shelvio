from fastapi import FastAPI
from contextlib import asynccontextmanager

# TODO: from app.db.session import init_db
# TODO: from app.messaging.consumer import start_consumer
# TODO: from app.api.routes import recommendations


@asynccontextmanager
async def lifespan(app: FastAPI):
    # TODO: await init_db()
    # TODO: asyncio.create_task(start_consumer())
    yield


app = FastAPI(
    title="Shelvio Recommendation Service",
    version="1.0.0",
    lifespan=lifespan,
)

# TODO: app.include_router(recommendations.router, prefix="/api/recommendations")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "recommendation-service"}
