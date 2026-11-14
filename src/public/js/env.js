// Where the jukebox runs.
//  - Local server (`npm start`): frames come live from NASA SVS through /api/frame, live video works.
//  - Static site (GitHub Pages, built by tools/build-static.js): the build marks <html data-static="1">
//    and frames + their analysed features come pre-baked from ./baked/ (made by bake.html).
export const STATIC = document.documentElement.dataset.static === '1';
