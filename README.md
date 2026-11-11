# CypherNex — AI-Powered Digital Threat Intelligence and Investigation Assistant

CypherNex ingests threat intelligence, stores source documents and indicators in PostgreSQL, indexes document passages with local Ollama embeddings, and supports search, graph exploration, risk analysis, and AI-assisted investigations through the existing modular LLM provider layer (Groq configured as the primary provider).

## Implemented capabilities

- Existing URLhaus ingestion, indicator extraction, provenance, relationship discovery, investigations, graph and risk APIs.
- User document upload for PDF, DOCX and TXT with extension/size checks, safe hash-based storage names, SHA-256 duplicate detection, extraction, PostgreSQL metadata, chunking, BGE-M3/Ollama embeddings and JSONB vector storage.
- Uploaded content is stored in the same `documents` and `document_chunks` tables used by hybrid RAG retrieval, so it is available to search and investigation retrieval without a separate index.
- DVC pipeline definition for labelled retrieval evaluation inputs and metrics. PostgreSQL remains the operational database; DVC versions datasets/artifacts only.
- MLflow experiment logging for Precision@K, Recall@K, MRR and measured mean retrieval latency. No scores are fabricated: metrics are produced only when a real labelled evaluation set is supplied and run.
- Docker Compose stack for PostgreSQL, FastAPI and the production-built React frontend, with persistent DB/upload/MLflow volumes and health checks.

## Local setup (Windows PowerShell)

Prerequisites: Python 3.12, Node.js 22, PostgreSQL, Ollama, and the `bge-m3` embedding model.

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your local `DATABASE_URL`, Groq key (if using Groq), and URLhaus key (only needed for URLhaus ingestion). Do not commit `.env`.

```powershell
ollama pull bge-m3
alembic upgrade head
uvicorn app.main:app --reload
```

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

The Vite development server proxies API requests only if configured in `vite.config.ts`; otherwise open the backend API at `http://127.0.0.1:8000` and set the frontend API base URL as appropriate. API docs: `http://127.0.0.1:8000/docs`.

## Document upload

Open **Documents** in the sidebar and upload a PDF, DOCX or TXT file (25 MB default). The API is `POST /api/documents/upload` with multipart field `file`; `GET /api/documents/` lists uploads. A duplicate SHA-256 hash returns the existing document rather than creating a second record. Extraction failures are rejected; embedding/indexing failures leave the document with `indexing_failed` status so it can be diagnosed and re-indexed after Ollama is available.

Files are stored under `backend/storage/uploads` by default, using content hashes as disk names. The original filename is metadata only. Uploaded document text and chunks are stored in PostgreSQL. Back up the database and upload volume together.

## DVC and reproducible RAG evaluation

Install DVC through `pip install -r backend/requirements.txt`, then initialize once:

```powershell
dvc init
dvc remote add -d localstore .dvc-storage
```

Create `data/evaluation/queries.jsonl` using real, manually reviewed labels. Each line must look like:

```json
{"query":"What infrastructure is associated with this indicator?","relevant_document_ids":[12,18]}
```

Version the evaluation set and run:

```powershell
dvc add data/evaluation/queries.jsonl
dvc repro
```

The example file is only a schema example, not a real benchmark. DVC remote `.dvc-storage` is local by default; configure a shared remote only if you intentionally want one. DVC does not replace PostgreSQL.

## MLflow

Default tracking URI is `file:./mlruns`; experiment name is `cyphernex-rag-evaluation`. Run `backend/scripts/evaluate_rag.py` from the backend environment after supplying labelled queries and valid document IDs. The script calls the actual RAG retriever and logs measured Precision@K, Recall@K, MRR, latency, K, embedding model and retrieval configuration. Evaluation requires a working DB, Ollama embedding service, indexed corpus and labelled queries. MLflow UI:

```powershell
mlflow ui --backend-store-uri ./mlruns
```

## Docker

Copy `backend/.env.example` to `backend/.env`, configure credentials and set `POSTGRES_PASSWORD` before exposing services. Then from the repository root:

```powershell
docker compose up --build
```

Frontend: `http://localhost:5173`; backend: `http://localhost:8000`. Compose creates its own PostgreSQL database and persistent volumes. Ollama is expected on the host at `host.docker.internal:11434`; ensure the model is installed on the host. The compose backend currently starts FastAPI; apply migrations once with `docker compose exec backend alembic upgrade head` before first use.

## Tests and quality checks

```powershell
cd backend
pytest -q
python -m compileall app tests scripts
```

```powershell
cd frontend
npm ci
npm run lint
npm run build
```

Some tests require environment settings and a reachable PostgreSQL/Ollama service; unit tests for extraction, validation, chunking and evaluation-set validation do not need live external services. Do not interpret an unrun integration test as a pass.

## Architecture notes

- PostgreSQL is the source of truth for documents, chunks, indicators, citations, findings, relationships and investigations.
- Embeddings remain JSONB to preserve the current implementation and avoid forcing pgvector installation or a schema conversion.
- Local BGE-M3 embedding calls go through Ollama. The LLM provider abstraction and Groq configuration remain unchanged.
- DVC versions evaluation data/artifacts; MLflow tracks experiment runs. Neither replaces PostgreSQL.
- Retrieval evaluation is meaningful only with curated relevance labels; context relevance and faithfulness are not fabricated or inferred from retrieval scores.
