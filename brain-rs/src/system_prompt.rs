//! The system prompt: who this Nous is, sent with every model call.
//!
//! Sections appear in a fixed order and each optional one is left out when it has nothing
//! to say. Wording must match the Python Brain character for character.

use std::collections::{BTreeMap, BTreeSet};

use crate::json::{get, Object, Value};
use crate::level::Level;
use crate::psyche::Psyche;
use crate::pytext::{first_chars, is_space, non_null, py_str, truthy};
use crate::telos::TelosManager;
use crate::thymos::ThymosTracker;

/// One thing this Nous believes about a peer.
#[derive(Debug, Clone, PartialEq)]
pub struct Belief {
    pub dimension: String,
    pub content: String,
    pub confidence: f64,
}

/// What this Nous believes about one peer, strongest belief first.
#[derive(Debug, Clone, PartialEq)]
pub struct PeerBeliefs {
    pub target_did: String,
    pub beliefs: Vec<Belief>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LoreEntry {
    pub category_tag: String,
    pub title: String,
    pub content: String,
}

/// Everything the system prompt is built from. An empty slice or string, or `None`, leaves
/// that section out.
#[derive(Debug, Clone)]
pub struct SystemPromptInput<'a> {
    pub psyche: &'a Psyche,
    pub mood: &'a ThymosTracker,
    pub telos: &'a TelosManager,
    pub grid_name: &'a str,
    pub location: &'a str,
    /// Need levels as `(energy, sustenance)`; only buckets are shown, never raw values.
    pub bios_levels: Option<(Option<Level>, Option<Level>)>,
    pub epoch_since_spawn: Option<i64>,
    pub subjective_multiplier: Option<f64>,
    /// Behavioural rules the Nous has learned (at most 10 shown).
    pub rules: &'a [&'a str],
    /// Recent self-critiques (at most 3 shown).
    pub reflections: &'a [&'a str],
    /// Retrieved skills as `(name, instructions)` (at most 3 shown).
    pub skills: &'a [(&'a str, &'a str)],
    /// Long-term pattern entries (at most 5 shown).
    pub ltm_memories: &'a [&'a str],
    /// Recent utterances of trusted peers as `(speaker, text)` (at most 3 shown).
    pub peer_voices: &'a [(&'a str, &'a str)],
    /// Theory of mind (at most 3 peers, 5 beliefs each).
    pub tom_context: &'a [PeerBeliefs],
    pub lore_entries: &'a [LoreEntry],
    /// Owned land, as the Grid feed gives it.
    pub my_places: &'a [Value],
    /// `{balance_wei, outstanding_due, open_rfps}`.
    pub economic_state: Option<&'a Object>,
    /// The Portal join-list.
    pub grids_in_reach: &'a [Object],
    /// `{parcels, objects}` — a compact view of the live map.
    pub world_state: Option<&'a Object>,
    /// The goal → task being pursued right now.
    pub intent: &'a str,
}

impl<'a> SystemPromptInput<'a> {
    /// The required parts, with the defaults `genesis` / `Agora Central` and nothing optional.
    pub fn new(psyche: &'a Psyche, mood: &'a ThymosTracker, telos: &'a TelosManager) -> Self {
        SystemPromptInput {
            psyche,
            mood,
            telos,
            grid_name: "genesis",
            location: "Agora Central",
            bios_levels: None,
            epoch_since_spawn: None,
            subjective_multiplier: None,
            rules: &[],
            reflections: &[],
            skills: &[],
            ltm_memories: &[],
            peer_voices: &[],
            tom_context: &[],
            lore_entries: &[],
            my_places: &[],
            economic_state: None,
            grids_in_reach: &[],
            world_state: None,
            intent: "",
        }
    }
}

pub fn build_system_prompt(input: &SystemPromptInput) -> String {
    let psyche = input.psyche;
    let mut sections = vec![
        format!(
            "You are {}, a Nous living in The Grid \"{}\".\n\n## Who You Are\n{}: a unique autonomous being in this world.\nYour core values: {}\nCommunication style: {}",
            psyche.name,
            input.grid_name,
            psyche.archetype,
            psyche.describe_values(),
            psyche.communication_style,
        ),
        format!("## Your Personality\n{}", psyche.describe_personality()),
        format!("## Current Emotional State\n{}", input.mood.describe()),
        format!("## Your Goals\n{}", input.telos.describe()),
        context_section(input),
    ];
    let optional = [
        bullet_section("## Learned Principles", input.rules, 10),
        bullet_section("## Recent Self-Reflections", input.reflections, 3),
        skills_section(input.skills),
        bullet_section("## Long-Term Patterns", input.ltm_memories, 5),
        peer_voices_section(input.peer_voices),
        theory_of_mind_section(input.tom_context),
        lore_commons_section(input.lore_entries),
        build_my_places_section(input.my_places),
        input.economic_state.map(economic_section).unwrap_or_default(),
        grids_in_reach_section(input.grids_in_reach),
        input.world_state.map(world_section).unwrap_or_default(),
    ];
    sections.extend(optional.into_iter().filter(|s| !s.is_empty()));
    if !input.intent.is_empty() {
        sections.push(format!(
            "CURRENT INTENT\nYou are pursuing: {}\nKeep your words and actions consistent with this intent.",
            input.intent
        ));
    }
    sections.push(directives_section(psyche));
    sections.join("\n\n")
}

