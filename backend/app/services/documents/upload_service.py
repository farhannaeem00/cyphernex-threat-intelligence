import hashlib, re
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import engine, settings
from app.models import Document
from app.services.documents.extraction import extract_text
from app.services.rag.indexing_service import index_documents

ALLOWED = {".pdf", ".docx", ".txt"}
def _safe_name(name: str) -> str:
    base = Path(name or "document").name
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._")
    return (base or "document")[:255]
def serialize_document(doc):
    return {"id":doc.id,"title":doc.title,"original_filename":doc.original_filename,"file_type":doc.file_type,"status":doc.status,"source_name":doc.source_name,"created_at":doc.created_at.isoformat() if doc.created_at else None,"sha256_hash":doc.sha256_hash}
def upload_document(filename: str, payload: bytes) -> dict:
    safe_name=_safe_name(filename); suffix=Path(safe_name).suffix.lower()
    if suffix not in ALLOWED: raise ValueError("Unsupported file type. Upload a PDF, DOCX, or TXT file.")
    if not payload: raise ValueError("The uploaded file is empty.")
    if len(payload)>settings.MAX_UPLOAD_SIZE_MB*1024*1024: raise ValueError(f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB upload limit.")
    digest=hashlib.sha256(payload).hexdigest()
    with Session(engine) as session:
        existing=session.scalar(select(Document).where(Document.sha256_hash==digest))
        if existing: return {"duplicate":True,"document":serialize_document(existing)}
    extracted=extract_text(safe_name,payload)
    upload_dir=Path(settings.UPLOAD_DIR).resolve(); upload_dir.mkdir(parents=True,exist_ok=True)
    stored=upload_dir/f"{digest}{suffix}"
    if not stored.exists(): stored.write_bytes(payload)
    doc=Document(title=Path(safe_name).stem[:255],source_name="user_upload",original_filename=safe_name,file_type=suffix[1:],content=extracted,sha256_hash=digest,status="uploaded",raw_metadata={"storage_name":stored.name,"size_bytes":len(payload),"ingestion_method":"manual_upload"})
    with Session(engine) as session:
        existing=session.scalar(select(Document).where(Document.sha256_hash==digest))
        if existing: return {"duplicate":True,"document":serialize_document(existing)}
        session.add(doc); session.commit(); session.refresh(doc); document_id=doc.id
    try:
        stats=index_documents([document_id])
        with Session(engine) as session:
            saved=session.get(Document,document_id); saved.status="indexed"; session.commit(); session.refresh(saved)
            return {"duplicate":False,"indexing":stats,"document":serialize_document(saved)}
    except Exception as exc:
        with Session(engine) as session:
            saved=session.get(Document,document_id)
            if saved: saved.status="indexing_failed"; session.commit()
        return {"duplicate":False,"indexing_error":str(exc),"document_id":document_id,"status":"indexing_failed"}
def list_uploaded_documents(limit: int=100):
    with Session(engine) as session:
        docs=session.scalars(select(Document).where(Document.source_name=="user_upload").order_by(Document.id.desc()).limit(limit)).all()
        return [serialize_document(d) for d in docs]


def get_uploaded_document(document_id: int):
    from sqlalchemy import func
    from app.models import DocumentChunk
    with Session(engine) as session:
        doc=session.get(Document,document_id)
        if not doc or doc.source_name != "user_upload": return None
        chunks=session.scalar(select(func.count(DocumentChunk.id)).where(DocumentChunk.document_id==document_id)) or 0
        result=serialize_document(doc)
        result.update({"text_characters":len(doc.content or ""),"chunk_count":chunks,"metadata":doc.raw_metadata or {}})
        return result
