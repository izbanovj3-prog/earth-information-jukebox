// Look-ahead scheduler ("A Tale of Two Clocks"): a coarse JS timer schedules events slightly ahead
// on the precise AudioContext clock.

export interface Timers {
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

const realTimers: Timers = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>),
};

export interface SchedulerOptions {
  /** Audio clock in seconds (AudioContext.currentTime). */
  clock: () => number;
  /** Seconds between steps (read every step, so tempo changes apply immediately). */
  stepDuration: () => number;
  onStep: (step: number, time: number) => void;
  lookahead?: number; // seconds, default 0.1
  intervalMs?: number; // default 25
  timers?: Timers;
}

export class LookaheadScheduler {
  private timer: unknown = null;
  private nextTime = 0;
  private step = 0;
  private readonly lookahead: number;
  private readonly intervalMs: number;
  private readonly timers: Timers;

  constructor(private readonly opts: SchedulerOptions) {
    this.lookahead = opts.lookahead ?? 0.1;
    this.intervalMs = opts.intervalMs ?? 25;
    this.timers = opts.timers ?? realTimers;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  get currentStep(): number {
    return this.step;
  }

  start(fromStep = this.step): void {
    this.stop();
    this.step = fromStep;
    this.nextTime = this.opts.clock() + 0.05;
    this.timer = this.timers.setInterval(() => this.tick(), this.intervalMs);
    this.tick();
  }

  stop(): void {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
  }

  /** Schedule every step that falls inside the look-ahead window. */
  tick(): void {
    const now = this.opts.clock();
    // If the timer was throttled (background tab, slow device), skip ahead instead of bursting notes.
    if (this.nextTime < now - 0.2) this.nextTime = now + 0.05;
    let guard = 0;
    while (this.nextTime < now + this.lookahead && guard++ < 64) {
      this.opts.onStep(this.step, this.nextTime);
      this.step++;
      this.nextTime += Math.max(0.02, this.opts.stepDuration());
    }
  }
}
