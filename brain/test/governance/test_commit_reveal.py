"""brain/test/governance/test_commit_reveal.py

Phase 12 Wave 1 — generate_nonce + verify_reveal tests (D-12-02 / D-12-07 / T-09-14).

Covers:
  - generate_nonce shape (32 hex chars, lowercase)
  - generate_nonce entropy smoke test (two successive calls differ)
  - verify_reveal accept/reject matrix matching Grid behavior
  - compute_commit_hash ValueError on invalid inputs
"""
import re
import pytest
from noesis_brain.governance.commit_reveal import (
    compute_commit_hash,
    verify_reveal,
    generate_nonce,
)


# ── generate_nonce ────────────────────────────────────────────────────────────

def test_generate_nonce_shape():
    """generate_nonce returns a 32-char lowercase hex string (16 bytes)."""
    nonce = generate_nonce()
    assert len(nonce) == 32
    assert re.fullmatch(r"[0-9a-f]{32}", nonce) is not None, f"nonce not lowercase hex: {nonce!r}"


def test_generate_nonce_entropy_smoke():
    """Two successive calls must differ — secrets.token_hex must not be a constant."""
    a = generate_nonce()
    b = generate_nonce()
    assert a != b, "Two successive generate_nonce() calls returned the same value — not cryptographically random"


def test_generate_nonce_returns_string():
    nonce = generate_nonce()
    assert isinstance(nonce, str)


# ── verify_reveal accept/reject matrix ───────────────────────────────────────

def test_verify_reveal_accepts_correct():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("yes", "0" * 32, "did:noesis:alice", expected) is True


def test_verify_reveal_rejects_wrong_choice():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("no", "0" * 32, "did:noesis:alice", expected) is False


def test_verify_reveal_rejects_wrong_voter_did():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("yes", "0" * 32, "did:noesis:bob", expected) is False


def test_verify_reveal_rejects_tampered_nonce():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    tampered = "0" * 31 + "1"
    assert verify_reveal("yes", tampered, "did:noesis:alice", expected) is False


def test_verify_reveal_rejects_malformed_nonce_too_short():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("yes", "0" * 31, "did:noesis:alice", expected) is False


def test_verify_reveal_rejects_malformed_nonce_non_hex():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("yes", "g" * 32, "did:noesis:alice", expected) is False


def test_verify_reveal_rejects_malformed_voter_did():
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    assert verify_reveal("yes", "0" * 32, "alice", expected) is False


def test_verify_reveal_rejects_invalid_choice_swallows_valueerror():
    """verify_reveal MUST return False (not raise) on invalid choice."""
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    result = verify_reveal("maybe", "0" * 32, "did:noesis:alice", expected)  # type: ignore[arg-type]
    assert result is False


def test_verify_reveal_accepts_uppercase_nonce():
    """Uppercase nonce is normalized to lowercase before hashing — must accept."""
    expected = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    upper_nonce = ("0" * 32).upper()  # all zeros uppercase
    assert verify_reveal("yes", upper_nonce, "did:noesis:alice", expected) is True


# ── compute_commit_hash ValueError cases ─────────────────────────────────────

def test_compute_commit_hash_raises_on_invalid_choice():
    with pytest.raises(ValueError, match="invalid choice"):
        compute_commit_hash("maybe", "0" * 32, "did:noesis:alice")  # type: ignore[arg-type]


def test_compute_commit_hash_raises_on_short_nonce():
    with pytest.raises(ValueError, match="nonce must be"):
        compute_commit_hash("yes", "0" * 31, "did:noesis:alice")


def test_compute_commit_hash_raises_on_malformed_voter_did():
    with pytest.raises(ValueError, match="voter_did fails DID_RE"):
        compute_commit_hash("yes", "0" * 32, "alice")
