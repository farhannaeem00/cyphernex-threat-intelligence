from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from app.services.documents.upload_service import upload_document, list_uploaded_documents, get_uploaded_document
from app.db.session import settings
router=APIRouter(prefix="/documents",tags=["Documents"])
@router.post("/upload")
async def upload(file: UploadFile=File(...)):
    try:
        payload=await file.read(settings.MAX_UPLOAD_SIZE_MB*1024*1024+1)
        if len(payload)>settings.MAX_UPLOAD_SIZE_MB*1024*1024:
            raise HTTPException(status_code=413,detail=f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB} MB upload limit.")
        return upload_document(file.filename or "document",payload)
    except ValueError as exc: raise HTTPException(status_code=400,detail=str(exc)) from exc
    finally: await file.close()
@router.get("/")
def documents(limit:int=Query(100,ge=1,le=500)):
    rows=list_uploaded_documents(limit); return {"documents":rows,"count":len(rows)}

@router.get("/{document_id}")
def document_detail(document_id: int):
    result=get_uploaded_document(document_id)
    if result is None: raise HTTPException(status_code=404,detail="Uploaded document not found")
    return result

@router.post("/{document_id}/reindex")
def reindex_document(document_id: int):
    from sqlalchemy.orm import Session
    from app.db.session import engine
    from app.models import Document
    from app.services.rag.indexing_service import index_documents
    with Session(engine) as session:
        doc=session.get(Document,document_id)
        if not doc or doc.source_name != "user_upload": raise HTTPException(status_code=404,detail="Uploaded document not found")
    try:
        stats=index_documents([document_id])
        with Session(engine) as session:
            doc=session.get(Document,document_id); doc.status="indexed"; session.commit()
        return {"document_id":document_id,"status":"indexed","indexing":stats}
    except Exception as exc:
        with Session(engine) as session:
            doc=session.get(Document,document_id)
            if doc: doc.status="indexing_failed"; session.commit()
        raise HTTPException(status_code=503,detail=f"Indexing failed: {exc}") from exc
