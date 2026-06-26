'use strict';

/*
 * Sounds are synthesised in the browser with the Web Audio API, so the app
 * ships no audio files and works fully offline. Two voices are provided:
 *   - "bell"  : a clear school bell, repeated — for lessons / breaks.
 *   - "adhan" : a gentle rising-and-falling call tone — for Salah times.
 */

const MClockAudio = (() => {
  let ctx = null;
  let activeTimers = [];

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Call this from a user gesture (e.g. an "Enable sound" click) so browsers
  // allow audio to play later when an alert arrives.
  function unlock() {
    const c = ensureCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.02);
  }

  function tone(freq, start, dur, gainVal, type = 'sine') {
    const c = ensureCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    const t0 = c.currentTime + start;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gainVal, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function bellHit(start) {
    // A bright metallic strike: fundamental + inharmonic partials.
    tone(880, start, 1.4, 0.5, 'sine');
    tone(1320, start, 1.1, 0.25, 'sine');
    tone(1760, start, 0.8, 0.15, 'triangle');
    tone(2640, start, 0.5, 0.08, 'sine');
  }

  function chimePhrase(start) {
    // A soft, gentle two-tone reminder chime for a Naseehah (advice/reminder).
    const notes = [
      [523.25, 0.0, 1.1], // C5
      [659.25, 0.45, 1.4], // E5
      [783.99, 0.9, 1.8], // G5
    ];
    for (const [f, t, d] of notes) {
      tone(f, start + t, d, 0.22, 'sine');
      tone(f * 2, start + t, d * 0.5, 0.04, 'sine');
    }
  }

  function adhanPhrase(start) {
    // A slow rising-then-falling melodic line, vocal-like and calm.
    const notes = [
      [294, 0.0, 0.55],
      [330, 0.5, 0.55],
      [392, 1.0, 0.7],
      [440, 1.7, 0.9],
      [392, 2.6, 0.7],
      [330, 3.3, 0.9],
      [294, 4.2, 1.2],
    ];
    for (const [f, t, d] of notes) {
      tone(f, start + t, d, 0.32, 'sine');
      tone(f * 2, start + t, d * 0.7, 0.06, 'sine'); // soft overtone
    }
  }

  // Plays the chosen sound on a loop until stop() is called or `seconds` pass.
  function play(kind, seconds = 30) {
    stop();
    ensureCtx();
    const period = kind === 'adhan' ? 6 : kind === 'chime' ? 4 : 2.2; // seconds between repeats
    const endAt = Date.now() + seconds * 1000;

    const fireOne = () => {
      if (Date.now() >= endAt) {
        stop();
        return;
      }
      if (kind === 'adhan') adhanPhrase(0);
      else if (kind === 'chime') chimePhrase(0);
      else bellHit(0);
    };

    fireOne();
    const id = setInterval(fireOne, period * 1000);
    activeTimers.push(id);
  }

  function stop() {
    activeTimers.forEach(clearInterval);
    activeTimers = [];
  }

  return { unlock, play, stop };
})();
