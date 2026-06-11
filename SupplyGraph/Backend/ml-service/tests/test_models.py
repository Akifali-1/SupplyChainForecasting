import torch
import pytest
from models.stgt import STGTModel

def test_stgt_model_initialization():
    model = STGTModel(
        max_timesteps=14, 
        d_model=64, 
        spatial_heads=4, 
        dropout=0.3
    )
    assert model is not None
    assert isinstance(model, torch.nn.Module)

def test_stgt_model_forward_shape():
    model = STGTModel(
        max_timesteps=14, 
        d_model=64, 
        spatial_heads=4, 
        dropout=0.3
    )
    
    # Mock data: 10 nodes, 14 timesteps, 1 channel (matching max_timesteps=14)
    x = torch.randn(10, 14, 1)
    
    # Mock edge index (source, target) pairs -> shape [2, num_edges]
    edge_index = torch.tensor([
        [0, 1, 1, 2, 2, 3, 4, 5, 6, 7], 
        [1, 0, 2, 1, 3, 2, 5, 4, 7, 6]
    ], dtype=torch.long)
    
    # Mock node types: 10 nodes with types in range [0, 3]
    node_types = torch.tensor([0, 1, 2, 3, 2, 3, 3, 2, 3, 3], dtype=torch.long)
    
    # Set to eval mode to disable dropout during shape testing
    model.eval()
    
    with torch.no_grad():
        out = model(x, edge_index, node_types)
        
    # Output should predict 1 future value per node: (10, 1)
    assert out.shape == (10, 1)
