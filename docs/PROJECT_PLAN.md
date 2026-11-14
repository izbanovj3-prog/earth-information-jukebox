# Project Plan

**Deadline: Sunday, November 15, 2026, 23:59 local time** (Space Apps Judging & Awards Guide).

## Submission checklist (Space Apps)

- [x] Challenge selected: The Earth Information Jukebox
- [ ] Team registered, all members on the team page, same Local Event (max 6 people)
- [ ] Project page filled in (English): problem, solution, NASA data used
- [x] Working prototype (local server: `npm start`)
- [ ] **Public demo link judges can open without installing anything**: static build + Pages workflow ready (Nov 14); still needs push to `main` + Settings → Pages → Source: GitHub Actions
- [ ] Public GitHub repository pushed (`feat/earth-jukebox-mvp` merged to `main`)
- [ ] **Demo: 30-second video (English subtitles if spoken in another language) OR max 7 slides**
- [ ] **References field: every external resource listed** (NASA SVS pages 5313/5276, 3912, 5552/5669, 5011, 5533, 13786; VSCO 2 CE samples, CC0)
- [ ] Both checkboxes on the submission page (original work + references)

## How we are judged (1–5 each)

| Criterion | What judges look for | Where we stand / what to do |
|---|---|---|
| Impact | real problem, broad reach | accessibility for blind and low-vision users: needs a short "how to listen" guided intro and one sentence of real-user framing |
| Creativity | novel, fresh | colour → orchestra section language, harmony driven by data mood, live video sonification: strong |
| Validity | scientifically sound, feasible, usable | real dates, a *measured* lightning season (10% → 95% → 12% north), trend chart and table. **Weak spot: judges can't run Node locally, so we need a hosted demo.** |
| Relevance | NASA data is core | 5 EIC/SVS datasets, 54 dated frames + 4 live videos. Adding wildfires (Dixie Fire) or CO₂ covers more EIC themes |
| Presentation | story, demo, clarity | 30-second video / 7 slides not done yet. **Equal weight to the other four.** |

Global awards that fit us best: **Art & Technology**, **Best Use of Data** (making space data accessible), **Best Storytelling**, **Most Inspirational**.

## Priorities until the deadline

1. ~~**Hosted demo (GitHub Pages)**~~ built: `bake.html` → `assets/baked/` (7 MB), `npm run build` → `dist/` (38 MB), `.github/workflows/pages.yml`. Baked values match the live analysis exactly. Live video stays a local-server feature (NASA's CORS blocks it on a static host).
2. **30-second demo video**: record the jukebox (Night Lights 2012 → 2023 in Orchestra mode, then live lightning) with sound and English captions. Option: an in-app "Record 30 s clip" button (canvas + audio → WebM).
3. **7 slides** (fallback/companion to the video): problem → idea → colour language → demo → science (dates, validation) → accessibility → impact/next steps.
4. **"How to listen" guided intro** (spoken with the browser's speech synthesis, plays each section once). Big plus for Impact / Most Inspirational.
5. **More data, if time allows**: *Spread of the Dixie Fire 2021* (SVS 4993, every 12 h, Jul 14 – Oct 22): red fire detections → trumpets and drums, yellow fire lines → harp. *DYAMOND CO₂* (SVS 5196, Jan–Mar 2020, globe view) for the greenhouse-gas theme.

## Roles

| Role | Person | Responsibilities |
|---|---|---|
| Lead / PM | | |
| Developer | | |
| Data / Science | | |
| Design / UX | | |
| Presenter | | |

## Ideas & notes

- Lightning small-feature fix (Nov 14): analysis now samples flashes at 2048×1024 (frames) / 1024×512 (live). It detects 98% / 85% of the grid cells that contain flashes, versus 23% before.
