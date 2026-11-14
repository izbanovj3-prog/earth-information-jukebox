# Challenge: The Earth Information Jukebox

NASA International Space Apps Challenge 2026
Official page: https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/

## Summary

NASA's Earth Information Center (EIC) produces striking visualizations of our changing planet, but presenting Earth science through visualization alone limits who can reach it. Make this science accessible, engaging and multi-sensory by **translating sight into sound**: build an "Earth Jukebox" — an interface, script or application that pairs EIC visual frames with dynamic sonifications generated in real time.

## Background

- EIC visualizations (global temperatures, ocean currents, ...) are presented almost entirely visually, which excludes blind and low-vision users and limits public interaction with Earth science.
- Sonification (data -> non-speech sound) can bridge that gap, reveal patterns the eye misses, and build an emotional connection to the planet.
- Interactive, exploratory translation from sight to sound, blending science and artistic expression, is encouraged.
- Example approaches: computer vision mapping color spectrum -> musical chords; pixel density -> rhythm; artistic rulesets driving synth parameters from visual shapes. Own creative alternatives are encouraged.

## Objectives

- Create an "Earth Jukebox" that generates dynamic sonifications from EIC visual frames.
- Users can **select or experience a specific EIC visualization together with its soundscape**.
- Deliverable may be: an interactive tool that translates visuals to sound, **or** a curated collection of original generated audio files telling the auditory story of the data.
- Methods are open: computer vision (color palettes, shapes, pixel density) -> pitch, tempo, instrumentation; ML; open-source audio synthesis; custom data-driven artistic rulesets.
- Aim for a balance between data interpretation and musically pleasing output.
- Possible forms: interactive web jukebox, desktop app, backend API endpoint, or a playlist of generated audio with an explanation of the creative process.

## Potential considerations (optional)

**Concepts**
- Sonification: non-speech audio that conveys information.
- Visual frames: many EIC visualizations are animations; extract individual frames as the basis for audio generation.

**Jukebox experience**
- UI/UX: how intuitively can someone pick a visualization and start the audio?
- **Accessibility is a core theme**: screen-reader support, tactile feedback, rich descriptive text with the audio.

**Data translation**
- Map color spectrum, brightness, shapes, spatial pixel density -> pitch, rhythm, tempo, volume, instrumentation.
- Raw pixel-to-sound can be chaotic noise; use musical scales, harmonies and artistic rules to make it pleasant.
- Disciplines: custom CV, ML models, synthesizers, DAWs.

**Telling the story**
- Document the "why" behind artistic choices and the algorithms/scripts used.
- Reflect the urgency of climate change or the beauty of interconnected Earth systems.

## Resources

See the **Resources** tab on the official challenge page. The data, fonts and libraries this project actually uses are listed in [`../ATTRIBUTION.md`](../ATTRIBUTION.md); the NASA GIBS layers we chose and why are in [`../README.md`](../README.md#the-five-records) and [`../CONTEXT.md`](../CONTEXT.md).
