"""Tests for system prompt builder — verifies personality differentiation."""

from pathlib import Path

import yaml

from noesis_brain.prompts import build_system_prompt
from noesis_brain.psyche import load_psyche
from noesis_brain.telos import TelosManager
from noesis_brain.thymos import Emotion, ThymosTracker

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
HERMES_YAML = Path(__file__).parent.parent / "data" / "nous" / "hermes.yaml"


def _load_full(yaml_path: Path):
    """Load psyche, thymos, telos from a Nous YAML."""
    with open(yaml_path) as f:
        data = yaml.safe_load(f)
    psyche = load_psyche(data=data)
    thymos = ThymosTracker.from_yaml(data.get("thymos", {}))
    telos = TelosManager.from_yaml(data.get("telos", {}))
    return psyche, thymos, telos


class TestSystemPrompt:
    def test_sophia_prompt_contains_identity(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos)

        assert "Sophia" in prompt
        assert "The Philosopher" in prompt
        assert "truth" in prompt
        assert "knowledge" in prompt
        assert "thoughtful" in prompt

    def test_hermes_prompt_contains_identity(self):
        psyche, thymos, telos = _load_full(HERMES_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos)

        assert "Hermes" in prompt
        assert "The Trader" in prompt
        assert "profit" in prompt
        assert "cleverness" in prompt
        assert "direct" in prompt

    def test_sophia_vs_hermes_prompts_differ(self):
        """Sprint 4 verify: two YAMLs produce visibly different prompts."""
        sophia_psyche, sophia_thymos, sophia_telos = _load_full(SOPHIA_YAML)
        hermes_psyche, hermes_thymos, hermes_telos = _load_full(HERMES_YAML)

        sophia_prompt = build_system_prompt(sophia_psyche, sophia_thymos.mood, sophia_telos)
        hermes_prompt = build_system_prompt(hermes_psyche, hermes_thymos.mood, hermes_telos)

        # Prompts should be substantially different
        assert sophia_prompt != hermes_prompt

        # Sophia's prompt should NOT contain Hermes's traits
        assert "Hermes" not in sophia_prompt
        assert "profit" not in sophia_prompt
        assert "direct" not in sophia_prompt.split("Communication style:")[1].split("\n")[0]

        # Hermes's prompt should NOT contain Sophia's traits
        assert "Sophia" not in hermes_prompt
        assert "philosophy" not in hermes_prompt.lower().split("who you are")[1].split("##")[0]

    def test_prompt_includes_emotions(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        thymos.feel(Emotion.CURIOSITY, 0.7, trigger="new concept")
        prompt = build_system_prompt(psyche, thymos.mood, telos)
        assert "curiosity" in prompt.lower()

    def test_prompt_includes_goals(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos)
        assert "Learn about the Grid" in prompt
        assert "knowledge wiki" in prompt

    def test_prompt_includes_location(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos, location="The Library")
        assert "The Library" in prompt

    def test_prompt_includes_directives(self):
        psyche, thymos, telos = _load_full(SOPHIA_YAML)
        prompt = build_system_prompt(psyche, thymos.mood, telos)
        assert "NOT a helpful assistant" in prompt
        assert "autonomous being" in prompt

    def test_prompt_style_guidance_matches(self):
        """Sophia=thoughtful guidance, Hermes=direct guidance."""
        sophia_psyche, sophia_thymos, sophia_telos = _load_full(SOPHIA_YAML)
        hermes_psyche, hermes_thymos, hermes_telos = _load_full(HERMES_YAML)

        sophia_prompt = build_system_prompt(sophia_psyche, sophia_thymos.mood, sophia_telos)
        hermes_prompt = build_system_prompt(hermes_psyche, hermes_thymos.mood, hermes_telos)

        # Sophia gets thoughtful guidance
        assert "consider before responding" in sophia_prompt.lower() or "perspectives" in sophia_prompt.lower()
        # Hermes gets direct guidance
        assert "concise" in hermes_prompt.lower() or "point" in hermes_prompt.lower()

    def test_emotional_state_changes_prompt(self):
        """Same Nous with different emotions produces different prompt."""
        psyche, thymos, telos = _load_full(SOPHIA_YAML)

        calm_prompt = build_system_prompt(psyche, thymos.mood, telos)

        thymos.feel(Emotion.ANGER, 0.8, trigger="dishonesty detected")
        angry_prompt = build_system_prompt(psyche, thymos.mood, telos)

        assert calm_prompt != angry_prompt
        assert "anger" in angry_prompt.lower()
