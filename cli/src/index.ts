#!/usr/bin/env node
/**
 * Noēsis CLI — entry point.
 *
 * Usage:
 *   noesis genesis              Launch the Genesis Grid
 *   noesis genesis --preset     Use the default Genesis preset
 *   noesis status               Show Grid status
 *   noesis spawn <name>         Spawn a new Nous
 *   noesis regions              List regions
 *   noesis laws                 List active laws
 *   noesis audit                Show recent audit trail
 */

import { run } from './commands/runner.js';

run(process.argv.slice(2));
