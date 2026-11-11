import math
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import engine
from app.models import Document, DocumentChunk
from app.services.rag.embeddings import OllamaEmbeddingService

def _cosine(a: list[float], b: list[float]) -> float:
    if len(a) != len(b) or not a:
        return 0.0
    dot = sum(x*y for x, y in zip(a,b))
    na = math.sqrt(sum(x*x for x in a))
    nb = math.sqrt(sum(y*y for y in b))
    return dot / (na*nb) if na and nb else 0.0

def retrieve_evidence(query: str, limit: int = 6, document_ids: list[int] | None = None) -> list[dict]:
    """Hybrid retrieval: embedding similarity plus simple lexical overlap.

    JSONB vectors keep the prototype usable on PostgreSQL installations without
    pgvector. For large corpora, migrate the embedding column to pgvector and
    execute similarity search in PostgreSQL.
    """
    query = query.strip()
    if not query:
        raise ValueError("query cannot be empty")
    if not 1 <= limit <= 20:
        raise ValueError("limit must be between 1 and 20")
    query_vector = OllamaEmbeddingService().embed_query(query)
    tokens = {t.lower().strip(".,:;!?()[]{}'\"") for t in query.split() if len(t) > 2}
    with Session(engine) as session:
        stmt = select(DocumentChunk, Document).join(Document, Document.id == DocumentChunk.document_id)
        if document_ids:
            stmt = stmt.where(Document.id.in_(document_ids))
        rows = session.execute(stmt).all()
    scored = []
    for chunk, doc in rows:
        vector = chunk.embedding
        semantic = _cosine(query_vector, vector) if isinstance(vector, list) else 0.0
        body_tokens = {t.lower().strip(".,:;!?()[]{}'\"") for t in chunk.content.split()}
        lexical = len(tokens & body_tokens) / max(1, len(tokens))
        # Semantic retrieval dominates; lexical overlap improves exact IOC matches.
        score = 0.82 * max(0.0, semantic) + 0.18 * lexical
        scored.append((score, chunk, doc))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "source_id": f"S{idx}",
            "chunk_id": chunk.id,
            "document_id": doc.id,
            "document_title": doc.title,
            "source_name": doc.source_name,
            "source_url": doc.source_url,
            "external_id": doc.external_id,
            "published_at": doc.published_at.isoformat() if doc.published_at else None,
            "chunk_text": chunk.content,
            "start_offset": chunk.start_offset,
            "end_offset": chunk.end_offset,
            "score": round(float(score), 6),
        }
        for idx, (score, chunk, doc) in enumerate(scored[:limit], start=1)
    ]
