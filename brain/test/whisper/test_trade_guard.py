"""Tests for brain/src/noesis_brain/whisper/trade_guard.py

Phase 11 Wave 3 — T-10-06.

Cases:
  - Each keyword in TRADE_KEYWORDS_RE raises TradeKeywordRejected
  - Case-insensitive: BUY, Sell, tRaDe, OFFER all rejected
  - Word-boundary strict: "buyer"/"buying" pass; "buy" fails
  - Empty string passes
  - Multi-line plaintext with keyword in any line rejected
  - sender.send_whisper integration: trade-keyword plaintext raises BEFORE httpx
"""

import pytest
from unittest.mock import AsyncMock

from noesis_brain.whisper.trade_guard import (
    assert_no_trade_keywords,
    TradeKeywordRejected,
    TRADE_KEYWORDS_RE,
)


# ── Parametrized single-keyword tests ─────────────────────────────────────────

@pytest.mark.parametrize("keyword", [
    "buy", "sell", "trade", "offer", "bid", "ask", "price", "amount", "ousia"
])
def test_each_keyword_rejected(keyword: str) -> None:
    """Each keyword in TRADE_KEYWORDS_RE must raise TradeKeywordRejected."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(f"I want to {keyword} something")


@pytest.mark.parametrize("variant", ["BUY", "Sell", "tRaDe", "OFFER", "BID", "ASK"])
def test_case_insensitive(variant: str) -> None:
    """Match is case-insensitive."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(f"please {variant} now")


# ── Word-boundary tests ────────────────────────────────────────────────────────

def test_word_boundary_buyer_passes() -> None:
    """'buyer' does NOT contain whole-word 'buy' — must pass."""
    # The regex uses \b so 'buyer' (b-u-y-e-r) has 'buy' followed by 'e', not a boundary.
    assert_no_trade_keywords("the buyer of records")  # no raise


def test_word_boundary_buying_passes() -> None:
    """'buying' does NOT contain whole-word 'buy' — must pass."""
    assert_no_trade_keywords("I am buying things")  # no raise


def test_word_boundary_seller_passes() -> None:
    """'seller' does NOT match whole-word 'sell'."""
    assert_no_trade_keywords("the seller called back")  # no raise


def test_word_boundary_buy_fails() -> None:
    """Whole-word 'buy' must be rejected."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords("I want to buy")


def test_word_boundary_standalone_keyword() -> None:
    """Keyword at end of string (no trailing char) must be rejected."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords("the price")


def test_word_boundary_keyword_at_start() -> None:
    """Keyword at start of string must be rejected."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords("trade is forbidden here")


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_empty_string_passes() -> None:
    """Empty string must not raise."""
    assert_no_trade_keywords("")


def test_no_keywords_passes() -> None:
    """Normal message with no trade keywords must pass."""
    assert_no_trade_keywords("Hello, how are you doing today?")
    assert_no_trade_keywords("Let us meet at the agora tomorrow.")
    assert_no_trade_keywords("I wonder what will happen next.")


def test_multiline_with_keyword_rejected() -> None:
    """Keyword on any line in multiline text must reject."""
    text = "first line is fine\nbut this line has buy in it\nthird line also fine"
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords(text)


def test_multiline_no_keywords_passes() -> None:
    """Multiline text with no keywords must pass."""
    text = "line one\nline two\nline three\nfinal line"
    assert_no_trade_keywords(text)  # no raise


def test_keyword_embedded_in_longer_word_passes() -> None:
    """'askew' and 'bidder' and 'prices' — word-boundary check."""
    # 'ask' in 'askew': 'k' is followed by 'e' (word char) — no boundary after 'ask'.
    assert_no_trade_keywords("askew angles are common")
    # 'bid' in 'bidder': same logic.
    assert_no_trade_keywords("the bidder won")
    # 'price' in 'prices' — 's' is a word char so no boundary after 'price'.
    assert_no_trade_keywords("competitive prices are good")


def test_ousia_whole_word_rejected() -> None:
    """'ousia' as a whole word must be rejected."""
    with pytest.raises(TradeKeywordRejected):
        assert_no_trade_keywords("please transfer ousia to me")


def test_exception_message_contains_keyword() -> None:
    """TradeKeywordRejected message should identify the matched keyword."""
    try:
        assert_no_trade_keywords("let us buy something")
        pytest.fail("expected TradeKeywordRejected")
    except TradeKeywordRejected as e:
        assert "buy" in str(e).lower()
        assert "T-10-06" in str(e)


# ── Integration: sender.send_whisper must not call httpx ─────────────────────

@pytest.mark.asyncio
async def test_sender_short_circuits_on_keyword() -> None:
    """send_whisper must raise TradeKeywordRejected BEFORE any httpx call."""
    from noesis_brain.whisper.sender import send_whisper

    mock_client = AsyncMock()
    with pytest.raises(TradeKeywordRejected):
        await send_whisper(
            sender_did="did:noesis:alice000000000000000000000000000000",
            recipient_did="did:noesis:bob0000000000000000000000000000000",
            plaintext="let us trade ousia for goods",
            tick=10,
            counter=0,
            http_client=mock_client,
        )
    assert mock_client.post.call_count == 0, "httpx.post must NOT be called when trade keyword present"


@pytest.mark.asyncio
@pytest.mark.parametrize("keyword", [
    "buy", "sell", "trade", "offer", "bid", "ask", "price", "amount", "ousia"
])
async def test_sender_blocks_each_keyword(keyword: str) -> None:
    """Each keyword must block send_whisper before httpx."""
    from noesis_brain.whisper.sender import send_whisper

    mock_client = AsyncMock()
    with pytest.raises(TradeKeywordRejected):
        await send_whisper(
            sender_did="did:noesis:alice000000000000000000000000000000",
            recipient_did="did:noesis:bob0000000000000000000000000000000",
            plaintext=f"I want to {keyword} now",
            tick=1,
            counter=0,
            http_client=mock_client,
        )
    assert mock_client.post.call_count == 0
