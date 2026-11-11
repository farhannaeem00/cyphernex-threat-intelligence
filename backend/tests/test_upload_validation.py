import pytest
from app.services.documents.upload_service import _safe_name, ALLOWED

def test_safe_filename_removes_path_components():
    assert _safe_name('../../evil file.txt') == 'evil_file.txt'

def test_supported_extensions():
    assert ALLOWED == {'.pdf', '.docx', '.txt'}
