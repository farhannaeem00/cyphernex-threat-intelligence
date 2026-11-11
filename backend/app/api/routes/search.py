
from fastapi import APIRouter, HTTPException, Query

from app.services.search.search_service import search_intelligence


router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/")
def search(
    q: str = Query(..., min_length=1, max_length=500),
    limit: int = Query(default=20, ge=1, le=100),
):
    try:
        return search_intelligence(query=q, limit=limit)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
