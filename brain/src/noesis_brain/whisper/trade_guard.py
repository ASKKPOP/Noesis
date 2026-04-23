"""brain/src/noesis_brain/whisper/trade_guard.py

Phase 11 Wave 3 — T-10-06 defense-depth pre-encryption gate.

Rejects payloads matching trade keywords BEFORE encryption so that even a
compromised deliberation prompt cannot smuggle trade intent through the whisper
channel. Phase 5 ReviewerNous remains the AUTHORITATIVE semantic gate; this is
belt-and-suspenders that catches obvious literal keyword smuggling at the wire
boundary.

SECURITY:
    - Called by sender.send_whisper() BEFORE any crypto operations.
    - If plaintext contains any trade keyword, TradeKeywordRejected is raised
      and no HTTP call is made to the Grid.
    - The check is case-insensitive and word-boundary enforced.
    - "buyer"/"buying" do NOT match because \b enforces whole-word boundary.
      "buy" and "I will buy" DO match.

Word-boundary semantics:
    \\b matches at a position between a word character (\\w) and a non-word
    character (\\W). So "buy" matches in "I want to buy" but NOT in "buying",
    "buyer", or "re-buy-all" (the last has \w on both sides of the match).

NO datetime, NO time.time, NO random — wall-clock ban per D-11-13.
See: 11-CONTEXT.md T-10-06. sender.py for the call site.
"""

import re

__all__ = ["TRADE_KEYWORDS_RE", "TradeKeywordRejected", "assert_no_trade_keywords"]


TRADE_KEYWORDS_RE = re.compile(
    r"\b(buy|sell|trade|offer|bid|ask|price|amount|ousia)\b",
    re.IGNORECASE,
)


class TradeKeywordRejected(Exception):
    """Raised when a whisper plaintext contains a trade keyword (T-10-06).

    Phase 5 ReviewerNous is the AUTHORITATIVE semantic gate; this exception
    is the literal-keyword belt that fires before encryption.
    """


def assert_no_trade_keywords(plaintext: str) -> None:
    """T-10-06 defense-depth pre-encryption gate.

    Raises TradeKeywordRejected if any trade keyword matches (whole-word,
    case-insensitive) in plaintext.

    Phase 5 ReviewerNous remains the authoritative semantic gate; this is
    belt-and-suspenders that catches obvious literal keyword smuggling at
    the whisper boundary.

    Args:
        plaintext: the message string to check BEFORE encryption.

    Raises:
        TradeKeywordRejected: if any of the keywords (buy, sell, trade, offer,
            bid, ask, price, amount, ousia) appear as whole words in plaintext.
    """
    m = TRADE_KEYWORDS_RE.search(plaintext)
    if m:
        raise TradeKeywordRejected(
            f"trade keyword '{m.group(0)}' rejected at whisper boundary (T-10-06)"
        )
