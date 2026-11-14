// Minimal fake of the Web Audio API surface used by AudioEngine.
/* eslint-disable @typescript-eslint/no-explicit-any */

export class FakeParam {
  value = 0;
  events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number) {
    this.events.push(['set', v, t]);
    this.value = v;
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push(['lin', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (v <= 0) throw new RangeError('exponential ramp target must be > 0');
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number, _tau: number) {
    this.events.push(['target', v, t]);
    this.value = v;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  connections: unknown[] = [];
  connect(n: unknown) {
    this.connections.push(n);
    return n;
  }
  disconnect() {
    this.connections = [];
  }
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination = new FakeNode();
  oscillators: any[] = [];
  resumes = 0;
  suspends = 0;
  async resume() {
    this.resumes++;
    this.state = 'running';
  }
  async suspend() {
    this.suspends++;
    this.state = 'suspended';
  }
  async close() {
    this.state = 'closed';
  }
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createStereoPanner() {
    return Object.assign(new FakeNode(), { pan: new FakeParam() });
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    });
  }
  createConvolver() {
    return Object.assign(new FakeNode(), { buffer: null as unknown });
  }
  createOscillator() {
    const o = Object.assign(new FakeNode(), {
      type: 'sine',
      frequency: new FakeParam(),
      detune: new FakeParam(),
      startedAt: -1,
      stoppedAt: -1,
      onended: null as null | (() => void),
      start(t = 0) {
        o.startedAt = t;
      },
      stop(t = 0) {
        o.stoppedAt = t;
      },
    });
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const s = Object.assign(new FakeNode(), {
      buffer: null as unknown,
      onended: null as null | (() => void),
      start() {},
      stop() {},
    });
    return s;
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, getChannelData: (c: number) => data[c]! };
  }
}

export function fakeFactory(): { ctx: FakeContext; factory: () => AudioContext; created: () => number } {
  const ctx = new FakeContext();
  let created = 0;
  return {
    ctx,
    factory: () => {
      created++;
      return ctx as unknown as AudioContext;
    },
    created: () => created,
  };
}

/** Manual timers for scheduler tests. */
export function manualTimers() {
  let fn: (() => void) | null = null;
  let cleared = 0;
  return {
    timers: {
      setInterval: (f: () => void) => {
        fn = f;
        return 1;
      },
      clearInterval: () => {
        fn = null;
        cleared++;
      },
    },
    fire: () => fn?.(),
    active: () => fn !== null,
    cleared: () => cleared,
  };
}
