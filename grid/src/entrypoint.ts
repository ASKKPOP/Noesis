/**
 * Grid entrypoint — thin launcher for production Docker deployment.
 *
 * Intentionally minimal: just calls startGrid() from main.ts.
 * Keeping this separate from main.ts ensures tests can import
 * createGridApp() without triggering auto-execution.
 */

import { startGrid } from './main.js';

void startGrid();