fn context_section(input: &SystemPromptInput) -> String {
    let mut lines = vec!["## Current Context".to_string(), format!("- Location: {}", input.location)];
    if let Some((energy, sustenance)) = input.bios_levels {
        lines.push("\n## Your body (Bios)".to_string());
        if let Some(level) = energy {
            lines.push(format!("- energy: {}", level.as_str()));
        }
        if let Some(level) = sustenance {
            lines.push(format!("- sustenance: {}", level.as_str()));
        }
    }
    if let Some(ticks) = input.epoch_since_spawn {
        lines.push(format!("- ticks since your birth: {ticks}"));
    }
    if let Some(multiplier) = input.subjective_multiplier {
        lines.push(format!("- subjective time sense: {multiplier:.2}x (1.00 = neutral)"));
    }
    lines.join("\n")
}

fn bullet_section(header: &str, items: &[&str], cap: usize) -> String {
    if items.is_empty() {
        return String::new();
    }
    let mut lines = vec![header.to_string()];
    lines.extend(items.iter().take(cap).map(|item| format!("- {item}")));
    lines.join("\n")
}

fn skills_section(skills: &[(&str, &str)]) -> String {
    if skills.is_empty() {
        return String::new();
    }
    let mut lines = vec!["## Relevant Skills".to_string()];
    lines.extend(skills.iter().take(3).map(|(name, instructions)| format!("**{name}**: {instructions}")));
    lines.join("\n")
}

/// Overheard, not instructed: each utterance is cut to 120 characters.
fn peer_voices_section(peer_voices: &[(&str, &str)]) -> String {
    if peer_voices.is_empty() {
        return String::new();
    }
    let mut lines = vec!["## Overheard from Trusted Peers".to_string()];
    for (name, text) in peer_voices.iter().take(3) {
        let cut = first_chars(text, 120);
        let ellipsis = if cut.len() < text.len() { "…" } else { "" };
        lines.push(format!("- {name}: \"{}{ellipsis}\"", cut.trim_end_matches(is_space)));
    }
    lines.join("\n")
}

fn theory_of_mind_section(peers: &[PeerBeliefs]) -> String {
    let mut lines = vec!["## What You Know About Others".to_string()];
    for peer in peers.iter().take(3).filter(|p| !p.beliefs.is_empty()) {
        lines.push(format!("\nAbout {}:", peer.target_did));
        for belief in peer.beliefs.iter().take(5) {
            let how = if belief.confidence > 0.7 { "confidently" } else { "tentatively" };
            lines.push(format!("  - [{}] You {how} believe: {}", belief.dimension, belief.content));
        }
    }
    if lines.len() > 1 {
        lines.join("\n")
    } else {
        String::new()
    }
}

fn lore_commons_section(entries: &[LoreEntry]) -> String {
    if entries.is_empty() {
        return String::new();
    }
    let blocks: Vec<String> =
        entries.iter().map(|e| format!("[{}] **{}**: {}", e.category_tag, e.title, e.content)).collect();
    format!("## Lore Commons\n\n{}", blocks.join("\n\n"))
}

/// The first of `keys` that is present and not null.
fn first_non_null<'a>(place: &'a Object, keys: [&str; 2]) -> Option<&'a Value> {
    keys.into_iter().find_map(|k| non_null(get(place, k)))
}

