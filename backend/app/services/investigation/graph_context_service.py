from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Document, Indicator, Relationship
from app.models.document_indicator import DocumentIndicator


def build_graph_context(
    session: Session,
    document_ids: list[int],
    limit: int = 50,
) -> dict:
    """
    Retrieve direct graph relationships connected to the documents
    retrieved by the current investigation.

    Relationship confidence values are stored evidence-strength scores.
    They are not probabilities of attribution or compromise.
    """
    seed_ids = sorted({int(value) for value in document_ids if value is not None})

    if not seed_ids:
        return {
            "seed_document_ids": [],
            "connections": [],
            "related_documents": [],
            "relationship_count": 0,
            "related_indicator_count": 0,
        }

    # Find indicators associated with the investigation's source documents.
    seed_indicator_ids = set(
        session.scalars(
            select(DocumentIndicator.indicator_id).where(
                DocumentIndicator.document_id.in_(seed_ids)
            )
        ).all()
    )

    # Find relationships directly connected to either a seed document
    # or an indicator associated with a seed document.
    conditions = [
        Relationship.source_document_id.in_(seed_ids),
        Relationship.target_document_id.in_(seed_ids),
    ]

    if seed_indicator_ids:
        conditions.extend(
            [
                Relationship.source_indicator_id.in_(seed_indicator_ids),
                Relationship.target_indicator_id.in_(seed_indicator_ids),
            ]
        )

    relationships = session.scalars(
        select(Relationship)
        .where(
            or_(*conditions),
            Relationship.relationship_type != "observed_temporal_proximity",
        )
        .order_by(
            Relationship.confidence.desc().nullslast(),
            Relationship.id,
        )
        .limit(max(1, min(limit, 200)))
    ).all()

    # Collect endpoint IDs so their labels can be resolved.
    document_endpoint_ids = set(seed_ids)
    indicator_endpoint_ids = set(seed_indicator_ids)

    for relationship in relationships:
        if relationship.source_document_id is not None:
            document_endpoint_ids.add(relationship.source_document_id)
        if relationship.target_document_id is not None:
            document_endpoint_ids.add(relationship.target_document_id)
        if relationship.source_indicator_id is not None:
            indicator_endpoint_ids.add(relationship.source_indicator_id)
        if relationship.target_indicator_id is not None:
            indicator_endpoint_ids.add(relationship.target_indicator_id)

    documents = session.scalars(
        select(Document).where(Document.id.in_(document_endpoint_ids))
    ).all()

    indicators = session.scalars(
        select(Indicator).where(Indicator.id.in_(indicator_endpoint_ids))
    ).all()

    document_map = {item.id: item for item in documents}
    indicator_map = {item.id: item for item in indicators}

    def resolve_endpoint(document_id, indicator_id):
        # Match the endpoint selection convention used by /api/graph/.
        if document_id is not None:
            document = document_map.get(document_id)
            if document is None:
                return None

            return {
                "type": "document",
                "id": document.id,
                "label": document.title,
                "source": document.source_name,
            }

        if indicator_id is not None:
            indicator = indicator_map.get(indicator_id)
            if indicator is None:
                return None

            return {
                "type": "indicator",
                "id": indicator.id,
                "label": indicator.normalized_value,
                "indicator_type": indicator.indicator_type,
            }

        return None

    connections = []

    for relationship in relationships:
        source = resolve_endpoint(
            relationship.source_document_id,
            relationship.source_indicator_id,
        )
        target = resolve_endpoint(
            relationship.target_document_id,
            relationship.target_indicator_id,
        )

        # Ignore malformed or unresolved relationships.
        if source is None or target is None:
            continue

        connections.append(
            {
                "relationship_id": relationship.id,
                "relationship_type": relationship.relationship_type,
                "description": relationship.description,
                "confidence": relationship.confidence,
                "source": source,
                "target": target,
            }
        )

    # Find documents associated with the indicators in these connections.
    related_document_ids = set(document_endpoint_ids)

    if indicator_endpoint_ids:
        linked_document_ids = session.scalars(
            select(DocumentIndicator.document_id).where(
                DocumentIndicator.indicator_id.in_(indicator_endpoint_ids)
            )
        ).all()
        related_document_ids.update(linked_document_ids)

    related_documents = session.scalars(
        select(Document).where(Document.id.in_(related_document_ids))
    ).all()

    return {
        "seed_document_ids": seed_ids,
        "connections": connections,
        "related_documents": [
            {
                "document_id": document.id,
                "title": document.title,
                "source_name": document.source_name,
            }
            for document in related_documents
        ],
        "relationship_count": len(connections),
        "related_indicator_count": len(indicator_endpoint_ids),
    }