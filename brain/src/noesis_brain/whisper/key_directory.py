"""brain/src/noesis_brain/whisper/key_directory.py

Phase 11 Wave 1 — observer pattern for DID → public key cache.

KeyDirectory is a passive in-memory store updated by bios.birth / bios.death
audit stream observation. It holds ONLY public key bytes — never private keys.

Wave 1 ships the class itself. Wave 3 wires it into BiosRuntime as a subscriber.

SECURITY:
    - Never writes to disk (no filesystem calls).
    - Only public key bytes stored — private keys remain in Keyring exclusively.
    - bios.death prunes the entry, consistent with D-11-04 (keyring Brain-only).
"""
from dataclasses import dataclass, field

__all__ = ["KeyDirectory"]


@dataclass
class KeyDirectory:
    """In-memory directory mapping DID → X25519 public key bytes.

    Populated by on_bios_birth() callbacks when a Nous is born.
    Pruned by on_bios_death() callbacks when a Nous dies (tombstone gate).
    """

    _pubkeys: dict[str, bytes] = field(default_factory=dict)

    def on_bios_birth(self, did: str, pub_bytes: bytes) -> None:
        """Register a DID's public key upon bios.birth.

        Args:
            did: The Nous DID string.
            pub_bytes: 32-byte X25519 public key.
        """
        self._pubkeys[did] = pub_bytes

    def on_bios_death(self, did: str) -> None:
        """Remove a DID's public key upon bios.death (tombstone).

        Subsequent pub_for() calls return None — caller must handle gracefully.

        Args:
            did: The Nous DID string to prune.
        """
        self._pubkeys.pop(did, None)

    def pub_for(self, did: str) -> bytes | None:
        """Return the registered public key for a DID, or None if unknown.

        Args:
            did: The Nous DID string to look up.

        Returns:
            32-byte public key, or None if DID not registered (born or evicted).
        """
        return self._pubkeys.get(did)
