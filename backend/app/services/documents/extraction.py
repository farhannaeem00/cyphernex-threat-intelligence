from pathlib import Path
from io import BytesIO

class DocumentExtractionError(ValueError):
    pass

def extract_text(filename: str, payload: bytes) -> str:
    suffix = Path(filename).suffix.lower()
    try:
        if suffix == ".txt":
            text = payload.decode("utf-8-sig")
        elif suffix == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(BytesIO(payload), strict=False)
            if reader.is_encrypted:
                try: reader.decrypt("")
                except Exception as exc: raise DocumentExtractionError("Encrypted PDFs are not supported.") from exc
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
        elif suffix == ".docx":
            from docx import Document as DocxDocument
            doc = DocxDocument(BytesIO(payload))
            parts = [p.text for p in doc.paragraphs if p.text.strip()]
            for table in doc.tables:
                for row in table.rows: parts.append(" | ".join(cell.text for cell in row.cells))
            text = "\n".join(parts)
        else: raise DocumentExtractionError("Only PDF, DOCX, and TXT files are supported.")
    except DocumentExtractionError: raise
    except Exception as exc: raise DocumentExtractionError(f"Could not extract text from {filename}. The file may be corrupt or malformed.") from exc
    text = text.replace("\x00", "").strip()
    if not text: raise DocumentExtractionError("No extractable text was found in this file.")
    return text
