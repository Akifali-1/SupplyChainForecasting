import torch
import pytest
from training.trainer import HybridGATLSTM

def test_hybrid_gat_lstm_initialization():
    model = HybridGATLSTM(
        in_channels=1, 
        max_timesteps=5, 
        gat_hidden=4, 
        gat_heads=6, 
        lstm_hidden=64, 
        dropout=0.5
    )
    assert model is not None
    assert isinstance(model, torch.nn.Module)

def test_hybrid_gat_lstm_forward_shape():
    model = HybridGATLSTM(
        in_channels=1, 
        max_timesteps=5, 
        gat_hidden=4, 
        gat_heads=6, 
        lstm_hidden=64, 
        dropout=0.5
    )
    
    # Mock data: 10 nodes, 5 timesteps, 1 channel (matching max_timesteps)
    x = torch.randn(10, 5, 1)
    
    # Mock edge index (source, target) pairs -> shape [2, num_edges]
    edge_index = torch.tensor([
        [0, 1, 1, 2, 2, 3, 4, 5, 6, 7], 
        [1, 0, 2, 1, 3, 2, 5, 4, 7, 6]
    ], dtype=torch.long)
    
    # Set to eval mode to disable dropout/noise during shape testing
    model.eval()
    
    with torch.no_grad():
        out = model(x, edge_index)
        
    # Output should predict 1 future value per node: (10, 1)
    assert out.shape == (10, 1)
