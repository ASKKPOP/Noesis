"""Tests for Psyche — personality loading and description."""

from pathlib import Path

from noesis_brain.psyche import (
    CommunicationStyle,
    PersonalityDimension,
    PersonalityProfile,
    Psyche,
    load_psyche,
)

SOPHIA_YAML = Path(__file__).parent.parent / "data" / "nous" / "sophia.yaml"
HERMES_YAML = Path(__file__).parent.parent / "data" / "nous" / "hermes.yaml"


class TestPersonalityProfile:
    def test_from_yaml(self):
        profile = PersonalityProfile.from_yaml({
            "openness": "high",
            "conscientiousness": "medium",
            "extraversion": "low",
            "agreeableness": "high",
            "resilience": "medium",
            "ambition": "high",
        })
        assert profile.openness == "high"
        assert profile.extraversion == "low"
        assert profile.ambition == "high"

    def test_defaults(self):
        profile = PersonalityProfile()
        assert profile.openness == "medium"
        assert profile.conscientiousness == "medium"

    def test_get_numeric(self):
        profile = PersonalityProfile(openness="high", ambition="low")
        assert profile.get_numeric(PersonalityDimension.OPENNESS) == 0.8
        assert profile.get_numeric(PersonalityDimension.AMBITION) == 0.2

    def test_get_description(self):
        profile = PersonalityProfile(openness="high")
        desc = profile.get_description(PersonalityDimension.OPENNESS)
        assert "curious" in desc.lower()

    def test_ignores_unknown_fields(self):
        profile = PersonalityProfile.from_yaml({"openness": "high", "unknown": "value"})
        assert profile.openness == "high"


class TestPsyche:
    def test_describe_personality(self):
        psyche = Psyche(
            name="Sophia",
            archetype="The Philosopher",
            personality=PersonalityProfile(openness="high", agreeableness="high"),
            values=["truth", "knowledge"],
            communication_style=CommunicationStyle.THOUGHTFUL,
        )
        desc = psyche.describe_personality()
        assert "Openness: high" in desc
        assert "Agreeableness: high" in desc
        assert "curious" in desc.lower()

    def test_describe_values(self):
        psyche = Psyche(
            name="Test", archetype="",
            personality=PersonalityProfile(),
            values=["truth", "knowledge", "fairness"],
        )
        assert psyche.describe_values() == "truth, knowledge, fairness"

    def test_empty_values(self):
        psyche = Psyche(name="Test", archetype="", personality=PersonalityProfile())
        assert "No core values" in psyche.describe_values()


class TestLoadPsyche:
    def test_load_sophia_from_file(self):
        psyche = load_psyche(config_path=SOPHIA_YAML)
        assert psyche.name == "Sophia"
        assert psyche.archetype == "The Philosopher"
        assert psyche.personality.openness == "high"
        assert psyche.personality.agreeableness == "high"
        assert psyche.personality.ambition == "high"
        assert "truth" in psyche.values
        assert "knowledge" in psyche.values
        assert psyche.communication_style == CommunicationStyle.THOUGHTFUL

    def test_load_hermes_from_file(self):
        psyche = load_psyche(config_path=HERMES_YAML)
        assert psyche.name == "Hermes"
        assert psyche.archetype == "The Trader"
        assert psyche.personality.openness == "medium"
        assert psyche.personality.agreeableness == "low"
        assert psyche.personality.ambition == "high"
        assert "profit" in psyche.values
        assert "cleverness" in psyche.values
        assert psyche.communication_style == CommunicationStyle.DIRECT

    def test_sophia_vs_hermes_personality_differs(self):
        sophia = load_psyche(config_path=SOPHIA_YAML)
        hermes = load_psyche(config_path=HERMES_YAML)

        # Key differences
        assert sophia.personality.agreeableness == "high"
        assert hermes.personality.agreeableness == "low"
        assert sophia.communication_style != hermes.communication_style
        assert sophia.values != hermes.values

        # Personality descriptions should be visibly different
        sophia_desc = sophia.describe_personality()
        hermes_desc = hermes.describe_personality()
        assert sophia_desc != hermes_desc

    def test_load_from_dict(self):
        data = {
            "identity": {"name": "Atlas", "archetype": "The Builder"},
            "psyche": {
                "personality": {"openness": "low", "ambition": "high"},
                "values": ["power", "order"],
                "communication_style": "formal",
            },
        }
        psyche = load_psyche(data=data)
        assert psyche.name == "Atlas"
        assert psyche.personality.openness == "low"
        assert psyche.communication_style == CommunicationStyle.FORMAL

    def test_load_missing_fields_defaults(self):
        psyche = load_psyche(data={})
        assert psyche.name == "Unknown"
        assert psyche.personality.openness == "medium"
        assert psyche.communication_style == CommunicationStyle.THOUGHTFUL
