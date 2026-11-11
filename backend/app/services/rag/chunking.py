from dataclasses import dataclass

@dataclass(frozen=True)
class TextChunk:
    chunk_index: int
    text: str
    start_offset: int
    end_offset: int

def chunk_text(text: str, *, chunk_size: int = 1200, overlap: int = 180) -> list[TextChunk]:
    if chunk_size < 1:
        raise ValueError("chunk_size must be greater than zero")
    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be >= 0 and smaller than chunk_size")
    if not text or not text.strip():
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            floor = start + chunk_size // 2
            boundary = max(text.rfind("\\n", floor, end), text.rfind(" ", floor, end))
            if boundary > start:
                end = boundary
        body = text[start:end]
        if body.strip():
            chunks.append(TextChunk(len(chunks), body, start, end))
        if end >= len(text):
            break
        start = max(start + 1, end - overlap)
    return chunks
