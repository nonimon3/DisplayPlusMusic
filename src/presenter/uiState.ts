/**
 * Shared UI state — which button is "currently selected" for visual highlight.
 * Updated by viewPresenter on phone-side control clicks (and eventPresenter on glasses tap).
 */
export const uiState = {
    // 0 = prev, 1 = play/pause, 2 = next
    selectedButtonIndex: 1,
};
