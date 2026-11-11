"""Retrieval metrics over a human-labelled JSONL evaluation set."""
import json, math, os, time
from pathlib import Path
from app.services.rag.retrieval_service import retrieve_evidence


def evaluate_queries(path: str, k: int = 5) -> dict:

    rows = [
        json.loads(line)
        for line in Path(path).read_text(encoding="utf-8-sig").splitlines()
        if line.strip()
]
    
    if not rows:
        raise ValueError("Evaluation set is empty")
    precisions, recalls, reciprocal_ranks, latencies = [], [], [], []
    for row in rows:
        query = str(row["query"])
        relevant = {int(x) for x in row.get("relevant_document_ids", [])}
        if not relevant:
            continue
        start = time.perf_counter()
        hits = retrieve_evidence(query, limit=k)
        latencies.append((time.perf_counter() - start) * 1000)
        ranked = [int(hit["document_id"]) for hit in hits]
        found = [doc_id for doc_id in ranked if doc_id in relevant]
        precisions.append(len(found) / k)
        recalls.append(len(set(found)) / len(relevant))
        reciprocal_ranks.append(1 / (next((i + 1 for i, doc_id in enumerate(ranked) if doc_id in relevant), math.inf)))
    if not precisions:
        raise ValueError("No labelled evaluation queries with relevant_document_ids were found")
    return {"queries_evaluated": len(precisions), "precision_at_k": sum(precisions)/len(precisions), "recall_at_k": sum(recalls)/len(recalls), "mrr": sum(reciprocal_ranks)/len(reciprocal_ranks), "mean_latency_ms": sum(latencies)/len(latencies), "k": k}


def log_evaluation(metrics: dict, params: dict | None = None) -> None:
    import mlflow
    from app.db.session import settings
    mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)
    mlflow.set_experiment(settings.MLFLOW_EXPERIMENT_NAME)
    with mlflow.start_run():
        mlflow.log_params(params or {})
        mlflow.log_metrics({key: value for key, value in metrics.items() if isinstance(value, (int, float))})
        mlflow.log_dict(metrics, "evaluation/metrics.json")
