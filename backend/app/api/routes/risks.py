
from fastapi import APIRouter
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import engine
from app.models import Citation, Document, Finding

router = APIRouter(prefix="/risks", tags=["Risk Assessments"])


@router.get("/")
def get_risk_assessments():
    with Session(engine) as session:
        statement = (
            select(Finding, Document, Citation)
            .join(Document, Finding.document_id == Document.id)
            .outerjoin(Citation, Citation.finding_id == Finding.id)
            .where(Finding.title == "URLhaus source-based risk assessment")
            .order_by(Finding.created_at.desc())
        )

        rows = session.execute(statement).all()

        return {
            "total": len(rows),
            "assessments": [
                {
                    "finding_id": finding.id,
                    "title": finding.title,
                    "description": finding.description,
                    "finding_type": finding.finding_type,
                    "risk_level": finding.risk_level,
                    "confidence": finding.confidence,
                    "source": document.source_name,
                    "source_url": document.source_url,
                    "external_id": document.external_id,
                    "citation": (
                        {
                            "citation_id": citation.id,
                            "quoted_text": citation.quoted_text,
                        }
                        if citation
                        else None
                    ),
                    "created_at": finding.created_at.isoformat()
                    if finding.created_at
                    else None,
                }
                for finding, document, citation in rows
            ],
        }
