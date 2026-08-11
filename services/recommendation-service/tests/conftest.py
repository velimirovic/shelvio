import os

# Postavi env varijable prije nego sto se bilo koji modul iz app/ importuje.
# Pydantic-settings ce ih procitati na inicijalizaciji Settings klase.
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("TRACKING_SERVICE_URL", "http://tracking-service:8080")
os.environ.setdefault("CONTENT_SERVICE_URL", "http://content-service:3000")
os.environ.setdefault("JWT_SECRET", "test-secret-min-32-chars-long-ok")
os.environ.setdefault("JWT_ISSUER", "shelvio")
os.environ.setdefault("JWT_AUDIENCE", "shelvio-clients")
os.environ.setdefault("RABBITMQ_URL", "amqp://guest:guest@localhost/")
