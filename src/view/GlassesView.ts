import {
    waitForEvenAppBridge,
    EvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    StartUpPageCreateResult,
    RebuildPageContainer,
    TextContainerUpgrade,
} from '@evenrealities/even_hub_sdk';

import Song from '../model/songModel';
import lyricsPresenter from '../presenter/lyricsPresenter';
import { uiState } from '../presenter/uiState';
import { dbg } from '../Scripts/debugBanner';

const MAX_HEIGHT = 288;
const MAX_WIDTH = 576;

export const ID_SONG_INFO = 10;
export const ID_LYRICS = 11;
export const ID_BUTTONS = 12;

const TOP_H = 32;
const BUTTONS_H = 40; // single-line row
const BUTTONS_Y = MAX_HEIGHT - BUTTONS_H; // 248
const LYRICS_Y = TOP_H + 8;                // 40
const LYRICS_H = BUTTONS_Y - LYRICS_Y - 4;  // 204

let bridge: EvenAppBridge | null = null;
let isPageCreated = false;
let isUpdating = false;

const lastText: Record<number, string> = {};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
    return Promise.race([
        promise.catch(() => fallback),
        new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
    ]);
}

function buildContainerConfig(songInfoText: string, lyricsText: string, buttonsText: string) {
    return {
        containerTotalNum: 3,
        textObject: [
            new TextContainerProperty({
                xPosition: 0, yPosition: 0,
                width: MAX_WIDTH, height: TOP_H,
                borderWidth: 0, borderRadius: 0,
                containerID: ID_SONG_INFO, containerName: 'songInfo',
                content: songInfoText,
                isEventCapture: 0,
            }),
            new TextContainerProperty({
                xPosition: 0, yPosition: LYRICS_Y,
                width: MAX_WIDTH, height: LYRICS_H,
                borderWidth: 0, borderRadius: 0,
                containerID: ID_LYRICS, containerName: 'lyrics',
                content: lyricsText,
                isEventCapture: 0,
            }),
            new TextContainerProperty({
                xPosition: 0, yPosition: BUTTONS_Y,
                width: MAX_WIDTH, height: BUTTONS_H,
                borderWidth: 0, borderRadius: 0,
                containerID: ID_BUTTONS, containerName: 'buttons',
                content: buttonsText,
                // SDK requires exactly one event-capturing container.
                isEventCapture: 1,
            }),
        ],
    };
}

export const BUTTON_COUNT = 4;
export const HIDE_INDEX = 3; // 4th button — hovering it hides songInfo + buttons (lyrics-only mode)

/**
 * Single-line button row. Selected button is wrapped in [ ]; others are plain.
 * Play/pause glyph: filled ▶ when playing, hollow ▷ when paused — always
 * accompanied by `ll` so the button reads as a play/pause toggle regardless
 * of state. 4th button Ｘ hides top/bottom UI on hover.
 *
 * sel=1, playing:  "   ◁◁    [▶ll]    ▷▷    Ｘ   "
 */
function buildButtonsText(selected: number, playing: boolean): string {
    const labels = ['◁◁', playing ? '▶ll' : '▷ll', '▷▷', 'Ｘ'];
    const cells = labels.map((l, i) => selected === i ? `[${l}]` : l);
    return '   ' + cells.join('    ') + '   ';
}

async function upgradeIfChanged(containerID: number, containerName: string, content: string): Promise<void> {
    if (lastText[containerID] === content) return;
    const ok = await withTimeout(
        bridge!.textContainerUpgrade(new TextContainerUpgrade({
            containerID,
            containerName,
            content,
        })),
        2000,
        false,
    );
    if (ok) lastText[containerID] = content;
}

export async function createView(song: Song): Promise<void> {
    if (isUpdating) return;
    isUpdating = true;

    try {
        if (!bridge) {
            bridge = await withTimeout(waitForEvenAppBridge(), 3000, null);
            if (!bridge) {
                console.warn('[GlassesView] Bridge unavailable, skipping frame');
                return;
            }
        }

        const sel = uiState.selectedButtonIndex;
        const isHideMode = sel === HIDE_INDEX;
        // SDK textContainerUpgrade may silently no-op on an empty string,
        // so fall back to a single space when we want the container to look empty.
        const BLANK = ' ';
        const songInfoText = isHideMode ? BLANK : `${song.title} / ${song.artist}`;
        const lyricsText = lyricsPresenter.displayLines;
        const buttonsText = isHideMode ? BLANK : buildButtonsText(sel, !!song.isPlaying);

        const config = buildContainerConfig(songInfoText, lyricsText, buttonsText);

        if (!isPageCreated) {
            const result = await withTimeout(
                bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config)),
                5000,
                StartUpPageCreateResult.invalid,
            );
            console.log('[GlassesView] createStartUpPageContainer:', result);
            dbg(`view.create: ${result}`);

            if (result === StartUpPageCreateResult.success) {
                isPageCreated = true;
            } else if (result === StartUpPageCreateResult.invalid) {
                const rebuilt = await withTimeout(
                    bridge.rebuildPageContainer(new RebuildPageContainer(config)),
                    5000,
                    false,
                );
                dbg(`view.rebuild: ${rebuilt}`);
                if (rebuilt) {
                    await new Promise(r => setTimeout(r, 300));
                    isPageCreated = true;
                } else {
                    return;
                }
            } else {
                console.error('[GlassesView] Fatal container error:', result);
                dbg(`view.create FATAL: ${result}`);
                return;
            }

            lastText[ID_SONG_INFO] = songInfoText;
            lastText[ID_LYRICS] = lyricsText;
            lastText[ID_BUTTONS] = buttonsText;
            return;
        }

        await upgradeIfChanged(ID_SONG_INFO, 'songInfo', songInfoText);
        await upgradeIfChanged(ID_LYRICS, 'lyrics', lyricsText);
        await upgradeIfChanged(ID_BUTTONS, 'buttons', buttonsText);

    } catch (e) {
        console.error('[GlassesView] createView error:', e);
    } finally {
        isUpdating = false;
    }
}
