/**
 * Storage wrapper.
 * Uses EvenAppBridge when running inside EVEN Hub WebView,
 * otherwise falls back to plain browser localStorage so the app
 * can be tested in a normal browser.
 */
import { EvenAppBridge } from "@evenrealities/even_hub_sdk";

const hasBridge: boolean =
    typeof window !== "undefined" &&
    typeof (window as any).flutter_inappwebview !== "undefined";

async function getBridge() {
    return EvenAppBridge.getInstance();
}

export const storage = {
    setItem: async (key: string, value: string): Promise<void> => {
        if (hasBridge) {
            try {
                const bridge = await getBridge();
                await bridge.setLocalStorage(key, value);
                return;
            } catch (e) {
                console.warn("[storage] bridge.setLocalStorage failed, falling back to localStorage:", e);
            }
        }
        try {
            window.localStorage.setItem(key, value);
        } catch (e) {
            console.error("[storage] localStorage.setItem failed:", e);
        }
    },

    getItem: async (key: string): Promise<string | null> => {
        if (hasBridge) {
            try {
                const bridge = await getBridge();
                const v = await bridge.getLocalStorage(key);
                return v ?? null;
            } catch (e) {
                console.warn("[storage] bridge.getLocalStorage failed, falling back to localStorage:", e);
            }
        }
        try {
            return window.localStorage.getItem(key);
        } catch (e) {
            console.error("[storage] localStorage.getItem failed:", e);
            return null;
        }
    },

    removeItem: async (key: string): Promise<void> => {
        if (hasBridge) {
            try {
                const bridge = await getBridge();
                await bridge.setLocalStorage(key, "");
                return;
            } catch (e) {
                console.warn("[storage] bridge remove failed, falling back to localStorage:", e);
            }
        }
        try {
            window.localStorage.removeItem(key);
        } catch (e) {
            console.error("[storage] localStorage.removeItem failed:", e);
        }
    },
};
