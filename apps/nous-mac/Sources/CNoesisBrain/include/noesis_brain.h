// C interface of the Noēsis Brain core (brain-rs/src/ffi.rs). Text in, JSON text out.
#ifndef NOESIS_BRAIN_H
#define NOESIS_BRAIN_H

#include <stdint.h>

// A Nous built from YAML configuration text, with its body advanced from birth to `tick`.
// Returns JSON: {"ok": {...}} or {"error": "..."}. Release with noesis_string_free.
char *noesis_nous_view(const char *yaml, int64_t tick);

// Release a string returned by this library.
void noesis_string_free(char *text);

#endif
