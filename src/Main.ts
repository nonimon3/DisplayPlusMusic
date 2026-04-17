import { initSpotify } from './model/spotifyModel';
import spotifyPresenter from './presenter/spotifyPresenter';
import { eventHandler } from './presenter/eventPresenter';
import { enableMobileConsole } from './Scripts/debugConsole';
import { fetchLyrics } from './model/lyricsModel';
import pollingPresenter from './presenter/pollingPresenter';
import viewPresenter from './presenter/viewPresenter';
import { dbg } from './Scripts/debugBanner';

async function main() {
    // enableMobileConsole();
    console.log("App starting...");
    dbg("App starting. URL=" + window.location.href);
    dbg("flutter_inappwebview present: " + (typeof (window as any).flutter_inappwebview !== "undefined"));

    viewPresenter.initListeners();

    await initSpotify();

    pollingPresenter.startPolling();
    eventHandler();

    const currentSong = await spotifyPresenter.fetchCurrentSong();
    await fetchLyrics(currentSong);
}

main();