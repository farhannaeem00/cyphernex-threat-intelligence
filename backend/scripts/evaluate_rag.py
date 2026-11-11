import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.services.rag.evaluation import evaluate_queries, log_evaluation
from app.db.session import settings

parser=argparse.ArgumentParser(); parser.add_argument('--input',default='data/evaluation/queries.jsonl'); parser.add_argument('--output',default='reports/rag_metrics.json'); parser.add_argument('--k',type=int,default=5)
args=parser.parse_args(); metrics=evaluate_queries(args.input,args.k)
Path(args.output).parent.mkdir(parents=True,exist_ok=True); Path(args.output).write_text(json.dumps(metrics,indent=2),encoding='utf-8')
log_evaluation(metrics,{"embedding_model":settings.EMBEDDING_MODEL,"retrieval":"semantic_lexical_hybrid","k":args.k})
print(json.dumps(metrics,indent=2))
