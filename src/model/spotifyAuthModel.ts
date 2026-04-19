import { storage } from '../utils/storage';
import { dbg } from '../Scripts/debugBanner';

class SpotifyAuthModel {
    // EVEN Hub serves the ehpk over http://127.0.0.1:<random-port>, so
    // window.location-derived URIs can't be stably registered in Spotify.
    // Hardcode this fork's GitHub Pages URL (what's registered in the user's
    // Spotify dashboard). After auth, Spotify redirects here; the deployed
    // web version exchanges the code and stores the refresh token via
    // EvenAppBridge, which the ehpk reads on next launch.
    REDIRECT_URI = "https://nonimon3.github.io/DisplayPlusMusic/";
    SCOPES = 'user-modify-playback-state user-read-playback-state';

    /**
     * Generates a random string for state parameter
     */
    generateRandomString(length: number): string {
        const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        array = array.map(x => validChars.charCodeAt(x % validChars.length));
        return String.fromCharCode.apply(null, Array.from(array));
    }

    /**
     * Initiates the Auth Flow by redirecting the user to Spotify
     */
    async generateAuthUrl(clientId: string): Promise<void> {
        const redirect = this.REDIRECT_URI;
        console.log("Using Redirect URI: " + redirect);
        dbg("generateAuthUrl: redirect_uri=" + redirect);
        const state = this.generateRandomString(16);
        await storage.setItem('spotify_auth_state', state);
        dbg("generateAuthUrl: saved state=" + state.substring(0, 6) + "…");

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        const params = {
            response_type: 'code',
            client_id: clientId,
            scope: this.SCOPES,
            redirect_uri: redirect,
            state: state,
        };

        authUrl.search = new URLSearchParams(params).toString();
        const finalUrl = authUrl.toString();
        dbg("generateAuthUrl: navigating to Spotify (" + finalUrl.length + " chars)");
        // Diagnostic: show exactly what redirect_uri and client_id prefix we're sending
        // so the user can byte-compare with their Spotify dashboard entry.
        alert(
            "redirect_uri=\n" + redirect +
            "\n\nclient_id starts with: " + clientId.substring(0, 8) +
            "\n(cid len=" + clientId.length + ")"
        );
        // Redirect the whole page
        window.location.href = finalUrl;
    }

    /**
     * Exchanges an auth code for a refresh token
     */
    async exchangeCodeForToken(code: string, clientId: string, clientSecret: string): Promise<any | null> {
        const redirect = this.REDIRECT_URI;
        dbg("exchange: POST /api/token redirect_uri=" + redirect + " cid len=" + clientId.length + " sec len=" + clientSecret.length);
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(clientId + ':' + clientSecret)
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: redirect,
                }),
            });

            const text = await response.text();
            dbg("exchange: HTTP " + response.status + " body=" + text.substring(0, 220));
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }

            if (data.refresh_token && data.access_token) {
                return data;
            } else {
                console.error('Error exchanging token:', data);
                return null;
            }
        } catch (err) {
            console.error('Network error exchanging token:', err);
            dbg("exchange: NETWORK ERROR " + (err instanceof Error ? err.message : String(err)));
            return null;
        }
    }

    /**
     * Checks the URL for an auth code and exchanges it for tokens
     * Returns the token data if successful, or null if no code found/error
     */
    async checkForAuthCode(): Promise<any | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const errorParam = urlParams.get('error');

        if (errorParam) {
            dbg("checkForAuthCode: spotify returned error=" + errorParam);
        }
        if (!code) {
            dbg("checkForAuthCode: no ?code in URL");
            return null;
        }
        dbg("checkForAuthCode: code present, state=" + (state || "").substring(0, 6) + "…");

        // Clean the URL
        window.history.replaceState({}, document.title, window.location.pathname);

        const savedState = await storage.getItem('spotify_auth_state');
        dbg("checkForAuthCode: savedState=" + (savedState || "<null>").substring(0, 6) + "…");
        if (state !== savedState) {
            console.error("State mismatch");
            dbg("checkForAuthCode: STATE MISMATCH (got=" + (state || "<null>").substring(0,6) + " saved=" + (savedState || "<null>").substring(0,6) + ")");
            return null;
        }
        await storage.removeItem('spotify_auth_state');

        const clientId = await storage.getItem('spotify_client_id');
        const clientSecret = await storage.getItem('spotify_client_secret');

        if (!clientId || !clientSecret) {
            dbg("checkForAuthCode: clientId/Secret missing in storage");
            return null;
        }

        dbg("checkForAuthCode: exchanging code for token…");
        const result = await this.exchangeCodeForToken(code, clientId, clientSecret);
        dbg("checkForAuthCode: exchange " + (result ? "OK (have refresh_token)" : "FAILED"));
        return result;
    }
}

const spotifyAuthModel = new SpotifyAuthModel();
export default spotifyAuthModel;
