# Demo

## 90-second video script

Record the screen and the browser audio while the built-in demo tour runs: open the app, press **Demo Tour**, and let it play. The timecodes below match `src/ui/tour.ts`. The voice-over column is what the app's narration says (turn on a screen reader, or read it aloud over the recording).

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | Fever Pitch, July 1980. The amber scan line sweeps the map from left to right. | "Record one, Fever Pitch: July air temperature in 1980. The scan moves west to east; higher pitch means warmer air." |
| 0:14 | The same record jumps to July 2024. | "Jump to July 2024. The low drone has risen with the global average, and more bells ring for air above 37 degrees." |
| 0:28 | Thin Ice, 15 September 2012. Ice shows only at the top and bottom edges of the map. | "Record two, Thin Ice: September 2012, the record low for Arctic sea ice. The northern voice is the Arctic." |
| 0:40 | Explore mode. A crosshair jumps to 82°N 150°W, then 82°N 20°E. | "Explore mode. The cursor is over the Arctic Ocean." |
| 0:47 | The crosshair moves to the Antarctic sea ice edge. | "And now the Antarctic, near its winter maximum." |
| 0:52 | Green Pulse, January 2024, played fast. The date advances month by month. | "Record four, Green Pulse: one year of plant growth, month by month. Listen to the north bloom in summer." |
| 1:12 | Hazy Skies, August 2024. | "Record five, Hazy Skies: August 2024, the haziest month of the year in this data. Bells mark heavy dust or smoke." |
| 1:24 | Hold on the full page. | "Every sound you heard was generated live from the pixels on screen. This is the Earth Information Jukebox." |
| 1:30 | The tour stops. | |

For the cut: show a keyboard close-up for two seconds at 0:40 (arrow keys), and end on the "Unofficial prototype" line under the title.

## Submission summary (200 words)

Earth Information Jukebox lets you hear NASA's view of the planet. Choose one of five records: July air temperature since 1980, September sea ice, August ocean temperature, a year of plant growth, and a year of dust and smoke. Press Play and a scan line sweeps a NASA GIBS satellite map from west to east. The app reads each pixel's colour back into its value through the layer's own colour scale and plays it live in your browser. Pitch follows the value. Stereo follows longitude. Three voices carry the north, the tropics and the south, silence marks missing data, a bell marks extremes, and a low drone tracks the global average against the first year. Stop the scan and the arrow keys move a cursor so you can listen to a single place. We designed it for blind and low-vision listeners: every control works by keyboard, a screen reader narrates what you hear, and each frame comes with a written summary. The app runs as a static site with no keys, falls back to bundled NASA images offline, and lists its limits on screen. It interprets images, so use it to explore and turn to the source datasets for measurements.
