"""brain/test/whisper/test_roundtrip.py

Phase 11 Wave 1 — JS↔Python byte-compatibility fixture roundtrip.

This test is the definitive proof of RESEARCH §2.2 A2 assumption:
    nacl.bindings.crypto_box_seed_keypair(sha256(did)) produces byte-identical
    keypairs to libsodium-wrappers crypto_box_seed_keypair(sha256(did)).

Two directions tested:
    1. JS-encrypted → Python-decrypted: loads js-encrypted-envelope.json,
       reconstructs recipient keypair, decrypts, asserts plaintext.
    2. Python-encrypted → Python-decrypted: generates py-encrypted-envelope.json
       inline, asserts roundtrip in Python.
       (JS decryption of the py fixture is tested in whisper-keyring.test.ts)

Fixture files:
    brain/test/fixtures/whisper/js-encrypted-envelope.json — produced by
        node grid/scripts/gen-whisper-jsfixture.mjs (committed; regenerate if needed)
    brain/test/fixtures/whisper/py-encrypted-envelope.json — produced by
        this test on first run (committed after initial run)
"""
import base64
import hashlib
import json
import pathlib
import pytest
from noesis_brain.whisper.keyring import Keyring
from noesis_brain.whisper.nonce import derive_nonce

# ── Fixture paths ─────────────────────────────────────────────────────────────

FIXTURES_DIR = pathlib.Path(__file__).parent.parent / "fixtures" / "whisper"
JS_FIXTURE = FIXTURES_DIR / "js-encrypted-envelope.json"
PY_FIXTURE = FIXTURES_DIR / "py-encrypted-envelope.json"

# ── Test DIDs (synthetic — NOT real Nous identities) ──────────────────────────

ALICE_DID = "did:noesis:alice_test"
BOB_DID = "did:noesis:bob_test"


class TestJSEncryptedPythonDecrypts:
    """Direction 1: JS encrypted → Python decrypts (A2 proof)."""

    def test_js_fixture_exists(self) -> None:
        assert JS_FIXTURE.exists(), (
            f"JS fixture not found: {JS_FIXTURE}. "
            "Run: node grid/scripts/gen-whisper-jsfixture.mjs"
        )

    def test_python_decrypts_js_encrypted_envelope(self) -> None:
        """CRITICAL A2 proof: Python keypair from nacl.bindings matches JS libsodium keypair."""
        env = json.loads(JS_FIXTURE.read_text())

        sender_did = env["sender_did"]
        recipient_did = env["recipient_did"]
        nonce = base64.b64decode(env["nonce_b64"])
        ciphertext = base64.b64decode(env["ciphertext_b64"])
        expected_plaintext = base64.b64decode(env["plaintext_b64"])

        kr = Keyring()

        # Sender pub provided by the fixture (derived by JS)
        sender_pub = base64.b64decode(env["sender_pub_b64"])

        # Recipient private key derived by Python from the same DID
        decrypted = kr.decrypt_from(recipient_did, sender_pub, ciphertext, nonce)

        assert decrypted == expected_plaintext, (
            f"Decrypted bytes {decrypted!r} != expected {expected_plaintext!r}. "
            "A2 assumption violated — keypair mismatch between JS and Python."
        )

    def test_python_pub_matches_js_sender_pub(self) -> None:
        """Python-derived alice pub must equal the pub JS embedded in the fixture."""
        env = json.loads(JS_FIXTURE.read_text())
        js_sender_pub = base64.b64decode(env["sender_pub_b64"])

        kr = Keyring()
        python_pub = kr.pub_for(env["sender_did"])

        assert python_pub == js_sender_pub, (
            f"Python pub {python_pub.hex()} != JS pub {js_sender_pub.hex()}. "
            "Check: nacl.bindings.crypto_box_seed_keypair used (NOT PrivateKey)."
        )

    def test_python_pub_matches_js_recipient_pub(self) -> None:
        """Python-derived bob pub must equal the pub JS embedded in the fixture."""
        env = json.loads(JS_FIXTURE.read_text())
        js_recipient_pub = base64.b64decode(env["recipient_pub_b64"])

        kr = Keyring()
        python_pub = kr.pub_for(env["recipient_did"])

        assert python_pub == js_recipient_pub, (
            f"Python pub {python_pub.hex()} != JS pub {js_recipient_pub.hex()}."
        )

    def test_nonce_matches_derive_nonce_output(self) -> None:
        """Nonce in fixture must match Python derive_nonce for same inputs."""
        env = json.loads(JS_FIXTURE.read_text())
        fixture_nonce = base64.b64decode(env["nonce_b64"])

        kr = Keyring()
        sender_seed = kr.seed_for(env["sender_did"])
        computed_nonce = derive_nonce(sender_seed, tick=env["tick"], counter=env["counter"])

        assert computed_nonce == fixture_nonce, (
            f"Computed nonce {computed_nonce.hex()} != fixture nonce {fixture_nonce.hex()}. "
            "Nonce derivation formula mismatch between JS and Python."
        )

    def test_ciphertext_hash_matches(self) -> None:
        """SHA256(ciphertext) must match the hash field in the fixture."""
        env = json.loads(JS_FIXTURE.read_text())
        ciphertext = base64.b64decode(env["ciphertext_b64"])
        computed_hash = hashlib.sha256(ciphertext).hexdigest()
        assert computed_hash == env["ciphertext_hash"]


