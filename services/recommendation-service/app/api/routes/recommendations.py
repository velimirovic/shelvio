from fastapi import APIRouter, Header, HTTPException, Query
from jose import jwt, JWTError

from app.core.config import settings
from app.services import recommendation_service

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

VALID_TYPES = {"movie", "series", "book", "all"}


def _extract_user_id(authorization: str) -> str:
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
        return payload["sub"]
    except (JWTError, KeyError):
        raise HTTPException(status_code=401, detail="Invalid token.")


@router.get("")
async def get_recommendations(
    type: str = Query("all", description="movie | series | book | all"),
    refresh: bool = Query(False, description="Force new generation, bypass cache"),
    authorization: str = Header(...),
):
    if type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid type '{type}'. Use: movie, series, book, all.",
        )

    user_id = _extract_user_id(authorization)
    result = await recommendation_service.get_recommendations(
        user_id=user_id,
        user_token=authorization,
        content_type=type,
        force_refresh=refresh,
    )

    if result.get("error") == "not_enough_data":
        raise HTTPException(status_code=422, detail=result["message"])

    if result.get("error") == "daily_limit_reached":
        raise HTTPException(
            status_code=429,
            detail={
                "message": result["message"],
                "generationsRemaining": 0,
                "dailyLimit": result["dailyLimit"],
            },
        )

    return result
