from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.services.investigation.investigation_graph import run_investigation
from app.services.rag.indexing_service import index_documents
from app.services.rag.embeddings import EmbeddingServiceError
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import engine
from app.models import Document, Investigation, InvestigationSource

router = APIRouter(prefix="/investigations", tags=["AI Investigations"])

class InvestigationRequest(BaseModel):
    query: str = Field(min_length=3, max_length=2000)
    limit: int = Field(default=6, ge=1, le=20)
    document_ids: list[int] | None = None

class IndexRequest(BaseModel):
    document_ids: list[int] | None = None
    batch_size: int = Field(default=16, ge=1, le=64)

@router.post("/index")
def index_documents_endpoint(payload: IndexRequest):
    try:
        return index_documents(document_ids=payload.document_ids, batch_size=payload.batch_size)
    except (EmbeddingServiceError, ValueError) as exc:
        raise HTTPException(status_code=503 if isinstance(exc, EmbeddingServiceError) else 400, detail=str(exc)) from exc

@router.post("/run")
def investigate(payload: InvestigationRequest):
    try:
        return run_investigation(payload.query, limit=payload.limit, document_ids=payload.document_ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/")
def list_investigations(limit: int = 20):
    if not 1 <= limit <= 100:
        raise HTTPException(status_code=400, detail="limit must be between 1 and 100")
    with Session(engine) as session:
        items = session.scalars(
            select(Investigation).order_by(Investigation.created_at.desc()).limit(limit)
        ).all()
        return {
            "total": len(items),
            "investigations": [
                {
                    "id": item.id,
                    "query": item.query,
                    "status": item.status,
                    "evidence_count": item.evidence_count,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                }
                for item in items
            ],
        }


@router.get("/{investigation_id}")
def get_investigation(investigation_id: int):
    with Session(engine) as session:
        item = session.get(Investigation, investigation_id)
        if item is None:
            raise HTTPException(status_code=404, detail="Investigation not found")
        rows = session.execute(
            select(InvestigationSource, Document)
            .join(Document, Document.id == InvestigationSource.document_id)
            .where(InvestigationSource.investigation_id == investigation_id)
            .order_by(InvestigationSource.source_label)
        ).all()
        return {
            "investigation_id": item.id,
            "query": item.query,
            "report": item.report,
            "status": item.status,
            "evidence_count": item.evidence_count,
            "unverified_source_references": item.unverified_source_references or [],
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "sources": [
                {
                    "source_id": source.source_label,
                    "document_id": document.id,
                    "chunk_id": source.chunk_id,
                    "title": document.title,
                    "source_name": document.source_name,
                    "source_url": document.source_url,
                    "external_id": document.external_id,
                    "quoted_text": source.quoted_text,
                    "start_offset": source.start_offset,
                    "end_offset": source.end_offset,
                    "retrieval_score": source.retrieval_score,
                }
                for source, document in rows
            ],
        }