class TestPythonEncryptedFixture:
    """Direction 2: Python encrypted → Python decrypted + fixture generation for JS test."""

    def _generate_py_fixture(self) -> dict:
        """Generate the py-encrypted-envelope.json fixture data."""
        kr = Keyring()
        # Use tick=43 counter=0 to distinguish from the JS fixture (tick=42)
        sender_seed = kr.seed_for(ALICE_DID)
        nonce = derive_nonce(sender_seed, tick=43, counter=0)
        plaintext = b"hello from Python"

        ciphertext = kr.encrypt_for(ALICE_DID, kr.pub_for(BOB_DID), plaintext, nonce)
        ciphertext_hash = hashlib.sha256(ciphertext).hexdigest()

        return {
            "_generated": {
                "note": "GENERATED — DO NOT EDIT; regenerate via: pytest brain/test/whisper/test_roundtrip.py",
                "generator": "brain/test/whisper/test_roundtrip.py",
                "phase": "11-mesh-whisper",
                "wave": 1,
                "purpose": "Python->JS byte-compat roundtrip fixture (RESEARCH §2.2 A2 proof)",
            },
            "sender_did": ALICE_DID,
            "recipient_did": BOB_DID,
            "tick": 43,
            "counter": 0,
            "plaintext_b64": base64.b64encode(plaintext).decode(),
            "nonce_b64": base64.b64encode(nonce).decode(),
            "ciphertext_b64": base64.b64encode(ciphertext).decode(),
            "ciphertext_hash": ciphertext_hash,
            "sender_pub_b64": base64.b64encode(kr.pub_for(ALICE_DID)).decode(),
            "recipient_pub_b64": base64.b64encode(kr.pub_for(BOB_DID)).decode(),
        }

    def test_py_fixture_generated_on_disk(self) -> None:
        """Ensure py fixture exists; generate if absent."""
        if not PY_FIXTURE.exists():
            FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
            data = self._generate_py_fixture()
            PY_FIXTURE.write_text(json.dumps(data, indent=2) + "\n")
        assert PY_FIXTURE.exists()

    def test_python_decrypts_python_encrypted(self) -> None:
        """Python can decrypt its own fixture (basic sanity check)."""
        if not PY_FIXTURE.exists():
            FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
            data = self._generate_py_fixture()
            PY_FIXTURE.write_text(json.dumps(data, indent=2) + "\n")

        env = json.loads(PY_FIXTURE.read_text())
        nonce = base64.b64decode(env["nonce_b64"])
        ciphertext = base64.b64decode(env["ciphertext_b64"])
        expected_plaintext = base64.b64decode(env["plaintext_b64"])
        sender_pub = base64.b64decode(env["sender_pub_b64"])

        kr = Keyring()
        decrypted = kr.decrypt_from(env["recipient_did"], sender_pub, ciphertext, nonce)
        assert decrypted == expected_plaintext

    def test_py_fixture_ciphertext_hash_matches(self) -> None:
        """SHA256(ciphertext) in py fixture matches computed value."""
        if not PY_FIXTURE.exists():
            FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
            data = self._generate_py_fixture()
            PY_FIXTURE.write_text(json.dumps(data, indent=2) + "\n")

        env = json.loads(PY_FIXTURE.read_text())
        ciphertext = base64.b64decode(env["ciphertext_b64"])
        computed = hashlib.sha256(ciphertext).hexdigest()
        assert computed == env["ciphertext_hash"]

    def test_py_fixture_is_deterministic(self) -> None:
        """Regenerating the fixture produces byte-identical output."""
        data1 = self._generate_py_fixture()
        data2 = self._generate_py_fixture()
        assert data1["ciphertext_b64"] == data2["ciphertext_b64"]
        assert data1["nonce_b64"] == data2["nonce_b64"]
        assert data1["ciphertext_hash"] == data2["ciphertext_hash"]
