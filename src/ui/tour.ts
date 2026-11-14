// Scripted ~100 s walkthrough for the submission video. Pure data; App runs it.
// It opens on the Earth Information Center records (NASA SVS, orchestra), then the GIBS data records.

export type TourAction =
  /** A NASA GIBS record and date. */
  | { type: 'goto'; track: string; date: string }
  /** An Earth Information Center record and frame date (YYYY-MM-DD). */
  | { type: 'eic'; record: string; date: string }
  /** Play the record on screen (either collection). */
  | { type: 'play' }
  | { type: 'explore'; lat: number; lon: number }
  | { type: 'tempo'; value: number }
  /** Hold a date (false) or advance through time after each sweep (true). */
  | { type: 'timelapse'; on: boolean }
  | { type: 'say'; text: string }
  | { type: 'end' };

export interface TourStep {
  /** Seconds from the start of the tour. */
  at: number;
  action: TourAction;
}

export const TOUR: TourStep[] = [
  { at: 0, action: { type: 'eic', record: 'nightlights', date: '2012-07-01' } },
  { at: 0, action: { type: 'play' } },
  { at: 0.2, action: { type: 'say', text: "Demo tour. Earth Information Center record one: night lights from NASA's Scientific Visualization Studio, 2012. Each colour plays its own section of an orchestra; city lights are the harp, and north is higher in pitch." } },
  { at: 12, action: { type: 'eic', record: 'nightlights', date: '2023-07-01' } },
  { at: 12.2, action: { type: 'say', text: 'Jump to 2023. More harp notes, and glockenspiel where light is new: the planet sounds brighter because it is brighter.' } },
  { at: 22, action: { type: 'eic', record: 'lightning', date: '2019-07-15' } },
  { at: 22.2, action: { type: 'say', text: 'Lightning seen from the Space Station, July 2019. Here the drums are the data: every flash cluster is a hit, and the storm belt has moved north for the summer.' } },
  { at: 34, action: { type: 'goto', track: 'air-temperature', date: '1980-07-01' } },
  { at: 34, action: { type: 'tempo', value: 5 } },
  { at: 34, action: { type: 'timelapse', on: false } },
  { at: 34.1, action: { type: 'play' } },
  { at: 34.2, action: { type: 'say', text: 'Now the NASA GIBS data records, read back into real values. Fever Pitch: July air temperature in 1980. Higher pitch means warmer air.' } },
  { at: 46, action: { type: 'goto', track: 'air-temperature', date: '2024-07-01' } },
  { at: 46.2, action: { type: 'say', text: 'July 2024. The low drone has risen with the global average, and more bells ring for air above 37 degrees.' } },
  { at: 56, action: { type: 'goto', track: 'sea-ice', date: '2012-09-15' } },
  { at: 56.2, action: { type: 'say', text: 'Thin Ice: September 2012, the record low for Arctic sea ice. The northern voice is the Arctic.' } },
  { at: 64, action: { type: 'explore', lat: 82, lon: -150 } },
  { at: 64.2, action: { type: 'say', text: 'Explore mode. The cursor is over the Arctic Ocean.' } },
  { at: 67, action: { type: 'explore', lat: 82, lon: 20 } },
  { at: 70, action: { type: 'explore', lat: -66, lon: 0 } },
  { at: 70.2, action: { type: 'say', text: 'And now the Antarctic, near its winter maximum.' } },
  { at: 74, action: { type: 'goto', track: 'vegetation', date: '2024-01-01' } },
  { at: 74, action: { type: 'tempo', value: 9 } },
  { at: 74, action: { type: 'timelapse', on: true } },
  { at: 74.2, action: { type: 'say', text: 'Green Pulse: one year of plant growth, month by month. Listen to the north bloom in summer.' } },
  { at: 74.4, action: { type: 'play' } },
  { at: 90, action: { type: 'say', text: 'Every sound you heard was made from the pictures on screen, live in your browser. This is the Earth Information Jukebox.' } },
  { at: 98, action: { type: 'timelapse', on: true } },
  { at: 98, action: { type: 'end' } },
];

export const TOUR_SECONDS = TOUR[TOUR.length - 1]!.at;
