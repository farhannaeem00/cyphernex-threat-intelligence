import hashlib
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.db.session import engine
from app.models import Document, DocumentChunk
from app.services.rag.chunking import chunk_text
from app.services.rag.embeddings import OllamaEmbeddingService

def index_documents(document_ids: list[int] | None = None, batch_size: int = 16) -> dict:
    """Chunk and embed real documents already stored in the database."""
    if not 1 <= batch_size <= 64:
        raise ValueError("batch_size must be between 1 and 64")
    embedder = OllamaEmbeddingService()
    stats = {"documents_checked": 0, "documents_indexed": 0, "chunks_created": 0, "documents_skipped_empty": 0}
    with Session(engine) as session:
        statement = select(Document).order_by(Document.id)
        if document_ids:
            statement = statement.where(Document.id.in_(document_ids))
        docs = session.scalars(statement).all()
        for doc in docs:
            stats["documents_checked"] += 1
            text = doc.content or ""
            if not text.strip():
                stats["documents_skipped_empty"] += 1
                continue
            chunks = chunk_text(text)
            if not chunks:
                stats["documents_skipped_empty"] += 1
                continue
            # Skip only if every chunk matches the current content and model.
            current = session.scalars(select(DocumentChunk).where(DocumentChunk.document_id == doc.id).order_by(DocumentChunk.chunk_index)).all()
            full_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
            if current and len(current) == len(chunks) and all(c.content_sha256 == hashlib.sha256(ch.text.encode("utf-8")).hexdigest() and c.embedding_model == embedder.model and c.embedding for c, ch in zip(current, chunks)):
                continue
            vectors = []
            for offset in range(0, len(chunks), batch_size):
                vectors.extend(embedder.embed_documents([c.text for c in chunks[offset:offset + batch_size]]))
            session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
            for chunk, vector in zip(chunks, vectors):
                session.add(DocumentChunk(
                    document_id=doc.id,
                    chunk_index=chunk.chunk_index,
                    content=chunk.text,
                    start_offset=chunk.start_offset,
                    end_offset=chunk.end_offset,
                    embedding=vector,
                    embedding_model=embedder.model,
                    content_sha256=hashlib.sha256(chunk.text.encode("utf-8")).hexdigest(),
                ))
            session.commit()
            stats["documents_indexed"] += 1
            stats["chunks_created"] += len(chunks)
    return stats
