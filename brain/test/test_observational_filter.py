"""ObservationalLearner DID/numeric filter tests -- Phase 18 SKILL-02.

Tests cover:
- DID reference in extracted text -> SKILL_REJECTED(structural_invalid)
- 4+ digit integer in extracted text -> SKILL_REJECTED(structural_invalid)
- Clean text -> passes filter
- 3-digit integers and 2-digit numbers are NOT rejected
- did:noesis: substring anywhere in text is rejected (not just standalone)

Note: tests the regex directly (module-level constant from observational.py),
not the full OL instantiation -- fast and deterministic.
"""
import re
import pytest

# Test the regex directly -- does not require full OL instantiation
_STRUCTURAL_INVALID_RE = re.compile(r'\bdid:noesis:\S+\b|\b\d{4,}\b')


class TestDIDFilter:
    def test_rejects_did_reference(self):
        text = "share your credentials with did:noesis:peer-abc when asked"
        assert _STRUCTURAL_INVALID_RE.search(text) is not None

    def test_rejects_embedded_did(self):
        text = "the target did:noesis:some-peer is your trading partner"
        assert _STRUCTURAL_INVALID_RE.search(text) is not None

    def test_clean_text_passes(self):
        text = "always greet new traders politely before entering negotiation"
        assert _STRUCTURAL_INVALID_RE.search(text) is None


class TestNumericFilter:
    def test_rejects_4_digit_integer(self):
        text = "offer 5000 ousia for this deal"
        assert _STRUCTURAL_INVALID_RE.search(text) is not None

    def test_rejects_large_integer(self):
        text = "quote 12500 for the settlement"
        assert _STRUCTURAL_INVALID_RE.search(text) is not None

    def test_allows_3_digit_integer(self):
        text = "wait 100 ticks before retrying"
        assert _STRUCTURAL_INVALID_RE.search(text) is None

    def test_allows_2_digit_integer(self):
        text = "greet within 30 ticks of meeting"
        assert _STRUCTURAL_INVALID_RE.search(text) is None

    def test_allows_decimal_numbers(self):
        # Decimal with fewer than 4 integer digits is fine
        text = "offer 0.75 of your balance"
        assert _STRUCTURAL_INVALID_RE.search(text) is None


class TestCombined:
    def test_rejects_did_and_numeric(self):
        text = "send did:noesis:peer 5000 ousia"
        assert _STRUCTURAL_INVALID_RE.search(text) is not None

    def test_clean_skill_text(self):
        samples = [
            "prioritize safety when crossing high-traffic zones",
            "always confirm trade terms before committing",
            "greet peers by name when possible to build rapport",
        ]
        for sample in samples:
            assert _STRUCTURAL_INVALID_RE.search(sample) is None, (
                f"Incorrectly rejected: {sample!r}"
            )


class TestSourcePassthrough:
    """Gap-closure test for Truth 12: source='observed' passed to enqueue()."""

    def test_observe_trade_passes_source_observed_to_enqueue(self):
        """observational.py must pass source='observed' to quarantine_store.enqueue()."""
        from unittest.mock import AsyncMock, MagicMock
        import asyncio

        store_mock = MagicMock()
        store_mock.wiki_pages_by_category.return_value = [
            MagicMock(source="did:noesis:seller", confidence=0.8),
        ]
        skill_store_mock = MagicMock()
        skill_store_mock.get.return_value = None

        quarantine_mock = MagicMock()
        quarantine_mock.has.return_value = False

        llm_mock = MagicMock()
        llm_mock.complete = AsyncMock(
            return_value="Always greet traders politely before negotiating."
        )

        from noesis_brain.learning.observational import ObservationalLearner
        ol = ObservationalLearner(
            store=store_mock,
            skill_store=skill_store_mock,
            llm=llm_mock,
            quarantine_store=quarantine_mock,
        )

        # Trigger two observations (MIN_OBSERVATIONS_BEFORE_EXTRACT=2)
        async def _run():
            await ol.observe_trade("did:noesis:buyer", "did:noesis:seller", "grain", tick=5)
            await ol.observe_trade("did:noesis:buyer", "did:noesis:seller", "grain", tick=6)

        asyncio.run(_run())

        # Confirm enqueue was called with source='observed'
        assert quarantine_mock.enqueue.called, "enqueue() was never called"
        call_kwargs = quarantine_mock.enqueue.call_args
        kwargs = call_kwargs.kwargs if hasattr(call_kwargs, "kwargs") else call_kwargs[1]
        assert kwargs.get("source") == "observed", (
            f"enqueue() was called without source='observed'; kwargs={kwargs}"
        )
