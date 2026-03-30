import { fetchLyrics } from "../model/lyricsModel";
import { formatTime } from "../Scripts/formatTime";
import Song from "../model/songModel";
import spotifyPresenter from "./spotifyPresenter";

class LyricsPresenter {
    currentTrackSongID: string = "";
    currentTrackLyrics: string = "";
    currentTrackSyncedLyrics: string = "";

    nextTrackSongID: string = "";
    nextTrackLyrics: string = "";
    nextTrackSyncedLyrics: string = "";

    currentLine: string = "";
    nextLine: string = "";

    currentIndex = 0;

    async updateLyrics(song: Song) {
        if (this.currentTrackSongID === song.songID) return;

        // If the new song is what we cached as the exact next song, swap them in
        if (this.nextTrackSongID === song.songID && this.nextTrackSyncedLyrics) {
            this.currentTrackSongID = this.nextTrackSongID;
            this.currentTrackLyrics = this.nextTrackLyrics;
            this.currentTrackSyncedLyrics = this.nextTrackSyncedLyrics;
            return;
        }

        // Otherwise fetch fresh
        this.currentTrackSongID = song.songID;

        let lyrics = await fetchLyrics(song);

        this.currentTrackLyrics = lyrics.plainLyrics;
        this.currentTrackSyncedLyrics = lyrics.syncedLyrics;
    }

    async cacheNextLyrics(nextSong?: Song) {
        if (!nextSong || this.nextTrackSongID === nextSong.songID || this.currentTrackSongID === nextSong.songID) return;

        this.nextTrackSongID = nextSong.songID;
        let lyrics = await fetchLyrics(nextSong);

        this.nextTrackLyrics = lyrics.plainLyrics;
        this.nextTrackSyncedLyrics = lyrics.syncedLyrics;
    }

    async updateLyricsLine() {
        if (!spotifyPresenter.currentSong || !this.currentTrackSyncedLyrics) {
            this.currentLine = "No Lyrics Found";
            this.nextLine = "";
            document.getElementById('current-lyric-line')!.textContent = this.currentLine;
            document.getElementById('next-lyric-line')!.textContent = this.nextLine;
            return;
        }

        const lines = this.currentTrackSyncedLyrics.split('\n');
        const parsedLines: { time: number; text: string }[] = [];

        for (const line of lines) {
            const match = line.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
            if (match) {
                const text = match[3].trim();
                if (text) {
                    const minutes = parseInt(match[1]);
                    const seconds = parseFloat(match[2]);
                    parsedLines.push({
                        time: minutes * 60 + seconds,
                        text: text
                    });
                }
            }
        }

        // Bluetooth delay in seconds (100ms = 0.1s)
        const BLUETOOTH_DELAY = 0.075;

        const progress = spotifyPresenter.currentSong.progressSeconds + BLUETOOTH_DELAY;

        this.currentIndex = this.getActiveLyricIndex(parsedLines, progress);


        // Lyrics format
        // [0:00] Line contents
        //   [0:10] Next line contents

        if (this.currentIndex == -1) { // checking if lyrics exist, if not return blank line
            this.currentLine = "";
            this.nextLine = parsedLines.length > 0 ? // checking if first line exists, if not return blank line
                `[${formatTime(parsedLines[0].time)}] ${parsedLines[0].text}` : // showing first line of lyrics as next line, if exists
                "";

        } else {
            this.currentLine = `[${formatTime(parsedLines[this.currentIndex].time)}] ${parsedLines[this.currentIndex].text}`;
            this.nextLine = this.currentIndex + 1 < parsedLines.length ? // checking if next line exists, if not return blank line
                `[${formatTime(parsedLines[this.currentIndex + 1].time)}] ${parsedLines[this.currentIndex + 1].text}` :
                "";
        }

        document.getElementById('current-lyric-line')!.textContent = this.currentLine;
        document.getElementById('next-lyric-line')!.textContent = this.nextLine;
    }

    getActiveLyricIndex(parsedLines: { time: number; text: string }[], progress: number): number {
        // Edge case: No lyrics
        if (!parsedLines || parsedLines.length === 0) return -1;

        // Safety check: If the array changes (e.g., song skipped) and is now 
        // shorter than our saved index, reset it to prevent out-of-bounds errors.
        if (this.currentIndex >= parsedLines.length) {
            this.currentIndex = 0;
        }

        // 1. THE O(1) FAST PATH (Normal Playback)
        const isForwardSequential: boolean = progress >= parsedLines[this.currentIndex].time;
        const isBeforeNext: boolean = (this.currentIndex === parsedLines.length - 1) ||
            (progress < parsedLines[this.currentIndex + 1].time);

        if (isForwardSequential && isBeforeNext) {
            return this.currentIndex;
        }

        // 2. THE O(log n) FALLBACK (User seeked/scrubbed)
        let low: number = 0;
        let high: number = parsedLines.length - 1;
        let bestMatch: number = 0;

        while (low <= high) {
            const mid: number = Math.floor((low + high) / 2);

            if (parsedLines[mid].time <= progress) {
                bestMatch = mid; // This is a valid candidate
                low = mid + 1;   // Check if there's a closer one later
            } else {
                high = mid - 1;  // The time is too far ahead, look earlier
            }
        }

        // Update our state and return
        this.currentIndex = bestMatch;
        return this.currentIndex;
    }
}

const lyricsPresenter = new LyricsPresenter();
export default lyricsPresenter;