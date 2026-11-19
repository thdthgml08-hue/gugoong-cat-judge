/* 구공이 3D — 합성 효과음 (Web Audio, 외부 파일 없음) */
export class Sfx {
  constructor() {
    this.enabled = (localStorage.getItem('gg3d-sound') ?? 'on') !== 'off';
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      this._makeNoise();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem('gg3d-sound', on ? 'on' : 'off');
    } catch (e) {
      /* 저장 실패는 무시 */
    }
    if (this.master) this.master.gain.value = on ? 0.5 : 0;
  }

  _makeNoise() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  _tone(o) {
    if (!this.enabled) return;
    const ctx = this.unlock();
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + o.dur);
    const peak = o.gain ?? 0.12;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  _noise(o) {
    if (!this.enabled || !this.noiseBuf) return;
    const ctx = this.unlock();
    if (!ctx) return;
    const t0 = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(80, o.freqEnd), t0 + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain ?? 0.08, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  tap() {
    this._tone({ freq: 720, dur: 0.06, type: 'triangle', gain: 0.05 });
  }

  jump() {
    this._tone({ freq: 260, freqEnd: 620, dur: 0.16, type: 'sine', gain: 0.10 });
    this._noise({ freq: 1800, freqEnd: 600, dur: 0.12, gain: 0.03, q: 0.7 });
  }

  land() {
    this._tone({ freq: 170, freqEnd: 90, dur: 0.11, type: 'sine', gain: 0.09 });
  }

  step() {
    this._noise({ freq: 420, dur: 0.05, gain: 0.014, q: 1.4, filter: 'lowpass' });
  }

  grade() {
    // 뽁 + 딩동
    this._noise({ freq: 1400, freqEnd: 700, dur: 0.09, gain: 0.06, q: 0.8 });
    this._tone({ freq: 1046.5, dur: 0.16, type: 'triangle', gain: 0.13, delay: 0.03 });
    this._tone({ freq: 1568, dur: 0.42, type: 'sine', gain: 0.12, delay: 0.11 });
    this._tone({ freq: 2093, dur: 0.34, type: 'sine', gain: 0.05, delay: 0.13 });
  }

  whoosh() {
    this._noise({ freq: 300, freqEnd: 1600, dur: 0.3, gain: 0.05, q: 0.6 });
  }

  complete() {
    const notes = [783.99, 987.77, 1174.66, 1567.98];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.09, delay: i * 0.13 });
      this._tone({ freq: f * 2, dur: 0.4, type: 'sine', gain: 0.035, delay: i * 0.13 });
    });
  }
}
