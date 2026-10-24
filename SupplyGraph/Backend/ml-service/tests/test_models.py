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


def test_stgt_persists_architecture_and_rejects_wrong_window_shape():
    model = STGTModel(max_timesteps=6, d_model=12, spatial_heads=3, dropout=0.0)
    assert model.d_model == 12
    assert model.spatial_heads == 3
    assert model.dropout_rate == 0.0

    x = torch.randn(4, 5, 1)
    edge_index = torch.tensor([[0, 1], [1, 0]], dtype=torch.long)
    node_types = torch.zeros(4, dtype=torch.long)
    with pytest.raises(ValueError, match="exactly 6 timesteps"):
        model(x, edge_index, node_types)


def test_stgt_is_deterministic_in_eval_mode():
    torch.manual_seed(7)
    model = STGTModel(max_timesteps=4, d_model=8, spatial_heads=2, dropout=0.0)
    model.eval()
    x = torch.randn(3, 4, 1)
    edge_index = torch.tensor([[0, 1, 1, 2], [1, 0, 2, 1]], dtype=torch.long)
    node_types = torch.tensor([0, 2, 3], dtype=torch.long)
    with torch.no_grad():
        first = model(x, edge_index, node_types)
        second = model(x, edge_index, node_types)
    assert torch.equal(first, second)
