
from fastapi import APIRouter
from sqlalchemy import select

from app.db.session import engine
from app.models import Document, Indicator, Relationship
from app.models.document_indicator import DocumentIndicator

router = APIRouter(prefix="/graph", tags=["Graph"])


@router.get("/")
def get_relationship_graph():
    with engine.connect() as connection:

        # 1. Retrieve documents.
        documents = connection.execute(
            select(
                Document.id,
                Document.title,
                Document.source_name,
            )
        ).mappings().all()

        # 2. Retrieve indicators.
        indicators = connection.execute(
            select(
                Indicator.id,
                Indicator.indicator_type,
                Indicator.normalized_value,
            )
        ).mappings().all()

        # 3. Retrieve document-indicator links.
        document_indicator_links = connection.execute(
            select(
                DocumentIndicator.document_id,
                DocumentIndicator.indicator_id,
            )
        ).mappings().all()

        # 4. Retrieve discovered relationships.
        relationships = connection.execute(
            select(
                Relationship.id,
                Relationship.source_document_id,
                Relationship.target_document_id,
                Relationship.source_indicator_id,
                Relationship.target_indicator_id,
                Relationship.relationship_type,
                Relationship.description,
                Relationship.confidence,
            )
        ).mappings().all()

    # 5. Build document nodes.
    nodes = [
        {
            "id": f"document-{doc['id']}",
            "type": "document",
            "label": doc["title"],
            "source": doc["source_name"],
        }
        for doc in documents
    ]

    # 6. Build indicator nodes.
    nodes.extend(
        [
            {
                "id": f"indicator-{indicator['id']}",
                "type": "indicator",
                "label": indicator["normalized_value"],
                "indicator_type": indicator["indicator_type"],
            }
            for indicator in indicators
        ]
    )

    edges = []

    # 7. Connect each document to its indicators.
    for link in document_indicator_links:
        edges.append(
            {
                "id": (
                    f"document-indicator-"
                    f"{link['document_id']}-{link['indicator_id']}"
                ),
                "source": f"document-{link['document_id']}",
                "target": f"indicator-{link['indicator_id']}",
                "relationship_type": "contains_indicator",
                "description": (
                    "This indicator was extracted from or associated "
                    "with this source document."
                ),
                "confidence": None,
            }
        )

    # 8. Add discovered document and indicator relationships.
    for rel in relationships:

        source_id = (
            f"document-{rel['source_document_id']}"
            if rel["source_document_id"] is not None
            else (
                f"indicator-{rel['source_indicator_id']}"
                if rel["source_indicator_id"] is not None
                else None
            )
        )

        target_id = (
            f"document-{rel['target_document_id']}"
            if rel["target_document_id"] is not None
            else (
                f"indicator-{rel['target_indicator_id']}"
                if rel["target_indicator_id"] is not None
                else None
            )
        )

        # Ignore malformed relationships with missing endpoints.
        if source_id is None or target_id is None:
            continue

        edges.append(
            {
                "id": f"relationship-{rel['id']}",
                "source": source_id,
                "target": target_id,
                "relationship_type": rel["relationship_type"],
                "description": rel["description"],
                "confidence": rel["confidence"],
            }
        )

    # 9. Calculate graph statistics.
    document_indicator_edges = len(document_indicator_links)
    discovered_relationship_edges = len(edges) - document_indicator_edges

    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "document_nodes": len(documents),
            "indicator_nodes": len(indicators),
            "document_indicator_relationships": document_indicator_edges,
            "discovered_relationships": discovered_relationship_edges,
            "relationships": len(edges),
        },
    }
