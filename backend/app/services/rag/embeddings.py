from typing import Any
import httpx
from app.db.session import settings

class EmbeddingServiceError(RuntimeError):
    pass

class OllamaEmbeddingService:
    """Local embedding client using Ollama's /api/embed endpoint."""
    def __init__(self, base_url: str | None = None, model: str | None = None, timeout_seconds: float = 120):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.EMBEDDING_MODEL
        self.timeout_seconds = timeout_seconds

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if any(not isinstance(t, str) or not t.strip() for t in texts):
            raise ValueError("Texts to embed must be non-empty strings")
        try:
            response = httpx.post(f"{self.base_url}/api/embed", json={"model": self.model, "input": texts}, timeout=self.timeout_seconds)
            response.raise_for_status()
            payload: dict[str, Any] = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise EmbeddingServiceError(
                f"Could not create embeddings using Ollama model '{self.model}'. "
                "Check Ollama is running and the model is installed."
            ) from exc
        embeddings = payload.get("embeddings")
        if not isinstance(embeddings, list) or len(embeddings) != len(texts):
            raise EmbeddingServiceError("Ollama returned an unexpected embedding response")
        result = []
        expected_dim = None
        for item in embeddings:
            if not isinstance(item, list) or not item:
                raise EmbeddingServiceError("Ollama returned an empty embedding")
            try:
                vector = [float(x) for x in item]
            except (TypeError, ValueError) as exc:
                raise EmbeddingServiceError("Ollama returned a non-numeric embedding") from exc
            if expected_dim is None:
                expected_dim = len(vector)
            elif len(vector) != expected_dim:
                raise EmbeddingServiceError("Embedding dimensions differ in one response")
            result.append(vector)
        return result

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
