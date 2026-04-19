import { waitForEvenAppBridge, OsEventTypeList } from "@evenrealities/even_hub_sdk";
import spotifyPresenter from './spotifyPresenter';
import { uiState } from './uiState';
import { dbg } from '../Scripts/debugBanner';
import { BUTTON_COUNT } from '../view/GlassesView';

/**
 * Touchpad events may arrive as sysEvent, textEvent, or listEvent depending
 * on what the SDK routes them to. Listen on all three and normalise by
 * eventType. SCROLL moves the cursor one step, CLICK activates.
 */
export async function eventHandler() {
    const bridge = await waitForEvenAppBridge();

    const unsubscribe = bridge.onEvenHubEvent((event) => {
        let eventType: OsEventTypeList | undefined;
        let source = '';
        let src: number | undefined;
        if (event.sysEvent) {
            eventType = event.sysEvent.eventType;
            src = event.sysEvent.eventSource;
            source = 'sys';
        } else if (event.textEvent) {
            eventType = event.textEvent.eventType;
            source = 'text';
        } else if (event.listEvent) {
            eventType = event.listEvent.eventType;
            source = 'list';
        } else return;

        // Skip IMU stream spam
        if (eventType === OsEventTypeList.IMU_DATA_REPORT) return;

        dbg(`${source} t=${eventType}${src !== undefined ? ` src=${src}` : ''} sel=${uiState.selectedButtonIndex}`);

        switch (eventType) {
            case OsEventTypeList.SCROLL_TOP_EVENT:
                // up swipe → cursor one step left (wrap)
                uiState.selectedButtonIndex =
                    (uiState.selectedButtonIndex - 1 + BUTTON_COUNT) % BUTTON_COUNT;
                break;
            case OsEventTypeList.SCROLL_BOTTOM_EVENT:
                // down swipe → cursor one step right (wrap)
                uiState.selectedButtonIndex =
                    (uiState.selectedButtonIndex + 1) % BUTTON_COUNT;
                break;
            case OsEventTypeList.CLICK_EVENT:
            case OsEventTypeList.DOUBLE_CLICK_EVENT:
                activate(uiState.selectedButtonIndex);
                break;
        }
    });

    return unsubscribe;
}

function activate(idx: number): void {
    switch (idx) {
        case 0: spotifyPresenter.song_back(); break;
        case 1: spotifyPresenter.song_pauseplay(); break;
        case 2: spotifyPresenter.song_forward(); break;
    }
}
