/**
 * Shared primitives barrel — Plans 04-05 (Inspector) and 04-06 (Economy) both
 * import from '@/components/primitives' so these components MUST live at the
 * shared location, not inside the inspector/ or economy/ subtree.
 */

export { Chip } from './chip';
export type { ChipProps } from './chip';

export { MeterRow } from './meter-row';
export type { MeterRowProps } from './meter-row';

export { EmptyState } from './empty-state';
export type { EmptyStateProps } from './empty-state';
