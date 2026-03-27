import {
    waitForEvenAppBridge,
    CreateStartUpPageContainer,
    TextContainerProperty,
    ImageContainerProperty,
    ImageRawDataUpdate,
    RebuildPageContainer,
    TextContainerUpgrade,
    ListContainerProperty,
    ListItemContainerProperty,

} from '@evenrealities/even_hub_sdk';

import { formatTime } from '../Scripts/formatTime';
import Song from '../model/songModel';
import lyricsPresenter from '../presenter/lyricsPresenter';

// State management variables
let isPageCreated = false;
let isUpdating = false;
let lastSongID: string = "";
let lastConfig: string = "";
let MAX_HEIGHT = 288;
let MAX_WIDTH = 576

async function createView(songIn: Song) {
    // Basic concurrency guard
    if (isUpdating) {
        // console.log("Skipping update - previous update still in progress");
        return;
    }

    isUpdating = true;

    try {
        const bridge = await waitForEvenAppBridge();

        const albumArtContainer = new ImageContainerProperty({
            xPosition: 0,
            yPosition: 0,
            width: 100,
            height: 100,
            containerID: 0,
            containerName: 'album-art',
        });

        const buttons = new ListContainerProperty({
            xPosition: 154,
            yPosition: 0,
            width: 80,
            height: 132,
            borderWidth: 0,
            borderRadius: 0,
            containerID: 2,
            containerName: 'buttons',
            isEventCapture: 1,
            itemContainer: new ListItemContainerProperty({
                itemCount: 3,
                itemName: ["◁◁", " ▷ll", "▷▷"],
                isItemSelectBorderEn: 1
            })
        })


        const songInfoText = songIn.title + "\n" + songIn.artist + "\n" + songIn.album;
        const songInfo = new TextContainerProperty({
            xPosition: 234,
            yPosition: 8,
            width: MAX_WIDTH - (242),
            height: 132,
            borderRadius: 12,
            borderWidth: 1,
            paddingLength: 16,
            containerID: 3,
            containerName: 'songInfo',
            content: songInfoText,
            isEventCapture: 0,
        });


        const playbackBarText = "    " + formatTime(songIn.progressSeconds) + " / " + formatTime(songIn.durationSeconds) + "\n" + songIn.createPlaybackBar(MAX_WIDTH) + "\n  " + lyricsPresenter.currentLine + "\n    " + lyricsPresenter.nextLine;
        // const playbackBarText = "[".repeat(82);
        const playbackBar = new TextContainerProperty({
            xPosition: 0,
            yPosition: 150,
            width: MAX_WIDTH,
            height: MAX_HEIGHT - 150,
            borderRadius: 6,
            borderWidth: 0,
            containerID: 4,
            containerName: 'playbackBar',
            content: playbackBarText,
            isEventCapture: 0,
        })

        const containerConfig = {
            containerTotalNum: 4,
            textObject: [songInfo, playbackBar],
            listObject: [buttons],
            imageObject: [albumArtContainer],
        };

        // If page is not created, try to create it.
        if (!isPageCreated) {
            const container = new CreateStartUpPageContainer(containerConfig);
            const result = await bridge.createStartUpPageContainer(container);
            console.log('createStartUpPageContainer result:', result);

            if (result === 0) {
                console.log('Container created successfully');
                isPageCreated = true;
                const layoutConfig = {
                    ...containerConfig,
                    textObject: containerConfig.textObject?.map((t: any) => ({ ...t, content: '' }))
                };
                lastConfig = JSON.stringify(layoutConfig);
            } else if (result === 1) {
                // Result 1 (invalid) likely means container already exists.
                // Mark as created so we proceed to rebuild next.
                console.log('Container creation returned invalid (1), assuming already exists. Switching to rebuild mode.');
                isPageCreated = true;
            } else {
                console.error('Failed to create container:', result);
                return; // Exit if a critical error occurred (oversize, out of memory, etc.)
            }
        }

        // If page is created (or existed), rebuild/update it.
        if (isPageCreated) {
            // Create a layout-only config for comparison (exclude dynamic content)
            const layoutConfig = {
                ...containerConfig,
                textObject: containerConfig.textObject?.map((t: any) => ({ ...t, content: '' }))
            };
            const currentLayoutStr = JSON.stringify(layoutConfig);

            if (currentLayoutStr !== lastConfig) {
                // Config changed, rebuild
                console.log("Layout config changed, rebuilding page container...");
                const rebuildContainer = new RebuildPageContainer(containerConfig);
                const rebuildResult = await bridge.rebuildPageContainer(rebuildContainer);
                console.log('rebuildPageContainer result:', rebuildResult);

                // Add a small delay so the glasses have time to clear the screen 
                // and parse the new container before we bombard them with the image
                await new Promise(r => setTimeout(r, 300));

                lastConfig = currentLayoutStr;
                lastSongID = ""; // Force image resend after rebuild
            } else {
                // If config hasn't changed, try to just upgrade the text content
                // This avoids clearing the screen/image
                try {
                    const upgrade = new TextContainerUpgrade({
                        containerID: 3,
                        containerName: 'songInfo',
                        content: songInfoText,
                    });
                    await bridge.textContainerUpgrade(upgrade);

                    const upgrade2 = new TextContainerUpgrade({
                        containerID: 4,
                        containerName: 'playbackBar',
                        content: playbackBarText,
                    })
                    await bridge.textContainerUpgrade(upgrade2);
                } catch (e) {
                    console.error("Failed to upgrade text container:", e);
                }
            }

            //console.log(`Album art check - current length: ${songIn.albumArtRaw?.length}, songID: ${songIn.songID}, lastSongID: ${lastSongID}`);
            if (songIn.albumArtRaw && songIn.albumArtRaw.length > 0 && songIn.songID !== lastSongID) {
                try {
                    const imageUpdate = new ImageRawDataUpdate({
                        containerID: 0,
                        containerName: 'album-art',
                        imageData: songIn.albumArtRaw,
                    })
                    console.log(`Image update: size=${songIn.albumArtRaw.length} bytes, type=${songIn.albumArtRaw.constructor.name}, first4=[${songIn.albumArtRaw.slice(0, 4).join(',')}]`);
                    const result = await bridge.updateImageRawData(imageUpdate);
                    console.log("Image data update result:", result, typeof result);
                    lastSongID = songIn.songID;
                } catch (e) {
                    console.error("Failed to update image data:", e);
                }
            } else if (songIn.songID !== lastSongID) {
                console.log(`Skipped image update due to missing or empty raw data for songID ${songIn.songID}`);
            }
        }
    } catch (e) {
        console.error("Error in createView:", e);
    } finally {
        isUpdating = false;
    }
}

export { createView };