import os
import json
import random
from typing import Dict, List, Any
import google.generativeai as genai

# Setup Gemini Config
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

class ProcurementAuditorAgent:
    """Agent A: Audits inventory levels and forecasts to define stockout risks."""
    
    def __init__(self, use_llm: bool = False):
        self.use_llm = use_llm and bool(GEMINI_KEY)
        
    def audit(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Audits inventory snapshot items to find stockout risks and outputs a Procurement Brief."""
        critical_items = []
        for item in items:
            status = item.get("stock_status")
            if status in ["critical", "reorder_needed"]:
                # Basic parameters
                product_id = item.get("product_id")
                current_stock = int(item.get("current_stock", 0))
                rop = int(item.get("rop", 0))
                safety_stock = int(item.get("safety_stock", 0))
                lead_time = int(item.get("lead_time_days", 3))
                avg_daily = float(item.get("avg_daily_forecast", 10.0))
                
                # Compute deficit to reach Target Inventory level (ROP + safety stock or equivalent)
                target_level = rop + safety_stock
                deficit = max(50, target_level - current_stock)
                
                critical_items.append({
                    "product_id": product_id,
                    "current_stock": current_stock,
                    "rop": rop,
                    "safety_stock": safety_stock,
                    "lead_time_days": lead_time,
                    "avg_daily_forecast": avg_daily,
                    "suggested_order_qty": deficit,
                    "risk_reason": "Stock is below reorder point" if status == "reorder_needed" else "Stock is critically low"
                })
                
        brief = {
            "auditor_agent_id": "Procurement_Auditor_Alpha",
            "audit_summary": f"Identified {len(critical_items)} items requiring replenishment.",
            "critical_replenishments": critical_items
        }
        
        if not self.use_llm or not critical_items:
            return brief
            
        # Optional: Enrich brief description using LLM
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            prompt = (
                f"You are the Procurement Auditor Agent. Based on the following audited raw inventory data, "
                f"write a brief, professional summary (max 3 sentences) explaining the urgency: "
                f"{json.dumps(critical_items)}"
            )
            response = model.generate_content(prompt)
            brief["audit_summary"] = response.text.strip()
        except Exception as e:
            print(f"[Auditor Agent] Gemini enrichment failed, using default summary. Error: {e}")
            
        return brief

class VendorNegotiatorAgent:
    """Agent B: Matches Procurement Briefs to Supplier terms, optimizes sizes, and simulates negotiations."""
    
    def __init__(self, use_llm: bool = False):
        self.use_llm = use_llm and bool(GEMINI_KEY)
        # Mock supplier catalog database
        self.suppliers = {
            "A": {"name": "Apex Logistics & Supplies", "moq": 100, "discount_threshold": 200, "discount_rate": 0.05, "base_cost": 15.0},
            "B": {"name": "Prime Industrial Distributors", "moq": 50, "discount_threshold": 150, "discount_rate": 0.06, "base_cost": 22.5},
            "C": {"name": "Global Warehouse Networks", "moq": 80, "discount_threshold": 250, "discount_rate": 0.08, "base_cost": 9.75}
        }
        
    def negotiate_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        """Applies negotiation rules for a single replenishment item."""
        product_id = item.get("product_id")
        qty_needed = int(item.get("suggested_order_qty", 50))
        
        # Select supplier based on character sum to make it fully stable (python hash is randomized)
        char_sum = sum(ord(c) for c in product_id)
        supp_key = list(self.suppliers.keys())[char_sum % len(self.suppliers)]
        supplier = self.suppliers[supp_key]
        
        moq = supplier["moq"]
        discount_thresh = supplier["discount_threshold"]
        discount_rate = supplier["discount_rate"]
        base_cost = supplier["base_cost"]
        
        # Step 1: Ensure MOQ is satisfied
        final_qty = max(qty_needed, moq)
        is_moq_bump = final_qty > qty_needed
        
        # Step 2: Check if we are near a discount threshold and if bumping is cheaper
        is_discount_bump = False
        if final_qty < discount_thresh:
            diff = discount_thresh - final_qty
            # If we are within 25% of the discount threshold, auto-bump to secure savings
            if diff <= (discount_thresh * 0.25):
                final_qty = discount_thresh
                is_discount_bump = True
                
        # Calculate pricing
        has_discount = final_qty >= discount_thresh
        actual_discount = discount_rate if has_discount else 0.0
        unit_cost = base_cost * (1.0 - actual_discount)
        total_cost = final_qty * unit_cost
        
        base_total_no_discount = final_qty * base_cost
        savings = base_total_no_discount - total_cost
        
        # Compile structured logs for visual display
        procurement_logs = []
        if is_moq_bump:
            procurement_logs.append(f"Adjusted quantity from {qty_needed} to {final_qty} to satisfy Vendor's MOQ of {moq} units.")
        if is_discount_bump:
            procurement_logs.append(f"Auto-bumped quantity to {final_qty} to unlock supplier volume discount ({int(discount_rate*100)}% savings).")
        if not procurement_logs:
            procurement_logs.append(f" replenishment quantity of {final_qty} validated successfully.")
            
        # Simulate Email Dialogues (Mock or LLM)
        negotiation_transcript = ""
        if self.use_llm:
            try:
                model = genai.GenerativeModel('gemini-1.5-flash')
                prompt = (
                    f"Write a simulated formal email negotiation thread (2 short emails: one from Buyer Agent, "
                    f"one from Supplier Representative) where the buyer requests a better deal for order quantity {final_qty} "
                    f"of {product_id} and the supplier '{supplier['name']}' agrees to apply the {int(actual_discount*100)}% discount. "
                    f"Keep emails brief, professional, and display them in a clear readable chat format. DO NOT use markdown headers, just plain text with name labels."
                )
                response = model.generate_content(prompt)
                negotiation_transcript = response.text.strip()
            except Exception as e:
                print(f"[Negotiator Agent] LLM dialogue generation failed: {e}")
                
        if not negotiation_transcript:
            # Fallback deterministic dialog simulation
            negotiation_transcript = (
                f"From: Buyer Agent (procurement@company.com)\n"
                f"To: {supplier['name']} Sales (sales@{''.join(supplier['name'].lower().split()[:2])}.com)\n"
                f"Subject: Reorder Procurement request - {product_id}\n\n"
                f"Hello,\nWe are looking to place an order for {final_qty} units of {product_id}. "
                f"Could you please confirm if we qualify for any volume discounts on this batch?\n\n"
                f"Best,\nProcurement Agent B\n\n"
                f"--------------------------------------------------\n\n"
                f"From: {supplier['name']} Sales\n"
                f"To: Buyer Agent\n\n"
                f"Hi Procurement Team,\nThank you for reaching out. Yes, since your order meets our threshold of "
                f"{discount_thresh} units, we have successfully applied a {int(actual_discount*100)}% volume discount to this order. "
                f"Unit price has been updated to ${unit_cost:.2f}. We will ship immediately upon authorization.\n\n"
                f"Kind regards,\nSupplier Sales Team"
            )
            
        return {
            "product_id": product_id,
            "supplier_name": supplier["name"],
            "base_qty": qty_needed,
            "optimized_qty": final_qty,
            "base_unit_cost": base_cost,
            "discount_percentage": int(actual_discount * 100),
            "negotiated_unit_cost": unit_cost,
            "total_cost": total_cost,
            "estimated_savings": savings,
            "agent_actions": procurement_logs,
            "negotiation_transcript": negotiation_transcript
        }

class MultiAgentOrchestrator:
    """Orchestrates collaboration between the Auditor Agent and Negotiator Agent."""
    
    def __init__(self, use_llm: bool = False):
        self.auditor = ProcurementAuditorAgent(use_llm=use_llm)
        self.negotiator = VendorNegotiatorAgent(use_llm=use_llm)
        
    def run_procurement_audit(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Runs the sequential multi-agent workflow."""
        # Step 1: Agent A audits inventory and creates replenishment brief
        brief = self.auditor.audit(items)
        critical_items = brief.get("critical_replenishments", [])
        
        # Step 2: Agent B negotiates supplier contracts for each item
        proposals = []
        for item in critical_items:
            proposal = self.negotiator.negotiate_item(item)
            proposals.append(proposal)
            
        return {
            "summary": brief.get("audit_summary", "No replenishments required."),
            "proposals": proposals,
            "agent_metadata": {
                "auditor_agent": brief.get("auditor_agent_id", "Auditor_Alpha"),
                "negotiator_agent": "Negotiator_Beta_AutoOptimize",
                "gemini_active": bool(GEMINI_KEY)
            }
        }
