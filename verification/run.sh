#!/usr/bin/env bash
# Runs the two model legs of the Triple Verification Rule from a clean state:
#   1. TLC on every verification/tla/*.tla (each needs a .cfg beside it)
#   2. `lake build` on verification/lean, then an axiom check
# The third leg (property-based tests) runs inside each package's test suite.
#
# Needs: java (11+), lake (Lean 4, via elan). Fetches the TLC jar on first use.
set -euo pipefail
cd "$(dirname "$0")"

TLA_VERSION=1.7.4
TLA_SHA256=936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88
JAR="$PWD/.tools/tla2tools.jar"

JAVA="${JAVA:-}"
if [ -z "$JAVA" ]; then
    if [ -x /opt/homebrew/opt/openjdk/bin/java ]; then JAVA=/opt/homebrew/opt/openjdk/bin/java; else JAVA=java; fi
fi

if [ ! -f "$JAR" ]; then
    mkdir -p .tools
    curl -sSfL -o "$JAR" "https://github.com/tlaplus/tlaplus/releases/download/v${TLA_VERSION}/tla2tools.jar"
fi
echo "${TLA_SHA256}  ${JAR}" | shasum -a 256 -c - >/dev/null \
    || { echo "[verification] tla2tools.jar checksum mismatch" >&2; exit 1; }

echo "== TLA+ (TLC ${TLA_VERSION})"
for spec in tla/*.tla; do
    name="$(basename "$spec" .tla)"
    out="$(mktemp)"
    rm -rf ".tools/states-$name"
    if ! (cd tla && "$JAVA" -XX:+UseParallelGC -cp "$JAR" tlc2.TLC \
            -config "$name.cfg" -workers auto -metadir "../.tools/states-$name" "$name.tla") >"$out" 2>&1; then
        cat "$out"; echo "[verification] TLC FAILED: $name" >&2; exit 1
    fi
    grep -q 'Model checking completed. No error has been found.' "$out" \
        || { cat "$out"; echo "[verification] TLC did not report success: $name" >&2; exit 1; }
    states="$(grep -E '^[0-9]+ states generated' "$out" | tail -1)"
    echo "  $name: OK — $states"
    rm -rf ".tools/states-$name" "$out"
done

echo "== Lean ($(cat lean/lean-toolchain))"
rm -rf lean/.lake/build
out="$(mktemp)"
if ! (cd lean && lake build) >"$out" 2>&1; then
    cat "$out"; echo "[verification] lake build FAILED" >&2; exit 1
fi
# Every `#print axioms` line may name only the three standard axioms.
bad="$(grep 'depends on axioms' "$out" | sed -E 's/.*depends on axioms: \[(.*)\]/\1/' \
    | tr ',' '\n' | tr -d ' ' | grep -vxE 'propext|Classical\.choice|Quot\.sound' || true)"
if [ -n "$bad" ]; then
    cat "$out"; echo "[verification] forbidden axiom(s): $bad" >&2; exit 1
fi
theorems="$(grep -cE "depends on axioms|does not depend on any axioms" "$out" || true)"
echo "  lake build: OK — $theorems headline theorem(s), standard axioms only"
rm -f "$out"
