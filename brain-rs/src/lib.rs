//! Noēsis Brain — Rust port (D-V3-42).
//!
//! Ported so far: the deterministic faculties frozen by `brain/parity/fixtures/`.
//! A module is correct when `cargo test` replays its fixture exactly. The Python Brain
//! stays the live one until cut-over (R5).

pub mod ananke;
pub mod bios;
pub mod body;
pub mod chronos;
pub mod config;
pub mod config_edit;
pub mod ffi;
pub mod hashing;
pub mod json;
pub mod level;
pub mod memory;
pub mod parsing;
pub mod prompts;
pub mod psyche;
pub mod pytext;
pub mod state_hash;
pub mod system_prompt;
pub mod telos;
pub mod thymos;
pub mod view;
