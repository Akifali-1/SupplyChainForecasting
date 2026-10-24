import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.nn import TransformerConv

class TemporalAttention(nn.Module):
    """Temporal Encoder using Self-Attention to capture time-series trends."""
    def __init__(self, in_channels, d_model, max_timesteps, nhead=2, dropout=0.1):
        super(TemporalAttention, self).__init__()
        self.input_projection = nn.Linear(in_channels, d_model)
        self.pos_encoder = nn.Parameter(torch.zeros(1, max_timesteps, d_model))
        
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=d_model * 2,
            dropout=dropout, batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=1)
        self.output_pooling = nn.Linear(max_timesteps, 1)

    def forward(self, x):
        # x shape: [num_nodes, max_timesteps, in_channels]
        if x.ndim != 3:
            raise ValueError("TemporalAttention expects [nodes, timesteps, channels]")
        if x.shape[1] != self.pos_encoder.shape[1]:
            raise ValueError(
                f"Expected exactly {self.pos_encoder.shape[1]} timesteps, received {x.shape[1]}"
            )
        x = self.input_projection(x) + self.pos_encoder[:, :x.shape[1], :]
        x = self.transformer_encoder(x)  # [num_nodes, max_timesteps, d_model]
        # Pool across the time dimension to get a single representation per node
        x = x.transpose(1, 2)  # [num_nodes, d_model, max_timesteps]
        x = self.output_pooling(x).squeeze(-1)  # [num_nodes, d_model]
        return x

class STGTModel(nn.Module):
    """Spatio-Temporal Graph Transformer combining Temporal Attention & Spatial Graph Transformer."""
    def __init__(self, max_timesteps=14, d_model=64, spatial_heads=4, dropout=0.3):
        super(STGTModel, self).__init__()
        self.max_timesteps = max_timesteps
        self.d_model = d_model
        self.spatial_heads = spatial_heads
        self.dropout_rate = dropout

        if max_timesteps < 1:
            raise ValueError("max_timesteps must be positive")
        if spatial_heads < 1 or d_model < 1 or d_model % spatial_heads != 0:
            raise ValueError("d_model must be divisible by a positive spatial_heads")
        
        # 1. Temporal Component
        self.temporal_encoder = TemporalAttention(
            in_channels=1, d_model=d_model, max_timesteps=max_timesteps, dropout=dropout
        )
        
        # 2. Node Type Embeddings (Region=0, City=1, Store=2, Family=3)
        self.type_embedding = nn.Embedding(num_embeddings=4, embedding_dim=d_model)
        
        # 3. Spatial Component (Graph Transformer layers)
        self.conv1 = TransformerConv(
            in_channels=d_model, out_channels=d_model // spatial_heads, 
            heads=spatial_heads, dropout=dropout
        )
        self.conv2 = TransformerConv(
            in_channels=d_model, out_channels=d_model // spatial_heads, 
            heads=spatial_heads, dropout=dropout
        )
        
        # 4. Output Head
        self.fc = nn.Linear(d_model, 1)
        self.dropout = dropout

    def forward(self, x, edge_index, node_types):
        # x shape: [num_nodes, max_timesteps, 1]
        if x.ndim != 3 or x.shape[1] != self.max_timesteps or x.shape[2] != 1:
            raise ValueError(
                f"STGT expects [nodes, {self.max_timesteps}, 1], received {tuple(x.shape)}"
            )
        if node_types.ndim != 1 or node_types.shape[0] != x.shape[0]:
            raise ValueError("node_types must contain one value per graph node")
        if node_types.numel() and (node_types.min() < 0 or node_types.max() >= 4):
            raise ValueError("node_types must contain values in the range [0, 3]")
        if edge_index.ndim != 2 or edge_index.shape[0] != 2:
            raise ValueError("edge_index must have shape [2, num_edges]")
        
        # Capture temporal dependencies
        h_temp = self.temporal_encoder(x)  # [num_nodes, d_model]
        
        # Add spatial node type embeddings
        h_types = self.type_embedding(node_types)  # [num_nodes, d_model]
        h = h_temp + h_types
        
        # Perform Graph Transformer message passing
        h = self.conv1(h, edge_index)
        h = F.elu(h)
        h = F.dropout(h, p=self.dropout, training=self.training)
        
        h = self.conv2(h, edge_index)
        h = F.elu(h)
        h = F.dropout(h, p=self.dropout, training=self.training)
        
        # Final linear prediction
        out = self.fc(h)  # [num_nodes, 1]
        return out
