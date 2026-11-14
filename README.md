# Earth Information Jukebox

> Hear the planet change: an interactive jukebox that pairs NASA Earth Information Center visualizations with real-time sonifications — so Earth science can be seen *and* heard.

Project for the [NASA International Space Apps Challenge](https://www.spaceappschallenge.org/).

## Challenge

- **Challenge title:** Earth Information Jukebox
- **Challenge link:** [The Earth Information Jukebox (2026)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
- **Full challenge text:** [`docs/CHALLENGE.md`](docs/CHALLENGE.md)
- **Team name:** _TODO_
- **Location / Virtual:** _TODO_

## Problem

NASA's Earth Information Center (EIC) visualizations show how our planet is changing, but they are almost purely visual. That excludes blind and low-vision users and limits how the public can explore complex Earth science. Sonification — turning data into non-speech sound — can make it accessible, multi-sensory and emotionally engaging.

## Our Solution

_Draft plan — update as the idea is finalized._

An **Earth Jukebox**: the user picks an EIC visualization, and we extract its frames, analyze them (color, brightness, shapes, pixel density) and generate a soundscape that evolves with the animation.

- **Frame analysis:** extract frames from each EIC visualization; compute color/brightness/density features per frame and per region.
- **Musical mapping:** map features to pitch, rhythm, tempo, volume and instrumentation using musical scales and harmonies, so the output is pleasant rather than noise.
- **Playback:** audio is synthesized in real time and synced to the visual.
- **Accessibility first:** keyboard and screen-reader support, rich text descriptions of each visualization and what the sound represents.
- **Story:** documentation of why each mapping was chosen (e.g. warming = rising pitch).

## NASA Data & Resources Used

| Dataset / API | Source | How we use it |
|---|---|---|
| NASA Earth Information Center visualizations | https://earth.gov/ _(verify against the Resources tab)_ | Source frames for sonification |
| _Resources tab of the challenge page_ | _link_ | _TODO_ |

## Tech Stack

_Proposed — not final:_

- Web app (TypeScript) so it runs in any browser, no install
- Web Audio API / Tone.js for real-time synthesis
- Canvas for frame analysis; ffmpeg/Python (OpenCV, NumPy) for offline frame extraction
- Static hosting (GitHub Pages / Vercel)

## Getting Started

```bash
git clone <repo-url>
cd nasa-space-apps
# install dependencies and run — TODO
```

## Repository Structure

```
src/          application source code
data/raw/     original datasets (not committed if large)
data/processed/  cleaned / derived data
notebooks/    exploration and analysis notebooks
docs/         presentation, notes, architecture
assets/       images, logos, demo media
```

## Demo

- Live demo: _TODO_
- Video: _TODO_
- Presentation: see [`docs/`](docs/)

## Team

| Name | Role | Contact |
|---|---|---|
| _TODO_ | _TODO_ | _TODO_ |

## Acknowledgements

Built with open data and resources provided by NASA and its partner space agencies.

## License

[MIT](LICENSE)
