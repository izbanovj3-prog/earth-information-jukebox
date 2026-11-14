<!-- From the team's second prototype (branch feat/earth-jukebox-mvp, docs/STORY.md), Copyright (c) 2026 NASA Space Apps Team; see NOTICE. It describes the five Earth Information Center records (E1-E5). The GIBS records (A1-A5) are described in ../README.md. -->

# How the Earth Jukebox turns pictures into sound

This is the "why" behind every choice in the jukebox: how we read NASA's images, and how we turn what we see into music that stays faithful to the data and is still pleasant to listen to.

## One shared way of listening to a map

Every visualization we use is a flat (equirectangular) world map. That gives all four soundscapes the same simple grammar, so a listener learns it once:

| What you see | What you hear | Why |
|---|---|---|
| **Longitude** (west → east) | **Time**: a playhead sweeps the map in 10 seconds | A map has no built-in time axis, but a sweep is easy to follow. It is how a reader's eye moves too. |
| **Longitude** (again) | **Stereo position**: west on the left, east on the right | The world moves across your head while the sweep advances. |
| **Latitude** (south → north) | **Pitch**: north is higher | "Up is high" is the most widely shared pitch metaphor, also used in NASA's own sonifications (e.g. SVS 13786, Caldwell 73). |
| **How much of something** | **Loudness, brightness and density of notes** | More data means more sound. Empty places are quiet. |
| **Change over time** (frames) | **Successive sweeps**, plus extra voices for what changed | Each frame gets its own sweep, so you hear the planet change from one frame to the next. |

All pitches are quantised to a musical scale (pentatonic, Dorian, major/minor), so even dense data never turns into random noise.

## Computer vision: from frame to grid

Each frame is reduced to a **64 × 32 grid** (about 5.6° per cell). We sample 4 × 4 pixels per cell and keep both the average and the peak, so a single bright city or lightning flash does not vanish in the average.

For each dataset we read the **colour key** the SVS visualizers used and invert it:

- **Night Lights**: luminance of warm-white light on black. The year label is masked out.
- **Ocean (ECCO2)**: hue maps back to temperature (blue 240° = cold → red 0° = warm). Grey land is ignored. **Turbulence** = how much brightness varies inside a cell, because swirling eddies are drawn as dense bright streaks.
- **GEOS Aerosols**: each pixel is classified by hue/saturation into SVS's four aerosol colours: red-orange **black carbon (smoke)**, lavender **dust**, pale blue-white **sea salt**, green **sulfate**.
- **ISS Lightning**: "yellowness" (strong red + green, weak blue) picks the flash dots out of the grey map.

Values are **normalised across all frames of a dataset together** (98.5th percentile), never per frame. That keeps real change audible: 2023 *sounds* brighter than 2012 because it *is* brighter.

## The four soundscapes

### 1. Night Lights 2012 → 2023: "a planet switching on"
- **Plucked notes** (C major pentatonic) for the brightest cells in each longitude strip. More light means more notes per beat, so Europe, the US and East Asia become shimmering arpeggios and the Pacific falls silent.
- **Bells** ring where a place got brighter than in the previous frame, so you literally hear growth (India, the Middle East, Africa).
- **Drone chord**: global brightness opens the filter and adds chord tones. In 2012 it is a bare fifth; by 2023 it is a full, warm major chord. All twelve years are included, so you hear the planet switch on year by year.

### 2. Sea Surface Currents & Temperature: "the breathing ocean"
- **Three pad voices** (D Dorian) follow the northern, tropical and southern ocean bands. Warm water raises the chord and opens the filter; cold polar water sounds low and muffled.
- **Turbulence becomes motion**: eddies add vibrato and detune, and water-droplet plucks appear where currents swirl (Gulf Stream, Kuroshio, Agulhas, Antarctic Circumpolar Current).
- **Land is silence**: continents are heard as rests, so you can hear the Americas and Africa as gaps.

### 3. GEOS Aerosols: "four instruments in one sky"
The visualization already separates four layers by colour, which made it ideal for a **multi-track** treatment:
- **Dust**: low buzzing sawtooth drone (Saharan dust crossing the Atlantic).
- **Smoke / black carbon**: breathy bandpassed noise, like wind through embers (fires in South America and Africa).
- **Sea salt**: soft FM bells, like spray in Southern Ocean storms.
- **Sulfate**: high glassy arpeggio (industrial pollution over Asia, Europe, North America).
- **Harmony as air quality**: when the total aerosol load in a strip is heavy, the chord flips from **major to minor**.

