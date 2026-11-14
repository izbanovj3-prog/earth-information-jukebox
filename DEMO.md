# Demo

- Live site: https://izbanovj3-prog.github.io/earth-information-jukebox/
- Source code: https://github.com/izbanovj3-prog/earth-information-jukebox

## Submission summary (200 words)

Earth Information Jukebox lets you hear NASA's view of the planet. Five Earth Information Center visualizations from NASA's Scientific Visualization Studio (night lights 2012 to 2023, ocean currents, aerosols, lightning seen from the Space Station, fire-season air quality) play as a sampled chamber orchestra, where every colour has its own section, or as a direct scientific synth mapping. Five NASA GIBS records (air temperature since 1980, Arctic sea ice, ocean temperature, plant growth, haze) are read pixel by pixel back into real values through each layer's colour scale. A line sweeps each map from west to east: stereo follows longitude, pitch follows latitude or value, and each frame is one sweep, so you hear change over time. Stop, and the arrow keys let you listen to one place. We designed for blind and low-vision listeners first: full keyboard control, spoken narration, a written description of every frame and a data table under each trend chart. A mixer isolates instruments; a playlist and WAV export let you take the sound with you. Limits: the sound interprets pictures rather than measuring anything, no screen-reader user has tested it yet, and on slow mobile networks the orchestra arrives only after about 40 seconds.

## 30-second cut

For the submission video. Record the live site in Chrome with tab audio; captions are burned in (English, white on a dark band, bottom third). Start Night Lights once before recording so its orchestra is already cached.

| Time | Shot | Action on screen | Caption |
|---|---|---|---|
| 0:00–0:04 | Full page, Night Lights 2012 | Press Play; the amber line starts to sweep | Earth Information Jukebox: hear NASA's view of the planet. |
| 0:04–0:10 | Map close-up | Orchestra plays 2012, then the scrubber jumps to 2023 | Night lights 2012 → 2023. Every colour plays its own section: more light, more harp. |
| 0:10–0:15 | Map + mixer | Lightning, July 2019; the drum lights flicker in the mixer | Lightning seen from the Space Station. Here the drums are the data. |
| 0:15–0:20 | Map + legend | Fever Pitch July 1980, then July 2024 | NASA GIBS air temperature, read back into real values. Higher pitch means warmer air. |
| 0:20–0:25 | Keyboard close-up, then map | Press E, arrow keys over the Arctic; the narration text changes | Built for blind and low-vision listeners: explore the map by ear. |
| 0:25–0:30 | End card over the page | Hold; show the URL | Free, no install: izbanovj3-prog.github.io/earth-information-jukebox. Unofficial prototype for NASA Space Apps Challenge 2026. Not a NASA product. |

## 98-second demo tour (built in)

Open the live site, press **Demo Tour**, and let it play. The timecodes match `src/ui/tour.ts`. The voice-over column is what the app's narration says (turn on a screen reader, or read it aloud over the recording). On a slow connection the first seconds play in Scientific mode until the orchestra arrives.

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

For a longer cut: a keyboard close-up at 1:04 (arrow keys), a mixer close-up (switch the harp off and on), and end on the disclaimer line in the footer.
