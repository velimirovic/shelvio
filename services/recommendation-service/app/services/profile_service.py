import logging

import httpx

logger = logging.getLogger(__name__)

MIN_DONE_ENTRIES = 3


async def get_tracking_entries(user_token: str) -> list[dict]:
    from app.core.config import settings
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{settings.tracking_service_url}/api/tracking",
                headers={"Authorization": user_token},
            )
            r.raise_for_status()
            return r.json()
    except Exception:
        logger.exception("Failed to fetch tracking entries")
        return []
