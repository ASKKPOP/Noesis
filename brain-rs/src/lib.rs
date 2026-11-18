//! Noēsis Brain — Rust port (D-V3-42).
//!
//! Ported so far: the deterministic faculties frozen by `brain/parity/fixtures/`.
//! A module is correct when `cargo test` replays its fixture exactly. The Python Brain
//! stays the live one until cut-over (R5).

pub mod ananke;
pub mod bios;
pub mod chronos;
pub mod hashing;
pub mod json;
pub mod level;
pub mod parsing;
pub mod thymos;
