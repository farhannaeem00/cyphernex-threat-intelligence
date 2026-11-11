
from fastapi import FastAPI
from app.api.routes.search import router as search_router
from app.api.routes.graph import router as graph_router
from app.api.routes.risks import router as risks_router
from app.api.routes.investigations import router as investigations_router
from app.api.routes.documents import router as documents_router
app = FastAPI(
    title="CypherNex Threat Intelligence API",
    description="AI-powered digital threat intelligence and investigation assistant.",
    version="0.1.0",
)
app.include_router(search_router, prefix="/api")
app.include_router(graph_router, prefix="/api")
app.include_router(risks_router, prefix="/api")
app.include_router(investigations_router, prefix="/api")
app.include_router(documents_router, prefix="/api")


@app.get("/")
def root():
    return {
        "message": "CypherNex API is running",
        "status": "ok",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "cyphernex-backend",
    }
