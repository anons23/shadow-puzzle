const ROOMS = [
  { chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], melody: [69, 72, 74, 76, 79, 81], wave: 'triangle', cut: 1100, box: false },
  { chords: [[53, 57, 60], [50, 53, 57], [58, 62, 65], [48, 52, 55]], melody: [77, 79, 81, 84, 86, 89], wave: 'sine', cut: 1500, box: true },
  { chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], melody: [74, 77, 79, 81, 84], wave: 'sawtooth', cut: 650, box: false },
  { chords: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 54, 57]], melody: [79, 81, 83, 86, 88], wave: 'triangle', cut: 1300, box: false },
];
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let ac = null, master, sfxBus, musicBus, ambBus, reverb, noise, dragGain, dragFilter;
let sfxOn = true, musicOn = true, room = 0, inScene = false, paused = false;
let chordIdx = 0, nextChord = 0, nextNote = 0, timer = 0, dragTimer = 0;

function makeNoise(seconds) {
  const b = ac.createBuffer(1, ac.sampleRate * seconds, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function makeImpulse(seconds) {
  const len = ac.sampleRate * seconds, b = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  return b;
}
function loopNoise() { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); s.start(); return s; }

function init() {
  if (ac) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ac = new AC();
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  master = ac.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ac.destination);
  reverb = ac.createConvolver(); reverb.buffer = makeImpulse(2.6);
  const wet = ac.createGain(); wet.gain.value = 0.55; reverb.connect(wet); wet.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 1 : 0; sfxBus.connect(master);
  musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(master); musicBus.connect(reverb);
  ambBus = ac.createGain(); ambBus.gain.value = 0; ambBus.connect(master);
  noise = makeNoise(3);

  const tone = loopNoise(), lp = ac.createBiquadFilter(), tg = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 380; tg.gain.value = 0.05; tone.connect(lp); lp.connect(tg); tg.connect(ambBus);
  const hiss = loopNoise(), bp = ac.createBiquadFilter(), hg = ac.createGain();
  bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.7; hg.gain.value = 0.012; hiss.connect(bp); bp.connect(hg); hg.connect(ambBus);

  const dn = loopNoise(); dragFilter = ac.createBiquadFilter(); dragGain = ac.createGain();
  dragFilter.type = 'bandpass'; dragFilter.Q.value = 1.3; dragFilter.frequency.value = 500; dragGain.gain.value = 0;
  dn.connect(dragFilter); dragFilter.connect(dragGain); dragGain.connect(sfxBus);

  nextChord = nextNote = ac.currentTime + 0.3;
  timer = setInterval(schedule, 120);
  return true;
}

function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function pop(t, vol) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noise; f.type = 'highpass'; f.frequency.value = 1200 + Math.random() * 2500;
  const len = 0.008 + Math.random() * 0.03;
  env(g, t, vol, 0.001, len);
  s.connect(f); f.connect(g); g.connect(ambBus);
  s.start(t, Math.random() * 2, len + 0.02);
}

function padChord(t, notes, dur) {
  const R = ROOMS[room], f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = R.cut; f.connect(musicBus);
  notes.forEach((m) => [-4, 4].forEach((cents) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = R.wave; o.frequency.value = hz(m); o.detune.value = cents;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 2.2);
    g.gain.setValueAtTime(0.05, t + dur - 3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(f); o.start(t); o.stop(t + dur + 0.1);
  }));
}

function bell(t, m, vol, dest, decay) {
  [[1, 1], [2.01, 0.45], [3.0, 0.2], [4.2, 0.1]].forEach(([r, a]) => {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = hz(m) * r;
    env(g, t, vol * a, 0.004, decay / r + 0.2);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + decay + 0.5);
  });
}

