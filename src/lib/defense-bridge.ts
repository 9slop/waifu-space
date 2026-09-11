import { createSignal } from 'solid-js';

/**
 * Reactive bridge between WaifuDefenseGame and RpgHub.
 * The guidance game sets `defenseGameActive` while a run has progress worth
 * protecting; RpgHub intercepts tab switches and shows a confirmation modal
 * before unmounting the game (which would discard the run).
 */
export const [defenseGameActive, setDefenseGameActive] = createSignal(false);

export const [pendingDefenseTab, setPendingDefenseTab] = createSignal<string | null>(null);