import Song from './songModel';

interface Lyrics {
    plainLyrics: string | null;
    syncedLyrics: string | null;
}

interface LrclibEntry {
    id: number;
    trackName: string;
    artistName: string;
    albumName: string;
    duration: number;
    instrumental?: boolean;
    plainLyrics: string | null;
    syncedLyrics: string | null;
}

const EMPTY: Lyrics = { plainLyrics: null, syncedLyrics: null };

/**
 * Spotify localises artist names (e.g. "エド・シーラン" for Ed Sheeran on JP
 * accounts), which breaks LRCLIB's strict `/api/get`. Cascade:
 *   1. /api/get (exact title + artist + album + duration)
 *   2. /api/search (fuzzy, title-only) filtered by duration proximity
 *      and "synced lyrics available"
 */
async function fetchLyrics(song: Song): Promise<Lyrics> {
    if (!song.title || song.title === 'None') {
        console.error('[lyrics] No title');
        return EMPTY;
    }

    // 1) Exact match
    try {
        const url = new URL('https://lrclib.net/api/get');
        url.searchParams.append('track_name', song.title);
        url.searchParams.append('artist_name', song.artist);
        if (song.album && song.album !== 'None') {
            url.searchParams.append('album_name', song.album);
        }
        if (song.durationSeconds > 0) {
            url.searchParams.append('duration', Math.round(song.durationSeconds).toString());
        }
        const res = await fetch(url.toString());
        if (res.ok) {
            const data = await res.json();
            if (data.syncedLyrics || data.plainLyrics) {
                console.log(`[lyrics] exact match for ${song.title}`);
                return { plainLyrics: data.plainLyrics, syncedLyrics: data.syncedLyrics };
            }
        }
    } catch (e) {
        console.warn('[lyrics] /api/get error:', e);
    }

    // 2) Fuzzy search by title, pick best by duration proximity + synced presence.
    try {
        const url = new URL('https://lrclib.net/api/search');
        url.searchParams.append('track_name', song.title);
        // Including artist in search narrows results when it DOES happen to match.
        // LRCLIB is tolerant of partial artist strings, so romaji/original names still hit.
        if (song.artist && song.artist !== 'None') {
            url.searchParams.append('artist_name', song.artist);
        }

        let res = await fetch(url.toString());
        let candidates: LrclibEntry[] = res.ok ? await res.json() : [];

        // If the title+artist search came back empty, retry with title only —
        // this is the path that recovers katakana/localised-artist mismatches.
        if (candidates.length === 0 && song.artist) {
            const titleOnlyUrl = new URL('https://lrclib.net/api/search');
            titleOnlyUrl.searchParams.append('track_name', song.title);
            res = await fetch(titleOnlyUrl.toString());
            candidates = res.ok ? await res.json() : [];
        }

        const best = pickBest(candidates, song);
        if (best) {
            console.log(`[lyrics] search hit: "${best.trackName}" by "${best.artistName}" (Δdur=${Math.abs(best.duration - song.durationSeconds).toFixed(1)}s)`);
            return { plainLyrics: best.plainLyrics, syncedLyrics: best.syncedLyrics };
        }
    } catch (e) {
        console.warn('[lyrics] /api/search error:', e);
    }

    console.log(`[lyrics] no match for ${song.title}`);
    return EMPTY;
}

/**
 * Score candidates and return the best synced-lyrics-bearing one.
 * Accept candidates whose duration is within ±5 s of ours; among them,
 * prefer those with synced lyrics and then the closest duration.
 */
function pickBest(candidates: LrclibEntry[], song: Song): LrclibEntry | null {
    if (!candidates || candidates.length === 0) return null;

    const MAX_DURATION_DRIFT = 5; // seconds
    const scored = candidates
        .filter(c => !c.instrumental)
        .map(c => ({
            entry: c,
            dDur: Math.abs(c.duration - song.durationSeconds),
            hasSynced: !!c.syncedLyrics,
        }))
        .filter(s => s.dDur <= MAX_DURATION_DRIFT);

    if (scored.length === 0) return null;

    // Sort: synced first, then smallest duration drift
    scored.sort((a, b) => {
        if (a.hasSynced !== b.hasSynced) return a.hasSynced ? -1 : 1;
        return a.dDur - b.dDur;
    });
    return scored[0].entry;
}

export { fetchLyrics };
