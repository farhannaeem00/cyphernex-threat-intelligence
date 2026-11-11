from app.services.rag.chunking import chunk_text

def test_empty_text_has_no_chunks():
    assert chunk_text("") == []
    assert chunk_text("   ") == []

def test_offsets_point_to_original_source():
    source = ("URLhaus suspicious URL record. " * 100).strip()
    chunks = chunk_text(source, chunk_size=180, overlap=25)
    assert len(chunks) > 1
    for chunk in chunks:
        assert source[chunk.start_offset:chunk.end_offset] == chunk.text

def test_chunking_is_deterministic():
    text = "x" * 1800
    assert chunk_text(text) == chunk_text(text)

def test_invalid_chunk_configuration_rejected():
    try:
        chunk_text("text", chunk_size=10, overlap=10)
    except ValueError:
        return
    raise AssertionError("Invalid overlap should raise ValueError")