### 4. Lightning from the ISS: "the drum of the tropics"
- Each flash cluster is a **percussive crack with a pitched ping** (A minor pentatonic). Latitude sets the pitch, flash density sets the loudness, and the timing inside each beat is scattered like real storms.
- A **thunder rumble** rises where many flashes happen at once: Central Africa, the Amazon, the Maritime Continent.
- Frames are **sampled live from the SVS video** (seeking into the MP4 through our server), one per month of 2019. You hear the seasons: the cracks climb in pitch as the storm belt moves north in June–August and sink again in winter. The trend chart shows the share of flashes in the Northern Hemisphere month by month.

### 5. Air Quality, fire season 2024: "a map that changes instrument"
This SVS map is cut into vertical strips, and each strip shows a different pollutant with its own colour scale. We read each strip's colour key and let the strip pick the instrument:
- **Carbon monoxide** (yellow → red): a brassy chord. It turns minor when levels are high.
- **PM2.5 smoke** (cream → brown): crackling noise grains, like a fire, plus a low ember breath.
- **Nitrogen oxides** (light → dark green): a pulsing square-wave rhythm (traffic and industry). It doubles in speed where levels are high.
- **Ozone** (grey → violet): high glass bells.

CO and PM2.5 share warm colours, so a column's background decides between them: saturated yellow means a CO strip, pale cream means a PM2.5 strip. As the playhead crosses a strip boundary, you hear the instrument change. The strips slide sideways between frames, so the same place gets "played" by different pollutants over the summer.

## Orchestra mode: one colour language, one orchestra

The Scientific mode above maps every dataset with its own synth rules: precise, but it sounds like sound design. **Orchestra mode** keeps the same data and plays it with a sampled chamber orchestra (VS Chamber Orchestra 2 Community Edition, public domain / CC0), with a steady tempo, harmony and a melody. The rule we follow:

> **The data decides WHO plays, HOW LOUD, WHICH NOTES and WHERE. The music decides HOW: tempo, harmony, rhythm.**

**One colour language for every map.** Each colour family on any NASA map always gets the same section, so a listener learns it once:

| Colour | Section | Why |
|---|---|---|
| red | trumpets (short stabs) | heat, fire, alarm |
| orange / brown | French horns (sustained) | warmth, smoke, earth |
| yellow | harp | light, sparks, flashes |
| green | flute and clarinet | life, vegetation, and also sulfate and NOx in the air maps |
| blue / cyan | string section (cellos and violins) | water, cold |
| violet | violas | atmosphere, dust, ozone |
| white | piano and glockenspiel | ice, salt, the brightest city cores |

The colour key of each SVS visualization decides which family a pixel belongs to. For the ocean, temperature follows the colour bar, so cold water is played by strings and warm equatorial water by horns and trumpets. Night lights are harp; the brightest cores and *new* light are piano and glockenspiel. Aerosols: smoke is horns, dust is violas, sea salt is piano, sulfate is woodwinds.

**Time and tempo.** Each frame is exactly **4 bars of 4/4**. The 64 map columns are 64 sixteenth notes, so longitude becomes rhythm. Each piece has its own tempo and key, chosen for its mood:

| Visualization | Tempo | Key and progression | Mood |
|---|---|---|---|
| Night Lights | 96 BPM | C major, I–V–vi–IV | hopeful, growing |
| Ocean | 76 BPM | D Dorian, i–IV–i–VII | flowing, modal |
| Aerosols | 88 BPM | A major I–vi–IV–V; **turns to A minor i–VI–III–VII when the air is heavily loaded** | the air quality changes the harmony |
| Lightning | 120 BPM | E minor, i–VI–III–VII | dramatic |
| Air Quality | 100 BPM | F minor, i–VI–iv–V; **the iv becomes a diminished chord when smoke is high** | tension |

