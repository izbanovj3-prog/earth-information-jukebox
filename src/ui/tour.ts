// Scripted ~90 s walkthrough for the submission video. Pure data; App runs it.

export type TourAction =
  | { type: 'goto'; track: string; date: string }
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
  { at: 0, action: { type: 'goto', track: 'air-temperature', date: '1980-07-01' } },
  { at: 0, action: { type: 'tempo', value: 5 } },
  { at: 0, action: { type: 'timelapse', on: false } },
  { at: 0.2, action: { type: 'say', text: 'Demo tour. Record one, Fever Pitch: July air temperature in 1980. The scan moves west to east; higher pitch means warmer air.' } },
  { at: 0.4, action: { type: 'play' } },
  { at: 14, action: { type: 'goto', track: 'air-temperature', date: '2024-07-01' } },
  { at: 14.2, action: { type: 'say', text: 'Jump to July 2024. The low drone has risen with the global average, and more bells ring for air above 37 degrees.' } },
  { at: 28, action: { type: 'goto', track: 'sea-ice', date: '2012-09-15' } },
  { at: 28.2, action: { type: 'say', text: 'Record two, Thin Ice: September 2012, the record low for Arctic sea ice. The northern voice is the Arctic.' } },
  { at: 40, action: { type: 'explore', lat: 82, lon: -150 } },
  { at: 40.2, action: { type: 'say', text: 'Explore mode. The cursor is over the Arctic Ocean.' } },
  { at: 44, action: { type: 'explore', lat: 82, lon: 20 } },
  { at: 47, action: { type: 'explore', lat: -66, lon: 0 } },
  { at: 47.2, action: { type: 'say', text: 'And now the Antarctic, near its winter maximum.' } },
  { at: 52, action: { type: 'goto', track: 'vegetation', date: '2024-01-01' } },
  { at: 52, action: { type: 'tempo', value: 9 } },
  { at: 52, action: { type: 'timelapse', on: true } },
  { at: 52.2, action: { type: 'say', text: 'Record four, Green Pulse: one year of plant growth, month by month. Listen to the north bloom in summer.' } },
  { at: 52.4, action: { type: 'play' } },
  { at: 72, action: { type: 'goto', track: 'aerosols', date: '2024-08-01' } },
  { at: 72, action: { type: 'tempo', value: 6 } },
  { at: 72, action: { type: 'timelapse', on: false } },
  { at: 72.2, action: { type: 'say', text: 'Record five, Hazy Skies: August 2024, the haziest month of the year in this data. Bells mark heavy dust or smoke.' } },
  { at: 84, action: { type: 'say', text: 'Every sound you heard was generated live from the pixels on screen. This is the Earth Information Jukebox.' } },
  { at: 90, action: { type: 'timelapse', on: true } },
  { at: 90, action: { type: 'end' } },
];

export const TOUR_SECONDS = TOUR[TOUR.length - 1]!.at;
