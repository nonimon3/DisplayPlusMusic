
function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    // Zero-pad minutes too, so the string is always 5 chars wide.
    // Without this the bar to the right shifts when minutes go 1→2 digits.
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export { formatTime }