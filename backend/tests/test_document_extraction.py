import pytest
from app.services.documents.extraction import extract_text, DocumentExtractionError

def test_extract_txt():
    assert "threat" in extract_text("notes.txt", b"Threat intelligence\n").lower()

def test_reject_unsupported_extension():
    with pytest.raises(DocumentExtractionError): extract_text("notes.exe", b"x")

def test_reject_empty_text():
    with pytest.raises(DocumentExtractionError): extract_text("empty.txt", b"  \n")

def test_reject_invalid_utf8():
    with pytest.raises(DocumentExtractionError): extract_text("bad.txt", b"\xff\xfe")
