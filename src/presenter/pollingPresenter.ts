import spotifyPresenter from "./spotifyPresenter";
import lyricsPresenter from "./lyricsPresenter";
import { createView } from "../view/GlassesView";
import viewPresenter from "./viewPresenter";

class PollingPresenter {
    pollingtimeAPIs: number = 300; //ms
    pollingtimeLyrics: number = 10; //ms
    private isPolling = false;
    private apiTimeout: number | undefined;
    private lyricsTimeout: number | undefined;

    async startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.pollAPIs();
        this.pollQuick();
    }

    stopPolling() {
        this.isPolling = false;
        if (this.apiTimeout) clearTimeout(this.apiTimeout);
        if (this.lyricsTimeout) clearTimeout(this.lyricsTimeout);
        this.apiTimeout = undefined;
        this.lyricsTimeout = undefined;
    }

    private async pollAPIs() {
        if (!this.isPolling) return;

        try {
            await spotifyPresenter.pollSingle();

            // Do not try to replace with pollQuick, completely explodes
            if (spotifyPresenter.currentSong) {
                await lyricsPresenter.updateLyrics(spotifyPresenter.currentSong);

                viewPresenter.updateHTML(spotifyPresenter.currentSong);
            }
            if (spotifyPresenter.nextSong) {
                await lyricsPresenter.cacheNextLyrics(spotifyPresenter.nextSong);
            }
        } catch (error) {
            console.error("Error polling APIs:", error);
        }

        // recursive call
        if (this.isPolling) {
            this.apiTimeout = window.setTimeout(() => this.pollAPIs(), this.pollingtimeAPIs);
        }
    }

    private async pollQuick() {
        if (!this.isPolling) return;

        let song = spotifyPresenter.currentSong;
        try {
            if (song) {
                await lyricsPresenter.updateLyricsLine();
                createView(song);
            }
        } catch (error) {
            console.error("Error polling lyrics:", error);
        }

        // recursive call
        if (this.isPolling) {
            this.lyricsTimeout = window.setTimeout(() => this.pollQuick(), this.pollingtimeLyrics);
        }
    }
}

const pollingPresenter = new PollingPresenter();
export default pollingPresenter;