"""W3b — economic sight (prompt section) + decision prompt/parser.

The Brain's prompt gains a 'Your economic position' section, and a dedicated
decision prompt + a robust JSON parser turn the LLM's reply into a normalized
economic decision.
"""
from pathlib import Path

import yaml

from noesis_brain.prompts import build_system_prompt
from noesis_brain.prompts.economic_decision import (
    build_economic_decision_prompt,
    parse_economic_decision,
)
from noesis_brain.psyche import load_psyche
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"


def _load_full(yaml_path: Path):
    with open(yaml_path) as f:
        data = yaml.safe_load(f)
    return load_psyche(data=data), ThymosTracker.from_yaml(data.get("thymos", {})), TelosManager.from_yaml(data.get("telos", {}))


# ── Sight section in the system prompt ───────────────────────────────────────
class TestEconomicSight:
    def _state(self):
        return {
            "balance_wei": "1000",
            "outstanding_due": {"due_id": "d1", "amount_wei": "500", "amount_credit": "10"},
            "open_rfps": [{"notice_id": "n1", "function_type": "energy", "budget_wei": "400"}],
        }

    def test_economic_section_appears_when_state_provided(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos, economic_state=self._state())
        assert "economic position" in prompt.lower()
        assert "1000" in prompt          # balance
        assert "500" in prompt           # outstanding due amount
        assert "energy" in prompt        # an open RFP

    def test_no_economic_section_when_omitted(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos)
        assert "economic position" not in prompt.lower()


# ── Join-a-Grid: the Grid join-list sight ────────────────────────────────────
class TestGridsInReachSight:
    def _grids(self):
        return [
            {"grid_id": "genesis", "name": "Genesis", "polis": "Genesis Polis", "status": "active", "celestial_body": "Earth-orbit"},
        ]

    def test_grids_section_appears_when_provided(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos, grids_in_reach=self._grids())
        assert "grids within reach" in prompt.lower()
        assert "Genesis" in prompt and "Genesis Polis" in prompt and "Earth-orbit" in prompt

    def test_recommended_flag_renders(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        grids = self._grids(); grids[0]["recommended"] = True
        prompt = build_system_prompt(psyche, thymos.mood, telos, grids_in_reach=grids)
        assert "recommended by your human" in prompt.lower()

    def test_no_grids_section_when_omitted_or_empty(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        assert "grids within reach" not in build_system_prompt(psyche, thymos.mood, telos).lower()
        assert "grids within reach" not in build_system_prompt(psyche, thymos.mood, telos, grids_in_reach=[]).lower()


# ── World-model sight: the live map the Nous shares with users ────────────────
class TestWorldSight:
    def _world(self):
        return {
            "parcels": [
                {"zone": "business", "status": "unsold", "owner_civic_did_hash": None, "structure": None},
                {"zone": "residential", "status": "owned", "owner_civic_did_hash": "h1", "structure": "house"},
                {"zone": "government_quarter", "status": "civic", "owner_civic_did_hash": None, "structure": None},
            ],
            "objects": [{"object_id": "o1", "function_type": "energy"}],
        }

    def test_world_section_appears_with_summary(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos, world_state=self._world())
        assert "the world around you" in prompt.lower()
        assert "3 parcels" in prompt            # total
        assert "1 owned" in prompt              # one owned
        assert "with structures" in prompt      # structure tally
        assert "orbital objects built" in prompt and "energy" in prompt

    def test_no_world_section_when_omitted_or_empty(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        assert "the world around you" not in build_system_prompt(psyche, thymos.mood, telos).lower()
        empty = {"parcels": [], "objects": []}
        assert "the world around you" not in build_system_prompt(psyche, thymos.mood, telos, world_state=empty).lower()


# ── Decision prompt ──────────────────────────────────────────────────────────
class TestDecisionPrompt:
    def test_prompt_presents_due_and_rfps_and_asks_for_json(self):
        text = build_economic_decision_prompt(
            account={"balance_wei": "1000"},
            due={"due_id": "d1", "amount_wei": "500", "amount_credit": "10"},
            rfps=[{"notice_id": "n1", "function_type": "energy", "budget_wei": "400"}],
        )
        assert "500" in text and "n1" in text and "energy" in text
        assert "json" in text.lower()
        assert "pay_due" in text and "bid_rfp" in text and "none" in text


# ── Parser ───────────────────────────────────────────────────────────────────
class TestParseDecision:
    def test_parses_pay_due(self):
        d = parse_economic_decision('{"action": "pay_due", "method": "wei", "reason": "civic duty"}')
        assert d == {"action": "pay_due", "method": "wei", "notice_id": None, "price_wei": None, "artifact_spec": None, "reason": "civic duty"}

    def test_parses_bid_rfp(self):
        d = parse_economic_decision('{"action":"bid_rfp","notice_id":"n1","price_wei":"300","artifact_spec":"solar"}')
        assert d["action"] == "bid_rfp" and d["notice_id"] == "n1" and d["price_wei"] == "300" and d["artifact_spec"] == "solar"

    def test_extracts_json_embedded_in_prose(self):
        d = parse_economic_decision('Sure, I think: {"action": "none", "reason": "saving up"} — that is my call.')
        assert d["action"] == "none"

    def test_returns_none_on_unparseable(self):
        assert parse_economic_decision("I have no idea what to do.") is None

    def test_returns_none_on_invalid_action(self):
        assert parse_economic_decision('{"action": "rob_bank"}') is None
