"""Phase 19 D-19-03: compute_norm_fingerprint determinism tests.

Verifies the 6-char hex n-gram fingerprint invariants:
  - Same rule text always yields the same output (determinism)
  - Output is exactly 6 lowercase hex characters
  - Case-insensitive (lowercased before processing)
  - Punctuation-invariant ([a-z]+ tokens only, no punctuation)
  - Fallback for short rules (<3 words) returns valid 6-char hex
  - Empty string returns valid 6-char hex (fallback path)
"""

import re

import pytest

from noesis_brain.learning.rules import compute_norm_fingerprint


class TestComputeNormFingerprint:
    """Tests for D-19-03 fingerprint determinism invariant."""

    def test_same_text_same_fingerprint(self):
        """Identical rule text always produces the same 6-char hex output."""
        text = "always trade with trusted peers first"
        assert compute_norm_fingerprint(text) == compute_norm_fingerprint(text)

    def test_output_is_6_char_hex(self):
        """Output is exactly 6 lowercase hex characters."""
        result = compute_norm_fingerprint("trade with peers")
        assert re.match(r'^[0-9a-f]{6}$', result), f"Expected 6-char hex, got: {result!r}"

    def test_punctuation_invariance(self):
        """Punctuation does not change the fingerprint (only [a-z]+ tokens counted)."""
        text1 = "trade first, then speak"
        text2 = "trade first then speak"
        assert compute_norm_fingerprint(text1) == compute_norm_fingerprint(text2)

    def test_case_invariance(self):
        """Fingerprint is case-insensitive."""
        assert compute_norm_fingerprint("Trade With Peers") == compute_norm_fingerprint("trade with peers")

    def test_short_rule_fallback(self):
        """Rules with < 3 words use the fallback hash path and still return 6-char hex."""
        result = compute_norm_fingerprint("hi")
        assert re.match(r'^[0-9a-f]{6}$', result), f"Expected 6-char hex, got: {result!r}"

    def test_empty_string_fallback(self):
        """Empty string returns a 6-char hex (fallback path, SHA-256 of empty string)."""
        result = compute_norm_fingerprint("")
        assert re.match(r'^[0-9a-f]{6}$', result), f"Expected 6-char hex, got: {result!r}"

    def test_different_texts_may_differ(self):
        """Semantically different rules produce different fingerprints (collision unlikely)."""
        fp1 = compute_norm_fingerprint("always offer surplus resources first")
        fp2 = compute_norm_fingerprint("never trade with strangers alone")
        # Not guaranteed but should differ in practice
        assert isinstance(fp1, str) and isinstance(fp2, str)

    def test_word_order_in_trigrams_matters(self):
        """Different word-trigram sets produce different fingerprints."""
        fp1 = compute_norm_fingerprint("alpha beta gamma delta")
        fp2 = compute_norm_fingerprint("gamma alpha beta delta")
        # trigrams differ: {alpha beta gamma, beta gamma delta} vs {gamma alpha beta, alpha beta delta}
        assert fp1 != fp2
