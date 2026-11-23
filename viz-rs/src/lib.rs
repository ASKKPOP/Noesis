//! Noēsis world view in Bevy (option C) — see README.md.
pub mod layout;
#[cfg(feature = "render")]
pub mod district;
#[cfg(feature = "render")]
pub mod scene;
#[cfg(all(feature = "render", target_arch = "wasm32"))]
mod web;
