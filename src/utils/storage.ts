/**
 * Dual-write storage wrapper.
 *
 * The EVEN Hub WebView injects `flutter_inappwebview` and exposes
 * EvenAppBridge. To survive navigation away from and back to the app
 * (e.g. Spotify OAuth round-trips), values are written to BOTH the
 * bridge-managed native store AND the WebView's own localStorage,
 * and reads check both layers. In a plain browser the bridge layer
 * is just skipped.
 */
import { EvenAppBridge } from "@evenrealities/even_hub_sdk";

function bridgeAvailable(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof (window as any).flutter_inappwebview !== "undefined"
    );
}

async function tryBridgeSet(key: string, value: string): Promise<void> {
    if (!bridgeAvailable()) return;
    try {
        const bridge = await EvenAppBridge.getInstance();
        await bridge.setLocalStorage(key, value);
    } catch (e) {
        console.warn("[storage] bridge.setLocalStorage failed:", e);
    }
}

async function tryBridgeGet(key: string): Promise<string | null> {
    if (!bridgeAvailable()) return null;
    try {
        const bridge = await EvenAppBridge.getInstance();
        const v = await bridge.getLocalStorage(key);
        return v ?? null;
    } catch (e) {
        console.warn("[storage] bridge.getLocalStorage failed:", e);
        return null;
    }
}

function tryLocalSet(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch (e) {
        console.warn("[storage] localStorage.setItem failed:", e);
    }
}

function tryLocalGet(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch (e) {
        console.warn("[storage] localStorage.getItem failed:", e);
        return null;
    }
}

function tryLocalRemove(key: string): void {
    try {
        window.localStorage.removeItem(key);
    } catch (e) {
        console.warn("[storage] localStorage.removeItem failed:", e);
    }
}

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        // Write to both layers so whichever survives navigation is usable.
        tryLocalSet(key, value);
        await tryBridgeSet(key, value);
    },

    getItem: async (key: string): Promise<string | null> => {
        // Prefer localStorage (synchronous, always-available origin store);
        // fall back to bridge if missing.
        const local = tryLocalGet(key);
        if (local && local.length > 0) return local;
        const fromBridge = await tryBridgeGet(key);
        if (fromBridge && fromBridge.length > 0) {
            // Backfill localStorage so subsequent reads are fast/reliable.
            tryLocalSet(key, fromBridge);
            return fromBridge;
        }
        return null;
    },

    removeItem: async (key: string): Promise<void> => {
        tryLocalRemove(key);
        if (bridgeAvailable()) {
            try {
                const bridge = await EvenAppBridge.getInstance();
                await bridge.setLocalStorage(key, "");
            } catch (e) {
                console.warn("[storage] bridge remove failed:", e);
            }
        }
    },
};