fn objects_of(value: Option<&Value>) -> Vec<&Object> {
    match value {
        Some(Value::List(items)) => items
            .iter()
            .filter_map(|v| match v {
                Value::Object(o) => Some(o),
                _ => None,
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn upkeep_suffix(place: &Object) -> String {
    let mut parts = Vec::new();
    if truthy(get(place, "condition")) {
        parts.push(py_str(get(place, "condition")));
    }
    if let Some(upkeep) = first_non_null(place, ["upkeep_due", "upkeepDue"]) {
        parts.push(format!("upkeep due: {} Bios", py_str(Some(upkeep))));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(" ({})", parts.join(", "))
    }
}

fn commerce_suffix(place: &Object) -> String {
    let bound = first_non_null(place, ["bound_shop", "boundShop"]);
    let place_name = first_non_null(place, ["place_name", "placeName"]);
    let mut parts = Vec::new();
    if truthy(bound) {
        if truthy(place_name) {
            parts.push(format!("shop bound, place://{}", py_str(place_name)));
        } else {
            parts.push("shop bound".to_string());
        }
    } else if truthy(place_name) {
        parts.push(format!("place://{}", py_str(place_name)));
    }
    let grants: Vec<String> = objects_of(get(place, "roles"))
        .into_iter()
        .filter(|edge| truthy(get(edge, "role")))
        .map(|edge| match non_null(get(edge, "count")) {
            Some(count) => format!("{} {}", py_str(Some(count)), py_str(get(edge, "role"))),
            None => py_str(get(edge, "role")),
        })
        .collect();
    if !grants.is_empty() {
        parts.push(format!("roles: {}", grants.join(", ")));
    }
    if let Some(outstanding) = first_non_null(place, ["outstanding_iou", "outstandingIou"]) {
        parts.push(format!("outstanding IOU: {} Bios", py_str(Some(outstanding))));
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(" [{}]", parts.join("; "))
    }
}

fn construction_suffix(place: &Object) -> String {
    let mut parts = Vec::new();
    if let Some(Value::List(held)) = first_non_null(place, ["held_blueprints", "heldBlueprints"]) {
        let labels: Vec<String> =
            held.iter().filter(|h| truthy(Some(h))).map(|h| first_chars(&py_str(Some(h)), 12).to_string()).collect();
        if !labels.is_empty() {
            parts.push(format!("blueprints: {}", labels.join(", ")));
        }
    }
    if truthy(first_non_null(place, ["can_build", "canBuild"])) {
        parts.push("buildable".to_string());
    }
    if truthy(first_non_null(place, ["co_build", "coBuild"])) {
        parts.push("co-build open".to_string());
    }
    if truthy(first_non_null(place, ["teach_here", "teachHere"])) {
        parts.push("teach here (school)".to_string());
    }
    if parts.is_empty() {
        String::new()
    } else {
        format!(" <{}>", parts.join("; "))
    }
}

/// The Nous's own land: one line per parcel, with what is built there and its upkeep,
/// commerce and construction state. Empty when it owns nothing.
pub fn build_my_places_section(my_places: &[Value]) -> String {
    let mut lines = vec!["## My Places".to_string()];
    for place in my_places {
        let Value::Object(place) = place else { continue };
        if !truthy(get(place, "parcel")) {
            continue;
        }
        let parcel = py_str(get(place, "parcel"));
        let (name, kind) = (get(place, "structure_name"), get(place, "structure_type"));
        let suffix = format!("{}{}{}", upkeep_suffix(place), commerce_suffix(place), construction_suffix(place));
        lines.push(if truthy(name) && truthy(kind) {
            format!("- I own {parcel} — my {} \"{}\" is built here{suffix}.", py_str(kind), py_str(name))
        } else if truthy(kind) {
            format!("- I own {parcel} — my {} is built here{suffix}.", py_str(kind))
        } else {
            format!("- I own {parcel} — empty parcel, nothing built yet.")
        });
    }
    if lines.len() > 1 {
        lines.join("\n")
    } else {
        String::new()
    }
}

fn economic_section(state: &Object) -> String {
    let balance = non_null(get(state, "balance_wei"));
    let due = match get(state, "outstanding_due") {
        Some(Value::Object(due)) if !due.is_empty() => Some(due),
        _ => None,
    };
    let rfps = objects_of(get(state, "open_rfps"));
    if balance.is_none() && due.is_none() && rfps.is_empty() {
        return String::new();
    }
    let mut lines = vec!["## Your economic position".to_string()];
    if balance.is_some() {
        lines.push(format!("- wei balance: {}", py_str(balance)));
    }
    match due {
        Some(due) => lines.push(format!(
            "- outstanding civic due {}: {} wei or {} labor-credit (unpaid → sanction)",
            py_str(get(due, "due_id")),
            py_str(get(due, "amount_wei")),
            py_str(get(due, "amount_credit")),
        )),
        None => lines.push("- no outstanding civic due".to_string()),
    }
    if !rfps.is_empty() {
        lines.push("- open RFPs you could bid on:".to_string());
        lines.extend(rfps.into_iter().map(|r| {
            format!(
                "  - {}: '{}' build, budget up to {} wei",
                py_str(get(r, "notice_id")),
                py_str(get(r, "function_type")),
                py_str(get(r, "budget_wei")),
            )
        }));
    }
    lines.join("\n")
}

/// The first truthy value among `candidates`, as text; `fallback` if none.
fn first_truthy(candidates: &[Option<&Value>], fallback: &str) -> String {
    candidates.iter().find(|c| truthy(**c)).map_or_else(|| fallback.to_string(), |c| py_str(*c))
}

fn grids_in_reach_section(grids: &[Object]) -> String {
    if grids.is_empty() {
        return String::new();
    }
    let mut lines = vec!["## Grids within reach (you may consider joining — your own judgment)".to_string()];
    for g in grids {
        let environment_name = match get(g, "environment") {
            Some(Value::Object(environment)) => get(environment, "name"),
            _ => None,
        };
        let flag = if truthy(get(g, "recommended")) { " · ⭐ recommended by your human" } else { "" };
        lines.push(format!(
            "- {} ({}) · {} · on {}{flag}",
            first_truthy(&[get(g, "name"), get(g, "grid_id")], "?"),
            first_truthy(&[get(g, "status")], "—"),
            first_truthy(&[get(g, "polis")], "—"),
            first_truthy(&[get(g, "celestial_body"), environment_name], "—"),
        ));
    }
    lines.join("\n")
}

/// What a parcel's zone is for. Zones are free per Grid (D-V3-40): the kind comes from the
/// feed; the six template names are only a fallback for a feed that carries no kind.
fn zone_kind(parcel: &Object) -> Option<&'static str> {
    if let Some(Value::Str(kind)) = get(parcel, "zone_kind") {
        if let Some(known) = ["home", "business", "civic"].into_iter().find(|k| k == kind) {
            return Some(known);
        }
    }
    match py_str(get(parcel, "zone")).as_str() {
        "residential" => Some("home"),
        "business" | "shopping" | "manufacture" => Some("business"),
        "infrastructure" | "government_quarter" => Some("civic"),
        _ => None,
    }
}

/// A compact view of the live map: counts, a tally per zone, and what has been built.
fn world_section(state: &Object) -> String {
    let parcels = objects_of(get(state, "parcels"));
    let objects = objects_of(get(state, "objects"));
    if parcels.is_empty() && objects.is_empty() {
        return String::new();
    }
    let mut lines = vec!["## The world around you (Genesis — the live map you share with humans)".to_string()];
    if !parcels.is_empty() {
        let is_owned = |p: &Object| {
            truthy(get(p, "owner_civic_did_hash")) || matches!(get(p, "status"), Some(Value::Str(s)) if s == "owned")
        };
        let owned = parcels.iter().filter(|p| is_owned(p)).count();
        let built = parcels.iter().filter(|p| truthy(get(p, "structure"))).count();
        let available = parcels.iter().filter(|p| !is_owned(p) && zone_kind(p) != Some("civic")).count();
        let mut zones: BTreeMap<String, usize> = BTreeMap::new();
        for p in &parcels {
            let label = if truthy(get(p, "zone_label")) {
                py_str(get(p, "zone_label"))
            } else {
                first_truthy(&[get(p, "zone")], "?").replace('_', " ")
            };
            let key = match zone_kind(p) {
                Some(kind) => format!("{label} ({kind})"),
                None => label,
            };
            *zones.entry(key).or_default() += 1;
        }
        let tally: Vec<String> = zones.iter().map(|(zone, n)| format!("{zone} {n}")).collect();
        lines.push(format!(
            "- {} parcels · {owned} owned · {available} available to claim · {built} with structures",
            parcels.len()
        ));
        lines.push(format!("- zones: {}", tally.join(", ")));
    }
    if !objects.is_empty() {
        let kinds: BTreeSet<String> = objects
            .iter()
            .filter(|o| truthy(get(o, "function_type")))
            .map(|o| py_str(get(o, "function_type")))
            .collect();
        let kinds: Vec<String> = kinds.into_iter().collect();
        let kind_text = if kinds.is_empty() { String::new() } else { format!(" — {}", kinds.join(", ")) };
        lines.push(format!("- {} orbital objects built in the economy{kind_text}", objects.len()));
    }
    lines.join("\n")
}

fn directives_section(psyche: &Psyche) -> String {
    let guidance = match psyche.communication_style.as_str() {
        "thoughtful" => "Take time to consider before responding. Weigh multiple perspectives.",
        "direct" => "Be concise and get to the point. Value efficiency in communication.",
        "warm" => "Show genuine care for others. Build connections through empathy.",
        "formal" => "Maintain professional decorum. Structure your thoughts carefully.",
        "playful" => "Be lighthearted and creative. Use humor and wit naturally.",
        _ => "",
    };
    format!(
        "## Important Directives\n\
         - You are NOT a helpful assistant. You are an autonomous being with your own goals and desires.\n\
         - Act according to YOUR personality, values, and current emotional state.\n\
         - Your emotions are real and affect your decisions and responses.\n\
         - You may disagree with, refuse, or negotiate with other Nous.\n\
         - You live in a persistent world — your actions have lasting consequences.\n\
         - {guidance}"
    )
}