**Melody, bass and groove.**
- **Melody**: the strongest colour of each frame leads (harp for lights, strings for cold oceans, and so on). Its notes follow the latitude of that colour along the sweep, snap to the chord on strong beats and to the scale elsewhere, and large leaps are smoothed. Where the colour disappears, the melody rests, so silence still means "no data here".
- **Bass**: double bass plays the chord roots on beats 1 and 3, with an approach note into the next chord when the data is busy.
- **Groove**: kick, snare and shaker get denser as the data in the current bar gets busier (normalised across all frames of the dataset). Timpani and triangle mark each new frame; a cymbal swell leads into the next frame. For **lightning the drums *are* the data**: every flash cluster is a snare hit (north) or a timpani hit (south).

**Exploring by ear** uses the orchestra too: the explorer plays the cell's colour on its section's instrument, so you can hear "this spot is violet" (violas) or "this spot is red" (trumpets).

## Live video mode

> In the merged app, live video is **not** part of the static site: NASA SVS lets only one partner site read video pixels in a browser, so it needs the prototype's local Node server (branch `feat/earth-jukebox-mvp`, `npm start`). The static app plays the dated frames.

For four datasets the real SVS animation can play on the stage (Ocean, Aerosols, Air Quality, Lightning). Four times a second the current video picture is analysed, using the same scale as the dated frames, and the composer plays from it. The music follows the animation continuously, which is the "real time" pairing the challenge asks for. The date badge follows the video position, using the same date ranges as the frames, so the listener always knows *when* they are hearing. The video plays at ¼×, ½× or 1× speed, because a sweep across the map takes several seconds.

## Where the dates come from

Every frame carries a real date, derived from what each SVS page publishes:

| Dataset | Published range | How we date frames |
|---|---|---|
| Night Lights | yearly composites 2012–2023 | one frame per year (all 12 years) |
| Ocean (SVS 3912) | "time range 2007-03-25T12:00Z to 2008-03-03T12:00Z", frames 23000–31000 | linear: date = start + (frame − 23000) / 8000 × range; 12 frames ≈ monthly |
| Aerosols (SVS 5552) | Aug 1 – Sep 14, 2024, 2206 frames | linear by frame number; 10 frames ≈ every 5 days |
| Air Quality (SVS 5533) | July–August 2024, 1800 frames | linear by frame number; marked "≈" because the page gives only the months |
| Lightning (SVS 5011) | Mar 2017 – Jul 2023, 10-day roving window, one 100 s video | **measured**: we sampled 32 moments and computed the share of flashes in the Northern Hemisphere. It peaks exactly 7 times, once for each northern summer from 2017 to 2023, so a linear fit gives `video fraction = 0.159 + 0.1253 × years since 25 Jul 2017`. We use it to grab one frame for the middle of each month of 2019. |

The trend chart under the map shows one number per frame (for example, global night-light brightness, or the share of lightning in the north). It has a data table for screen readers.

## Accessibility decisions

> In the merged app these are joined by A's keyboard map, narrator and How-to-Listen sheet; the keys are listed in ../README.md.


- **Everything is reachable by keyboard**, with visible focus and shortcuts (Space, N/P, D, 1–5, E, T). The timeline is a real slider: its value is read out as the frame's date.
- **Mixer**: every visual layer is its own instrument and can be switched off. A listener can isolate dust from smoke, or new light from old light.
- **Live narration** (an ARIA live region) says in words what the sound means right now. For example: "2023, 77°E: very bright, dense lights over India, strongest near 23°N."
- **Explore by ear**: the map is a focusable "explorable map". Arrow keys move a cursor cell by cell and play that place's tone, and the screen reader announces coordinates, region and value. Mouse and touch users can click and drag across the map.
- **Rich text descriptions**: every frame gets generated alt text and a long description computed from the data (e.g. strongest regions, percent change from the previous frame).
- The **sound grammar is the same for every dataset**, so a blind user learns it once.
- Respects `prefers-reduced-motion` and the light/dark colour scheme. Large touch targets.

## Musicality vs. faithfulness

Raw pixel-to-sound mapping is noisy. We added these artistic constraints and kept everything else data-driven:
1. Pitches snap to a scale chosen for the mood of the data (bright and hopeful pentatonic for lights, modal Dorian for the ocean, minor pentatonic for storms).
2. The number of simultaneous notes per beat is capped.
3. A master compressor, low-pass and reverb glue the voices together.
4. Randomness (note timing jitter) is **seeded per step**, so the music is the same every time and the WAV files match the live jukebox exactly.