function schedule() {
  if (!ac || ac.state !== 'running') return;
  const now = ac.currentTime, R = ROOMS[room];
  if (musicOn) {
    while (nextChord < now + 0.5) {
      padChord(nextChord, R.chords[chordIdx % R.chords.length], 9);
      chordIdx++; nextChord += 7;
    }
    while (nextNote < now + 0.5) {
      if (Math.random() < 0.55) bell(nextNote, R.melody[Math.floor(Math.random() * R.melody.length)], R.box ? 0.09 : 0.06, musicBus, R.box ? 2.4 : 1.6);
      nextNote += R.box ? 0.6 + Math.random() * 1.2 : 1.1 + Math.random() * 2.2;
    }
  } else { nextChord = nextNote = now + 0.5; }
  if (inScene && sfxOn) {
    for (let k = 0; k < 3; k++) {
      if (Math.random() < 0.06) pop(now + 0.05 + k * 0.04 + Math.random() * 0.03, 0.04 + Math.random() * 0.14);
    }
    if (Math.random() < 0.012) for (let k = 0; k < 4; k++) pop(now + 0.05 + k * (0.02 + Math.random() * 0.05), 0.1 + Math.random() * 0.15);
  }
}

function blip(freq, to, dur, vol, type) {
  if (!ac || !sfxOn || paused) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, vol, 0.003, dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
}

export const Sound = {
  unlock() { if (init() && !paused && ac.state !== 'running') ac.resume(); },
  setSfx(on) { sfxOn = on; if (ac) { sfxBus.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, 0.05); ambBus.gain.setTargetAtTime(on && inScene ? 0.5 : 0, ac.currentTime, 0.2); } },
  setMusic(on) { musicOn = on; if (ac) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ac.currentTime, 0.3); },
  setRoom(i) {
    i = i % ROOMS.length;
    if (i === room) return;
    room = i; chordIdx = 0;
    if (ac) { nextChord = Math.max(nextChord - 3, ac.currentTime + 0.3); }
  },
  setScene(on) { inScene = on; if (ac) ambBus.gain.setTargetAtTime(on && sfxOn ? 0.5 : 0, ac.currentTime, 0.3); },
  drag(speed) {
    if (!ac || !sfxOn || paused) return;
    const t = ac.currentTime, v = Math.min(0.32, speed * 0.4);
    dragFilter.frequency.setTargetAtTime(350 + Math.min(1600, speed * 1500), t, 0.03);
    dragGain.gain.setTargetAtTime(v, t, 0.03);
    clearTimeout(dragTimer);
    dragTimer = setTimeout(() => dragGain.gain.setTargetAtTime(0, ac.currentTime, 0.08), 70);
  },
  dragEnd() { if (ac) dragGain.gain.setTargetAtTime(0, ac.currentTime, 0.08); },
  click() { blip(520, 300, 0.05, 0.16, 'triangle'); },
  tick() { blip(1900, 1700, 0.015, 0.04); },
  ui() { blip(700, 520, 0.06, 0.1, 'triangle'); },
  hint() {
    if (!ac || !sfxOn || paused) return;
    const t = ac.currentTime;
    [0, 4, 7, 12, 16, 19].forEach((n, k) => bell(t + k * 0.06, 76 + n, 0.05, reverb, 1.2));
  },
  win() {
    if (!ac || !sfxOn || paused) return;
    const t = ac.currentTime, R = ROOMS[room];
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = 'lowpass';
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(1800, t + 0.35);
    env(g, t, 0.25, 0.12, 0.5);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, 0, 0.8);
    const base = R.chords[0].map((m) => m + 12);
    [...base, base[0] + 12, base[1] + 12].forEach((m, k) => {
      bell(t + 0.08 + k * 0.09, m, 0.13, sfxBus, 2.2);
      bell(t + 0.08 + k * 0.09, m, 0.08, reverb, 2.2);
    });
  },
  pauseAll() { paused = true; if (ac && ac.state === 'running') ac.suspend(); },
  resumeAll() { paused = false; if (ac && ac.state !== 'running') ac.resume(); },
  get ctx() { return ac; },
  get master() { return master; },
};
