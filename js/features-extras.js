/**
 * @module features-extras
 * @description Additional UI features for the EcoTrace application:
 * Offset Visualizer and Ambient Nature Sounds. Extracted from the core
 * features module for better code organisation while maintaining the
 * same public API via re-exports.
 */

/* ───────── Named Constants ───────── */

/** @const {number} Default annual footprint when no calculation exists (kg CO₂). */
const DEFAULT_FOOTPRINT_KG = 4000;

/** @const {number} Kilograms of CO₂ absorbed by one tree per year. */
const KG_PER_TREE = 22;

/** @const {number} Kilograms of CO₂ offset by one residential solar panel per year. */
const KG_PER_SOLAR_PANEL = 450;

/** @const {number} Kilograms of CO₂ saved by switching one bulb to LED per year. */
const KG_PER_LED = 36;

/** @const {number} Average km of cycling to offset 1 kg CO₂ vs driving. */
const KM_PER_KG_CYCLING = 2.3;

/** @const {number} Master gain for the ambient nature-sounds oscillator. */
const AMBIENT_GAIN = 0.03;

/** @const {number} Auto-stop timeout for ambient sounds (30 minutes). */
const AMBIENT_AUTO_STOP_MS = 30 * 60 * 1000;

/** @const {number} Interval between count-up animation frames (ms). */
const COUNTUP_INTERVAL_MS = 30;

/** @const {number} Total animation steps for the count-up numbers. */
const COUNTUP_STEPS = 40;

/** @const {string} localStorage key for last calculated footprint. */
const FOOTPRINT_KEY = "lastFootprintKg";

/* ===== OFFSET VISUALIZER ===== */

/**
 * Calculates and renders animated cards showing how many trees,
 * solar panels, LED bulbs, and cycling km are needed to offset
 * the user's annual carbon footprint.
 *
 * @returns {void}
 */
export function initOffsetVisualizer() {
  const el = document.querySelector("[data-offset-viz]");
  if (!el) return;
  let kg = Number(localStorage.getItem(FOOTPRINT_KEY)) || 0;
  if (!kg) {
    const cached = JSON.parse(localStorage.getItem('eco-activities-cache') || '[]');
    const latest = cached.filter(a => a.co2Kg > 0).pop();
    if (latest) kg = Number(latest.co2Kg);
  }
  if (!kg) kg = DEFAULT_FOOTPRINT_KG;
  const offsets = [
    { emoji: "🌳", value: Math.ceil(kg / KG_PER_TREE), label: "Trees needed for 1 year" },
    { emoji: "☀️", value: Math.ceil(kg / KG_PER_SOLAR_PANEL), label: "Solar panels for 1 year" },
    { emoji: "💡", value: Math.ceil(kg / KG_PER_LED), label: "LED bulbs to switch" },
    { emoji: "🚲", value: Math.ceil(kg / KM_PER_KG_CYCLING / 365), label: "km cycling daily" },
  ];
  el.replaceChildren();
  offsets.forEach(o => {
    const card = document.createElement('div');
    card.className = 'offset-card';
    const emoji = document.createElement('span');
    emoji.className = 'offset-emoji';
    emoji.textContent = o.emoji;
    const num = document.createElement('div');
    num.className = 'offset-number';
    num.dataset.count = o.value;
    num.textContent = '0';
    const label = document.createElement('div');
    label.className = 'offset-label';
    label.textContent = o.label;
    card.append(emoji, num, label);
    el.append(card);
  });

  el.querySelectorAll("[data-count]").forEach(num => {
    const target = Number(num.dataset.count);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / COUNTUP_STEPS));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      num.textContent = current.toLocaleString();
      if (current >= target) clearInterval(timer);
    }, COUNTUP_INTERVAL_MS);
  });
}

/* ===== AMBIENT NATURE SOUNDS ===== */

/**
 * Creates a Web Audio context that plays soft brown-noise wind
 * and random sine-wave bird chirps. Toggles on/off and auto-stops
 * after {@link AMBIENT_AUTO_STOP_MS} milliseconds.
 *
 * @returns {void}
 */
export function initAmbientSounds() {
  const btn = document.querySelector("[data-ambient-toggle]");
  if (!btn) return;
  let ctx = null, playing = false, nodes = [];

  /** Builds the audio graph and starts playback. */
  function start() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.value = AMBIENT_GAIN;
    gain.connect(ctx.destination);

    const bufSize = 2 * ctx.sampleRate;
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    noise.connect(filter);
    filter.connect(gain);
    noise.start();
    nodes.push(noise, filter, gain);

    /** Schedules a random bird-chirp oscillator burst. */
    function chirp() {
      if (!playing) return;
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 2000 + Math.random() * 2000;
      g2.gain.value = 0;
      g2.gain.linearRampToValueAtTime(0.015, ctx.currentTime + 0.05);
      g2.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.connect(g2);
      g2.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      setTimeout(chirp, 3000 + Math.random() * 8000);
    }
    setTimeout(chirp, 1000 + Math.random() * 3000);
    playing = true;
    setTimeout(() => { if (playing) stop(); }, AMBIENT_AUTO_STOP_MS);
  }

  /** Tears down all audio nodes and closes the context. */
  function stop() {
    playing = false;
    nodes.forEach(n => {
      try { n.stop?.(); n.disconnect(); } catch { /* node already stopped */ }
    });
    nodes = [];
    if (ctx) { ctx.close(); ctx = null; }
  }

  /**
   * Sets the ambient-sounds button icon and label text.
   * @param {string} icon - FontAwesome icon name suffix.
   * @param {string} text - Button label text.
   */
  function setAmbientLabel(icon, text) {
    btn.replaceChildren();
    const i = document.createElement('i');
    i.className = `fa-solid fa-${icon}`;
    i.setAttribute('aria-hidden', 'true');
    btn.append(i, ` ${text}`);
  }

  btn.addEventListener("click", () => {
    if (playing) {
      stop();
      btn.classList.remove("active");
      setAmbientLabel('volume-xmark', 'Nature Sounds');
    } else {
      start();
      btn.classList.add("active");
      setAmbientLabel('volume-high', 'Nature Sounds');
    }
  });
}
