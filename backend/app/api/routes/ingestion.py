from fastapi import APIRouter, HTTPException, Query

from app.services.ingestion.urlhaus_ingestion import ingest_urlhaus_records

router = APIRouter(prefix="/ingestion", tags=["Data Ingestion"])


@router.post("/urlhaus")
def ingest_urlhaus(
    limit: int = Query(default=5, ge=1, le=100),
):
    try:
        stats = ingest_urlhaus_records(limit=limit)

        return {
            "source": "URLhaus",
            "status": "completed",
            "stats": stats,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"URLhaus ingestion failed: {exc}",
        ) from exc
