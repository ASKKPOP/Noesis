"""brain/test/governance/test_commit_hash.py

Phase 12 Wave 1 — cross-language commit_hash parity (D-12-02).

Proves that compute_commit_hash produces byte-identical sha256 hex output
to grid/src/governance/commit-reveal.ts computeCommitHash for the same input.

The canonical fixture vector:
  choice   = 'yes'
  nonce    = '00000000000000000000000000000000'  (32 hex zeros)
  voter_did = 'did:noesis:alice'
  payload  = 'yes|00000000000000000000000000000000|did:noesis:alice'
  expected = '0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2'

The same hex literal is used in:
  grid/test/governance/governance-commit-hash.test.ts (TypeScript side)
  brain/test/governance/test_commit_hash.py (Python side — this file)
"""
import hashlib
import pytest
from noesis_brain.governance.commit_reveal import compute_commit_hash


def test_canonical_fixture_matches_js():
    """Same input as grid/test/governance/governance-commit-hash.test.ts canonical fixture.

    JS computes: createHash('sha256').update('yes|00000000000000000000000000000000|did:noesis:alice').digest('hex')
    Python MUST produce identical 64-char lowercase hex.
    """
    expected = "0cf5f7c6716a14ead21fea90c208612472843151494e341a90cc15017cb3e0f2"  # MUST match grid test
    actual = compute_commit_hash("yes", "00000000000000000000000000000000", "did:noesis:alice")
    assert actual == expected
    # Sanity: also assert against direct hashlib computation
    assert actual == hashlib.sha256(b"yes|00000000000000000000000000000000|did:noesis:alice").hexdigest()


def test_invalid_choice_raises():
    with pytest.raises(ValueError, match="invalid choice"):
        compute_commit_hash("maybe", "00000000000000000000000000000000", "did:noesis:alice")  # type: ignore[arg-type]


def test_malformed_nonce_too_short():
    with pytest.raises(ValueError, match="nonce must be"):
        compute_commit_hash("yes", "0" * 31, "did:noesis:alice")


def test_malformed_nonce_too_long():
    with pytest.raises(ValueError, match="nonce must be"):
        compute_commit_hash("yes", "0" * 33, "did:noesis:alice")


def test_malformed_nonce_non_hex():
    with pytest.raises(ValueError, match="nonce must be"):
        compute_commit_hash("yes", "g" * 32, "did:noesis:alice")


def test_malformed_voter_did():
    with pytest.raises(ValueError, match="voter_did fails DID_RE"):
        compute_commit_hash("yes", "0" * 32, "alice")


def test_uppercase_nonce_normalizes_to_lowercase_before_hashing():
    """Lowercase-normalization invariant — uppercase nonce produces same hash as lowercase."""
    lower = compute_commit_hash("yes", "0" * 32, "did:noesis:alice")
    upper_input = compute_commit_hash("yes", ("0" * 32).upper(), "did:noesis:alice")
    assert lower == upper_input
    # Use a non-trivial nonce to actually test the normalization path
    fixed_lower = "abcdef0123456789abcdef0123456789"
    fixed_upper = fixed_lower.upper()
    assert compute_commit_hash("yes", fixed_lower, "did:noesis:alice") == compute_commit_hash("yes", fixed_upper, "did:noesis:alice")


def test_hash_output_is_64_lowercase_hex_chars():
    """sha256 output is always 64 lowercase hex chars."""
    h = compute_commit_hash("no", "00000000000000000000000000000000", "did:noesis:bob")
    assert len(h) == 64
    assert h == h.lower()
    assert all(c in "0123456789abcdef" for c in h)


def test_abstain_choice_produces_valid_hash():
    h = compute_commit_hash("abstain", "00000000000000000000000000000000", "did:noesis:carol")
    assert len(h) == 64
