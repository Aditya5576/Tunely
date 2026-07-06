export const decodeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'");
};

export const parseLyrics = (lyricsText, songDuration) => {
  if (!lyricsText) return [];
  const lines = lyricsText.split('\n');
  const timedLyrics = [];
  
  // Check if it is LRC format [mm:ss.xx]
  const lrcRegex = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/;
  let hasTimestamps = false;
  
  for (const line of lines) {
    const cleanLine = line.trim();
    const match = cleanLine.match(lrcRegex);
    if (match) {
      hasTimestamps = true;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3], 10) / (match[3].length === 2 ? 100 : 1000) : 0;
      const time = min * 60 + sec + ms;
      const text = match[4].trim();
      timedLyrics.push({ time, text });
    }
  }
  
  if (hasTimestamps) {
    return timedLyrics.sort((a, b) => a.time - b.time);
  }
  
  // If no timestamps, estimate timeline based on character counts
  const cleanLines = lines.map(l => l.trim()).filter(l => l !== '');
  if (cleanLines.length === 0) return [];
  
  const totalChars = cleanLines.reduce((sum, line) => sum + line.length, 0);
  let accumulatedTime = 0;
  
  // Buffer 5% of song duration for intro and 10% for outro
  const usableDuration = songDuration ? songDuration * 0.85 : 180;
  const offset = songDuration ? songDuration * 0.05 : 5;
  
  return cleanLines.map((text) => {
    const weight = text.length;
    const duration = (weight / totalChars) * usableDuration;
    const time = offset + accumulatedTime;
    accumulatedTime += duration;
    return { time, text };
  });
};
