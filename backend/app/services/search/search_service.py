
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import engine
from app.models import Document, Indicator
from app.models.document_indicator import DocumentIndicator


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def search_intelligence(query: str, limit: int = 20) -> dict:
    """Search stored documents and indicators, preserving source details."""

    query = query.strip()

    if not query:
        raise ValueError("Search query cannot be empty")

    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")

    pattern = f"%{query}%"

    with SessionLocal() as session:
        document_statement = (
            select(Document)
            .where(
                or_(
                    Document.title.ilike(pattern),
                    Document.content.ilike(pattern),
                    Document.external_id.ilike(pattern),
                    Document.source_name.ilike(pattern),
                )
            )
            .order_by(Document.retrieved_at.desc(), Document.id.desc())
            .limit(limit)
        )

        documents = session.scalars(document_statement).all()

        indicator_statement = (
            select(Indicator)
            .where(
                or_(
                    Indicator.value.ilike(pattern),
                    Indicator.normalized_value.ilike(pattern),
                    Indicator.indicator_type.ilike(pattern),
                )
            )
            .order_by(Indicator.id.desc())
            .limit(limit)
        )

        indicators = session.scalars(indicator_statement).all()

        indicator_results = []

        for indicator in indicators:
            linked_documents_statement = (
                select(Document)
                .join(
                    DocumentIndicator,
                    DocumentIndicator.document_id == Document.id,
                )
                .where(DocumentIndicator.indicator_id == indicator.id)
                .order_by(Document.id.desc())
                .limit(10)
            )

            linked_documents = session.scalars(
                linked_documents_statement
            ).all()

            indicator_results.append(
                {
                    "id": indicator.id,
                    "type": indicator.indicator_type,
                    "value": indicator.value,
                    "normalized_value": indicator.normalized_value,
                    "documents": [
                        {
                            "id": document.id,
                            "title": document.title,
                            "source_name": document.source_name,
                            "external_id": document.external_id,
                            "source_url": document.source_url,
                        }
                        for document in linked_documents
                    ],
                }
            )

        return {
            "query": query,
            "document_count": len(documents),
            "indicator_count": len(indicator_results),
            "documents": [
                {
                    "id": document.id,
                    "title": document.title,
                    "source_name": document.source_name,
                    "external_id": document.external_id,
                    "source_url": document.source_url,
                    "published_at": (
                        document.published_at.isoformat()
                        if document.published_at
                        else None
                    ),
                    "retrieved_at": (
                        document.retrieved_at.isoformat()
                        if document.retrieved_at
                        else None
                    ),
                    "status": document.status,
                }
                for document in documents
            ],
            "indicators": indicator_results,
        }
