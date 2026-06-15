from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:changeme@postgres-recommendation:5432/recommendationdb"
    redis_url: str = "redis://redis:6379"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq/"
    openai_api_key: str = ""
    tracking_service_url: str = "http://tracking-service:8080"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536
    recommendation_cache_ttl: int = 60 * 60 * 12  # 12h

    class Config:
        env_file = ".env"


settings = Settings()
