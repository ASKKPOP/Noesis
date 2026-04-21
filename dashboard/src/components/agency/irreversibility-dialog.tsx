// Stub — RED phase: allows test harness to import; all tests fail until GREEN.
import type { RefObject } from 'react';

export interface IrreversibilityDialogProps {
    open: boolean;
    targetDid: string;
    onConfirm: () => void;
    onCancel: () => void;
    openerRef?: RefObject<HTMLElement | null>;
}

export function IrreversibilityDialog(_props: IrreversibilityDialogProps) {
    return null;
}
