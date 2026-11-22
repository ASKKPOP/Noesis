//! Memory retrieval scoring — recency × importance × relevance, tick-based.

use std::collections::HashSet;

use crate::chronos::{recency_score_by_tick, DEFAULT_DECAY_RATE};
use crate::pytext::split_words;

/// What scoring reads from a memory.
#[derive(Debug, Clone, PartialEq)]
pub struct Memory {
    pub content: String,
    /// 0–10.
    pub importance: f64,
    /// Grid tick when it happened.
    pub tick: i64,
}

/// Importance normalized to [0, 1].
pub fn importance_score(memory: &Memory) -> f64 {
    0.0_f64.max(1.0_f64.min(memory.importance / 10.0))
}

/// Share of the query's distinct words that appear in the memory, ignoring case.
/// 0.5 (neutral) when there is no query.
pub fn relevance_score(memory: &Memory, query: &str) -> f64 {
    let query = query.to_lowercase();
    let query_words: HashSet<&str> = split_words(&query).collect();
    if query_words.is_empty() {
        return 0.5;
    }
    let content = memory.content.to_lowercase();
    let content_words: HashSet<&str> = split_words(&content).collect();
    query_words.intersection(&content_words).count() as f64 / query_words.len() as f64
}

/// Full score, with recency stretched or compressed by the subjective-time multiplier.
pub fn score_with_chronos(memory: &Memory, query: &str, current_tick: i64, multiplier: f64) -> f64 {
    let recency = recency_score_by_tick(memory.tick, current_tick, DEFAULT_DECAY_RATE);
    let scaled = 0.0_f64.max(1.0_f64.min(recency * multiplier));
    scaled * importance_score(memory) * relevance_score(memory, query)
}

/// The top `k` memory contents for a query, best first. `pool` is newest-first; equal
/// scores keep that order. `prefix` narrows to one family (e.g. "Lesson:").
pub fn ranked_memories<'a>(pool: &'a [Memory], query: &str, tick: i64, k: usize, prefix: Option<&str>) -> Vec<&'a str> {
    let mut scored: Vec<(f64, &Memory)> = pool
        .iter()
        .filter(|m| prefix.is_none_or(|p| m.content.starts_with(p)))
        .map(|m| (score_with_chronos(m, query, tick, 1.0), m))
        .collect();
    scored.sort_by(|a, b| b.0.total_cmp(&a.0));
    scored.into_iter().take(k).map(|(_, m)| m.content.as_str()).collect()
}
