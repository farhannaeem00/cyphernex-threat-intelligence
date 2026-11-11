import json
import pytest
from app.services.rag.evaluation import evaluate_queries

def test_evaluation_requires_labelled_queries(tmp_path):
    f=tmp_path/'q.jsonl'; f.write_text(json.dumps({'query':'x','relevant_document_ids':[]}),encoding='utf-8')
    with pytest.raises(ValueError,match='No labelled'):
        evaluate_queries(str(f))

def test_evaluation_rejects_empty_set(tmp_path):
    f=tmp_path/'q.jsonl'; f.write_text('',encoding='utf-8')
    with pytest.raises(ValueError,match='empty'):
        evaluate_queries(str(f))
