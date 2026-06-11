import pytest
from prediction.agents import ProcurementAuditorAgent, VendorNegotiatorAgent, MultiAgentOrchestrator

def test_procurement_auditor_agent():
    agent = ProcurementAuditorAgent(use_llm=False)
    
    # Mock items snapshot
    mock_items = [
        {
            "product_id": "PRODUCT_A",
            "stock_status": "critical",
            "current_stock": 10,
            "rop": 50,
            "safety_stock": 20,
            "lead_time_days": 3,
            "avg_daily_forecast": 5.0
        },
        {
            "product_id": "PRODUCT_B",
            "stock_status": "ok",
            "current_stock": 100,
            "rop": 50,
            "safety_stock": 20,
            "lead_time_days": 3,
            "avg_daily_forecast": 5.0
        }
    ]
    
    brief = agent.audit(mock_items)
    assert brief is not None
    assert "critical_replenishments" in brief
    
    # Only PRODUCT_A should be audited (status = critical)
    replenishments = brief["critical_replenishments"]
    assert len(replenishments) == 1
    assert replenishments[0]["product_id"] == "PRODUCT_A"
    assert replenishments[0]["suggested_order_qty"] == 60  # (target = rop + safety_stock = 70. 70 - 10 = 60)

def test_vendor_negotiator_agent():
    agent = VendorNegotiatorAgent(use_llm=False)
    
    mock_brief_item = {
        "product_id": "PRODUCT_A",
        "suggested_order_qty": 180  # This should be auto-bumped to 200 for a discount tier (25% buffer of 200 threshold)
    }
    
    proposal = agent.negotiate_item(mock_brief_item)
    assert proposal is not None
    assert proposal["product_id"] == "PRODUCT_A"
    assert proposal["optimized_qty"] == 200
    assert proposal["discount_percentage"] > 0
    assert proposal["estimated_savings"] > 0
    assert "negotiation_transcript" in proposal
    assert len(proposal["agent_actions"]) > 0

def test_multi_agent_orchestrator():
    orchestrator = MultiAgentOrchestrator(use_llm=False)
    mock_items = [
        {
            "product_id": "PRODUCT_A",
            "stock_status": "critical",
            "current_stock": 10,
            "rop": 50,
            "safety_stock": 20,
            "lead_time_days": 3,
            "avg_daily_forecast": 5.0
        }
    ]
    
    result = orchestrator.run_procurement_audit(mock_items)
    assert result is not None
    assert "proposals" in result
    assert len(result["proposals"]) == 1
    assert result["proposals"][0]["product_id"] == "PRODUCT_A"
    assert "agent_metadata" in result
