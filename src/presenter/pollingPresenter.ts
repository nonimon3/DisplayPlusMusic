import spotifyPresenter from "./spotifyPresenter";
import lyricsPresenter from "./lyricsPresenter";
import { createView } from "../view/GlassesView";
import viewPresenter from "./viewPresenter";

class PollingPresenter {
    pollingtimeAPIs: number = 1000; // ms
    pollingtimeLyrics: number = 10; // ms

    private isPolling = false;
    private apiTimeout: number | undefined;
    private lyricsTimeout: number | undefined;

    private lastFrameTime: number = performance.now();

    async startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;
        this.lastFrameTime = performance.now(); // Initialize the clock
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

        if (this.isPolling) {
            this.apiTimeout = window.setTimeout(() => this.pollAPIs(), this.pollingtimeAPIs);
        }
    }

    private async pollQuick() {
        if (!this.isPolling) return;

        let song = spotifyPresenter.currentSong;

        let now = performance.now();
        let deltaSeconds = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        try {
            if (song) {
                // 5. If the song is playing, move the progress bar forward locally
                if (song.isPlaying && song.progressSeconds < song.durationSeconds) {
                    song.progressSeconds += deltaSeconds;
                }

                await lyricsPresenter.updateLyricsLine();
                createView(song);
            }
        } catch (error) {
            console.error("Error polling lyrics:", error);
        }

        if (this.isPolling) {
            this.lyricsTimeout = window.setTimeout(() => this.pollQuick(), this.pollingtimeLyrics);
        }
    }
}

const pollingPresenter = new PollingPresenter();
export default pollingPresenter;