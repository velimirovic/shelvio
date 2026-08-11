from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    redis_url: str = "redis://redis:6379"
    rabbitmq_url: str = "amqp://guest:guest@rabbitmq/"
    openai_api_key: str = ""
    tracking_service_url: str = "http://tracking-service:8080"
    content_service_url: str = "http://content-service:3000"
    recommendation_cache_ttl: int = 60 * 60 * 12  # 12h

    jwt_secret: str = ""
    jwt_issuer: str = "shelvio"
    jwt_audience: str = "shelvio-clients"

    class Config:
        env_file = ".env"


settings = Settings()
