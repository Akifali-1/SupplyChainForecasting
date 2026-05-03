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
