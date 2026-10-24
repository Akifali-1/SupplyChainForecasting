import pytest
import pandas as pd
from utils.data_loader import DataLoader
import os

def test_data_loader_initialization():
    loader = DataLoader()
    assert loader is not None
    assert hasattr(loader, 'upload_path')

def test_data_loader_sample_dataset():
    loader = DataLoader()
    sample = loader.create_sample_dataset(size="small")
    
    assert sample is not None
    assert "nodes" in sample
    assert "edges" in sample
    assert "demand" in sample
    
    assert isinstance(sample["nodes"], pd.DataFrame)
    assert isinstance(sample["edges"], pd.DataFrame)
    assert isinstance(sample["demand"], pd.DataFrame)
    
    # Small size has specific dimensions defined in data_loader.py
    assert len(sample["nodes"]) == 50
    assert len(sample["edges"]) == 100
    assert len(sample["demand"]) == 30

def test_data_quality_validation():
    loader = DataLoader()
    sample = loader.create_sample_dataset(size="small")
    
    validation = loader.validate_data_quality(sample)
    
    assert validation is not None
    assert "is_valid" in validation
    assert validation["is_valid"] is True
    assert validation["score"] > 0


def test_data_loader_accepts_stgt_processed_filenames(tmp_path):
    loader = DataLoader()
    loader.upload_path = str(tmp_path)
    company = tmp_path / "company_a"
    company.mkdir()
    pd.DataFrame({"Node": ["A", "B"], "Plant": ["", ""]}).to_csv(company / "nodes.csv", index=False)
    pd.DataFrame({"Plant": [""], "node1": ["A"], "node2": ["B"]}).to_csv(
        company / "Edges (Plant).csv", index=False
    )
    pd.DataFrame({"Date": ["2024-01-01"], "A": [3], "B": [4]}).to_csv(
        company / "Sales Order.csv", index=False
    )

    loaded = loader.load_company_data("company_a")
    assert loaded is not None
    assert list(loaded["demand"].columns) == ["Date", "A", "B"]
    assert list(loaded["edges"].columns) == ["Plant", "node1", "node2"]
