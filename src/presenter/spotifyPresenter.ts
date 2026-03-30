import spotifyModel, { initSpotify } from '../model/spotifyModel';
import Song from '../model/songModel';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';

class SpotifyPresenter {
    public currentSong?: Song;
    public nextSong?: Song;

    async pollSingle() {
        try {
            this.currentSong = await this.fetchCurrentSong();
            this.nextSong = await spotifyModel.fetchNextTrack();
        } catch (error) {
            console.error("Error fetching song:", error);
        }
    }

    async fetchCurrentSong(): Promise<Song> {
        let temp = await spotifyModel.fetchCurrentTrack();
        return temp
    }

    async startAuth(tokenIn: string) {
        const bridge = await waitForEvenAppBridge();

        bridge.setLocalStorage('spotify_refresh_token', tokenIn);

        initSpotify();
    }

    song_pauseplay() {
        if (this.currentSong!.isPlaying) {
            spotifyModel.song_Pause();
        } else {
            spotifyModel.song_Play();
        }
    }
    song_back() {
        spotifyModel.song_Back();
    }
    song_forward() {
        spotifyModel.song_Forward();
    }
}

const spotifyPresenter = new SpotifyPresenter();

export default spotifyPresenter;
