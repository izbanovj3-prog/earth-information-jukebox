# Demo

## 100-second video script

Record the screen and the browser audio while the built-in demo tour runs: open the app, press **Demo Tour**, and let it play. The timecodes below match `src/ui/tour.ts`. The voice-over column is what the app's narration says (turn on a screen reader, or read it aloud over the recording). The orchestra for Night Lights downloads when the tour starts; on a slow connection the first seconds play in Scientific mode until it arrives, so record on a good connection or play Night Lights once before recording.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00 | Night Lights (NASA SVS 5313), 2012. The amber line sweeps the dark map; the orchestra plays. | "Demo tour. Earth Information Center record one: night lights from NASA's Scientific Visualization Studio, 2012. Each colour plays its own section of an orchestra; city lights are the harp, and north is higher in pitch." |
| 0:12 | The same record jumps to 2023; the trend chart's marker moves to the end. | "Jump to 2023. More harp notes, and glockenspiel where light is new: the planet sounds brighter because it is brighter." |
| 0:22 | Lightning seen from the ISS, July 2019. | "Lightning seen from the Space Station, July 2019. Here the drums are the data: every flash cluster is a hit, and the storm belt has moved north for the summer." |
| 0:34 | Fever Pitch (NASA GIBS), July 1980. | "Now the NASA GIBS data records, read back into real values. Fever Pitch: July air temperature in 1980. Higher pitch means warmer air." |
| 0:46 | Fever Pitch, July 2024. | "July 2024. The low drone has risen with the global average, and more bells ring for air above 37 degrees." |
| 0:56 | Thin Ice, 15 September 2012. | "Thin Ice: September 2012, the record low for Arctic sea ice. The northern voice is the Arctic." |
| 1:04 | Explore mode. The crosshair jumps to 82°N 150°W, then 82°N 20°E. | "Explore mode. The cursor is over the Arctic Ocean." |
| 1:10 | The crosshair moves to the Antarctic sea ice edge. | "And now the Antarctic, near its winter maximum." |
| 1:14 | Green Pulse, January 2024, played fast; the date advances month by month. | "Green Pulse: one year of plant growth, month by month. Listen to the north bloom in summer." |
| 1:30 | Hold on the full page. | "Every sound you heard was made from the pictures on screen, live in your browser. This is the Earth Information Jukebox." |
| 1:38 | The tour stops. | |

For the cut: show a keyboard close-up for two seconds at 1:04 (arrow keys), a mixer close-up (switch the harp off and on) if you have time, and end on the "Unofficial prototype" line under the title.

## Submission summary (200 words)

Earth Information Jukebox lets you hear NASA's view of the planet. Five Earth Information Center visualizations from NASA's Scientific Visualization Studio (night lights 2012 to 2023, ocean currents, aerosols, lightning from the Space Station, fire-season air quality) play as a sampled chamber orchestra, where every colour on the map has its own section, or as a direct scientific synth mapping. Five NASA GIBS data records (air temperature since 1980, Arctic sea ice, ocean temperature, plant growth, haze) are read pixel by pixel back into real values through each layer's colour scale. Press Play and a line sweeps the map from west to east: stereo follows longitude, pitch follows latitude or value, and change over time becomes a sequence of sweeps. Stop and the arrow keys let you listen to one place. We built it for blind and low-vision listeners first: everything works by keyboard, a screen reader narrates what you hear, every frame has a written description, and a trend chart has a data table. A mixer isolates each instrument, a curated playlist and WAV export let you take the sound with you, and the site runs statically with no keys. It interprets pictures; for measurements, use the source data.
