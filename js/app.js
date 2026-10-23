/*!
 * HardwareLab — interfaz
 * Copyright (c) 2026 Un Fantasma en el Sistema — Licencia MIT
 */
(function () {
  'use strict';

  const H = window.HL;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const it = (cat, id) => H.item(cat, id);

  const st = H.createState();
  const ui = {
    power: false, timers: [], lastPost: null, lastStress: null, underLoad: false, stressing: false,
    postHex: '--', leds: [0, 0, 0, 0], temp: 25, fanRpm: 0,
    cat: 'cpu', muted: false, volume: 0.7, dmm: false, dmmPoint: 'atx_12v', flir: false,
    mode: 'assembly', scenario: null, quiz: null, quizAnswers: {},
  };

  // ==========================================================================
  // AUDIO (Web Audio API, sin archivos)
  // ==========================================================================

  let audioCtx = null, analyser = null;
  function initAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(audioCtx.destination);
      requestAnimationFrame(drawWave);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function tone(ms, delay, freq, type) {
    if (ui.muted) return;
    initAudio();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + (delay || 0) / 1000;
    const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq || 880, t0);
    const vol = ui.volume * 0.22;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.setValueAtTime(vol, t0 + ms / 1000 - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + ms / 1000);
    osc.connect(g); g.connect(analyser);
    osc.start(t0); osc.stop(t0 + ms / 1000 + 0.02);
    $('sound-last-beep').textContent = `${freq || 880} Hz · ${ms} ms`;
  }

  /** Reproduce un código de pitidos del núcleo: seq = [['s'], ['l'], …]. */
  function playBeepCode(code) {
    if (!code) return;
    let t = 0;
    for (const [k] of code.seq) {
      const ms = k === 'l' ? 650 : 160;
      tone(ms, t, 880);
      t += ms + (k === 'l' ? 250 : 160);
    }
  }

  function siren() { [1200, 800, 1200, 800, 1200, 800].forEach((f, i) => tone(180, i * 220, f, 'sawtooth')); }
  function click(on) { tone(40, 0, on ? 180 : 120, 'triangle'); }

  function drawWave() {
    const c = $('audio-wave-canvas');
    if (c && analyser) {
      const ctx = c.getContext('2d');
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(data);
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.strokeStyle = ui.power ? '#38bdf8' : '#334155'; ctx.lineWidth = 2; ctx.beginPath();
      const w = c.width / data.length;
      data.forEach((v, i) => { const y = (v / 128) * (c.height / 2); i ? ctx.lineTo(i * w, y) : ctx.moveTo(0, y); });
      ctx.stroke();
    }
    requestAnimationFrame(drawWave);
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  let toastT = null;
  function toast(msg, icon) {
    $('toast-msg').textContent = msg;
    $('toast-icon').textContent = icon || 'ℹ';
    const t = $('canvas-overlay-toast');
    t.classList.remove('opacity-0', 'translate-y-2');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.add('opacity-0', 'translate-y-2'), 4200);
  }

  function toggleModal(id, show) {
    const m = $(id);
    m.classList.toggle('hidden', !show);
    m.classList.toggle('flex', !!show);
    if (show && id === 'modal-quiz') renderQuiz();
  }

  function logPost(msg, type) {
    const s = $('post-log-stream');
    const line = document.createElement('div');
    line.className = `leading-tight ${type === 'error' ? 'text-rose-400 font-bold' : type === 'warn' ? 'text-amber-400' : 'text-cyan-300'}`;
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    line.textContent = `[${time}] ${msg}`;
    s.appendChild(line);
    while (s.children.length > 200) s.removeChild(s.firstChild);
    s.scrollTop = s.scrollHeight;
  }

  function clearTimers() { ui.timers.forEach(clearTimeout); ui.timers = []; }
  function later(ms, fn) { ui.timers.push(setTimeout(fn, ms)); }

  /** Cualquier cambio en el equipo invalida el último arranque (los retos exigen volver a encender). */
  function changed() {
    ui.lastPost = null; ui.lastStress = null; ui.underLoad = false;
    if (ui.power) powerOff(true);
    renderAll();
  }

  // ==========================================================================
  // ENCENDIDO Y POST
  // ==========================================================================

  function setPostHex(code, name, desc) {
    ui.postHex = code;
    const v = $('post-hex-value');
    v.textContent = code;
    const red = ['00', '55', 'd6', 'FF'].includes(code);
    v.className = `font-digital text-4xl font-black tracking-widest ${code === 'AA' ? 'text-emerald-400 post-glow-green' : red ? 'text-rose-500 post-glow-red' : code === '--' ? 'text-slate-600' : 'text-cyan-400 post-glow-cyan'}`;
    $('post-hex-name').textContent = name;
    $('post-hex-desc').textContent = desc;
    const sv = $('svg-post-hex-text');
    if (sv) { sv.textContent = code; sv.setAttribute('fill', code === 'AA' ? '#10b981' : code === '--' ? '#64748b' : red ? '#ef4444' : '#38bdf8'); }
  }

  function setLeds(l) {
    ui.leds = l;
    const map = [['cpu', 'bg-rose-500 led-glow-red', '#ef4444'], ['dram', 'bg-amber-400 led-glow-amber', '#f59e0b'], ['vga', 'bg-slate-100 led-glow-white', '#f8fafc'], ['boot', 'bg-emerald-400 led-glow-green', '#10b981']];
    map.forEach(([k, cls, fill], i) => {
      $(`ezled-${k}`).className = `w-3 h-3 rounded-full ${l[i] ? cls : 'bg-slate-800'}`;
      const s = $(`svg-ezled-${k}`);
      if (s) s.setAttribute('fill', l[i] ? fill : '#1e293b');
    });
  }

  function setPowerUi(on, label) {
    $('btn-power').classList.toggle('is-on', on);
    $('power-btn-text').textContent = on ? 'Apagar' : 'Encender';
    $('power-indicator-dot').className = `w-2.5 h-2.5 rounded-full ${on ? 'bg-emerald-300 animate-ping' : 'bg-white'}`;
    const b = $('post-status-badge');
    b.textContent = label;
    b.className = `text-[10px] px-2 py-0.5 rounded font-code font-bold ${label.startsWith('ARRANCADO') ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : on ? 'bg-cyan-950 text-cyan-400 border border-cyan-800' : 'bg-slate-800 text-slate-400'}`;
    $('btn-stress').disabled = !(on && ui.lastPost && (ui.lastPost.outcome === 'ok' || ui.lastPost.outcome === 'no-boot'));
  }

  function powerOff(silent) {
    clearTimers();
    if (ui.power && !silent) click(false);
    ui.power = false; ui.fanRpm = 0; ui.temp = 25; ui.underLoad = false; ui.stressing = false;
    setPostHex('--', 'Apagado', 'Equipo en reposo (+5 VSB presente si la fuente está enchufada)');
    setLeds([0, 0, 0, 0]);
    setPowerUi(false, 'APAGADO');
    renderCanvas(); updateTelemetry();
    if (ui.dmm) measurePoint(ui.dmmPoint);
  }

  function powerOn() {
    initAudio();
    const plan = H.postPlan(st);
    clearTimers();
    logPost('──────────── Pulsación del botón de encendido ────────────', 'info');
    if (!plan.powered && plan.outcome !== 'thermtrip') {
      plan.steps.forEach((s) => logPost(s.log, s.type));
      toast(plan.toast, '⛔');
      ui.lastPost = plan;
      return;
    }
    click(true);
    ui.power = true; ui.fanRpm = 900; ui.temp = 35; ui.lastStress = null; ui.underLoad = false;
    setPowerUi(true, 'POST EN CURSO');
    renderCanvas(); updateTelemetry();
    let t = 0;
    plan.steps.forEach((s, i) => {
      later(t, () => {
        setPostHex(s.hex, s.hex === '--' ? 'Arranque' : (H.QCODES[s.hex] ? 'Q-code ' + s.hex : s.hex), H.QCODES[s.hex] || 'Fuente arrancando');
        setLeds(s.leds);
        logPost(s.log, s.type);
        if (plan.outcome === 'thermtrip' && i === plan.steps.length - 1) { ui.fanRpm = 3200; ui.temp = plan.temp; updateTelemetry(); }
      });
      t += i === 0 ? 450 : 600;
    });
    later(t + 100, () => finishPost(plan));
  }

  function finishPost(plan) {
    ui.lastPost = plan;
    if (plan.beep) { playBeepCode(plan.beep); logPost(`Altavoz: ${plan.beep.label} (${st.biosVendor}).`, 'info'); }
    if (plan.outcome === 'thermtrip') {
      if (plan.siren) siren();
      later(1600, () => { powerOff(); toast(plan.toast, '🔥'); logPost('Apagado por protección térmica.', 'error'); checkScenarioHint(); });
      return;
    }
    if (plan.temp) ui.temp = plan.temp;
    ui.fanRpm = plan.outcome === 'ok' || plan.outcome === 'no-boot' ? 1100 : 900;
    setPowerUi(true, plan.outcome === 'ok' ? 'ARRANCADO (AA)' : plan.outcome === 'no-boot' ? 'EN LA BIOS' : 'POST DETENIDO');
    updateTelemetry();
    if (ui.flir) updateThermal();
    if (ui.dmm) measurePoint(ui.dmmPoint);
    toast(plan.toast, plan.outcome === 'ok' ? '✅' : plan.outcome === 'no-boot' ? '💾' : '⚠');
    if (plan.outcome === 'no-boot' && st.device === 'desktop') later(900, () => openUefiBios(true));
    if (ui.mode === 'challenge') checkChallengeFix(true);
  }

  function togglePower() { if (ui.power) { powerOff(); logPost('Equipo apagado.', 'info'); } else powerOn(); }

  function triggerReset() {
    if (!ui.power) { toast('El botón de reset solo hace algo con el equipo encendido.', 'ℹ'); return; }
    logPost('Reset: la placa reinicia la CPU sin cortar la fuente.', 'warn');
    powerOff(true);
    later(500, powerOn);
  }

  function runStressTest() {
    if (!ui.power || !ui.lastPost) { toast('Enciende el equipo y deja que termine el POST.', 'ℹ'); return; }
    const r = H.stressTest(st);
    if (!r.ran) { toast(r.reason, '⚠'); return; }
    ui.stressing = true;
    $('btn-stress').disabled = true;
    logPost(`Prueba de estrés: CPU y GPU al 100 % (≈${r.power} W${r.psu ? ` con fuente de ${r.psu} W` : ''})…`, 'info');
    ui.fanRpm = 2400; updateTelemetry(true);
    later(1800, () => {
      ui.stressing = false;
      ui.lastStress = r;
      r.events.forEach((e) => logPost(e, r.shutdown ? 'error' : /limitando|rebajando|sin margen/.test(e) ? 'warn' : 'info'));
      if (r.shutdown) {
        ui.temp = r.temp;
        if (r.shutdown === 'thermtrip') siren();
        later(600, () => { powerOff(); toast(r.shutdown === 'opp' ? 'Apagado de golpe: la fuente ha cortado por sobrepotencia (OPP).' : 'Apagado por temperatura bajo carga.', '💥'); });
        return;
      }
      ui.underLoad = true; ui.temp = r.temp; ui.fanRpm = 2400;
      updateTelemetry(true);
      if (ui.flir) updateThermal();
      if (ui.dmm) measurePoint(ui.dmmPoint);
      $('btn-stress').disabled = false;
      toast(r.clock < 100 ? `Aguanta, pero la CPU limita su frecuencia al ${r.clock} %.` : 'Prueba de estrés superada.', r.clock < 100 ? '⚠' : '✅');
      if (ui.mode === 'challenge') checkChallengeFix(true);
    });
  }

  // ==========================================================================
  // TELEMETRÍA, AUDITORÍA E INSTRUMENTOS
  // ==========================================================================

  function updateTelemetry() {
    const pb = H.powerBudget(st);
    const draw = !ui.power ? 2 : ui.underLoad || ui.stressing ? pb.load : pb.idle;
    const cap = pb.psu || (st.device === 'laptop' ? 90 : 0);
    const pct = cap ? Math.round((draw / cap) * 100) : 0;
    $('watts-used').textContent = `${draw} W`;
    $('watts-psu').textContent = cap ? `${cap} W` : 'sin fuente';
    $('watts-percent').textContent = `${pct}%`;
    $('watts-max').textContent = st.device === 'desktop' ? `máx. ≈${pb.load} W · recomendada ${pb.recommended} W` : 'cargador de 90 W';
    const bar = $('power-bar');
    bar.style.width = `${Math.min(pct, 100)}%`;
    bar.className = `h-full transition-all ${pct > 100 ? 'bg-rose-500 animate-pulse' : pct > 85 ? 'bg-amber-400' : 'bg-emerald-500'}`;
    const tag = $('power-status-tag');
    const loadPct = cap ? Math.round((pb.load / cap) * 100) : 0;
    tag.textContent = !cap ? 'Sin fuente' : loadPct > 100 ? 'Insuficiente a plena carga' : loadPct > 85 ? 'Margen justo' : 'Margen correcto';
    tag.className = `text-[10px] px-1.5 py-0.5 rounded border ${!cap || loadPct > 100 ? 'bg-rose-950 text-rose-400 border-rose-800' : loadPct > 85 ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-emerald-950 text-emerald-400 border-emerald-800'}`;
    const t = ui.power ? ui.temp : 25;
    $('temp-cpu-display').textContent = `${t} °C`;
    $('temp-cpu-display').className = `font-code font-bold ${t > 85 ? 'text-rose-400 animate-pulse' : t > 70 ? 'text-amber-400' : 'text-cyan-400'}`;
    const tb = $('temp-cpu-bar');
    tb.style.width = `${Math.min(t, 100)}%`;
    tb.className = `h-full ${t > 85 ? 'bg-rose-500' : t > 70 ? 'bg-amber-400' : 'bg-cyan-400'}`;
    $('fan-rpm-display').textContent = ui.power ? `${ui.fanRpm} RPM` : '0 RPM';
  }

  function renderAudit() {
    const issues = H.audit(st);
    const errors = issues.filter((i) => i.level === 'ERROR').length, warns = issues.filter((i) => i.level === 'WARN').length;
    const b = $('audit-badge');
    b.textContent = errors ? `${errors} ERROR${errors > 1 ? 'ES' : ''}` : warns ? `${warns} AVISO${warns > 1 ? 'S' : ''}` : 'TODO OK';
    b.className = `text-[10px] px-1.5 py-0.5 rounded font-code border ${errors ? 'bg-rose-950 text-rose-400 border-rose-800' : warns ? 'bg-amber-950 text-amber-400 border-amber-800' : 'bg-emerald-950 text-emerald-400 border-emerald-800'}`;
    $('audit-messages').innerHTML = issues.length ? issues.map((i) => {
      const [c, ic] = i.level === 'ERROR' ? ['text-rose-400', '✖'] : i.level === 'WARN' ? ['text-amber-400', '⚠'] : ['text-cyan-300', 'ℹ'];
      return `<div class="${c} flex items-start gap-1 leading-tight"><span class="font-bold">${ic}</span><span>${esc(i.text)}</span></div>`;
    }).join('') : '<div class="text-emerald-400">✔ Montaje sin problemas detectados.</div>';
  }

  function toggleThermalView() {
    ui.flir = !ui.flir;
    $('flir-hud-overlay').classList.toggle('hidden', !ui.flir);
    $('svg-host').classList.toggle('flir-active', ui.flir);
    $('flir-btn-text').textContent = ui.flir ? 'Cámara IR [ON]' : 'Cámara térmica';
    if (ui.flir) updateThermal();
  }

  function updateThermal() {
    const t = ui.power ? ui.temp : 25;
    $('flir-max-temp').textContent = `${(t + (ui.power ? 3 : 0)).toFixed(1)} °C`;
    $('flir-spot-reading').textContent = `${t.toFixed(1)} °C`;
    $('flir-spot-label').textContent = st.device === 'desktop' ? '(disipador de la CPU)' : '(zona del chip)';
  }

  function toggleMultimeter() {
    ui.dmm = !ui.dmm;
    $('dmm-floating-panel').classList.toggle('hidden', !ui.dmm);
    $('dmm-btn-text').textContent = ui.dmm ? 'Multímetro [ON]' : 'Multímetro';
    if (ui.dmm) measurePoint(ui.dmmPoint);
  }

  function measurePoint(point) {
    ui.dmmPoint = point;
    const p = H.DMM_POINTS[point];
    const r = H.dmmRead(st, point, ui.power, ui.underLoad);
    tone(80, 0, 2200, 'sine');
    $('dmm-point-name').textContent = p.name + (ui.underLoad ? ' · bajo carga' : '');
    const lcd = $('dmm-lcd-value');
    lcd.textContent = `${r.value >= 0 ? '+' : ''}${r.value.toFixed(2)} V`;
    lcd.className = `font-dmm text-2xl font-black tracking-wider whitespace-nowrap ${r.ok ? 'text-emerald-400 lcd-glow' : 'text-rose-500'}`;
    const b = $('dmm-tolerance-badge');
    b.textContent = r.ok ? 'CORRECTO' : r.value === 0 ? 'SIN TENSIÓN' : 'FUERA DE RANGO';
    b.className = `text-[9px] px-1.5 py-0.5 rounded font-bold font-code ${r.ok ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`;
    $('dmm-diagnosis-text').textContent = r.text;
    document.querySelectorAll('[data-act="measurePoint"]').forEach((x) => x.classList.toggle('dmm-sel', x.dataset.args === JSON.stringify([point])));
  }

  // ==========================================================================
  // CATÁLOGO Y MONTAJE
  // ==========================================================================

  const CAT_LABEL = { cpu: 'CPUs', mobo: 'Placas', ram: 'RAM', gpu: 'GPUs', cooler: 'Disipadores', psu: 'Fuentes', storage: 'SSD M.2' };

  function filterCatalog(cat) {
    ui.cat = cat;
    renderCatalog();
  }

  function installedId(cat) {
    if (st.device === 'laptop') return cat === 'storage' ? st.laptop.nvme : null;
    const d = st.desktop;
    return { cpu: d.cpu, mobo: d.mobo, gpu: d.gpu, cooler: d.cooler, psu: d.psu, storage: d.nvme }[cat];
  }

  function renderCatalog() {
    const lap = st.device === 'laptop';
    const cats = lap ? ['ram', 'storage'] : ['cpu', 'mobo', 'ram', 'gpu', 'cooler', 'psu', 'storage'];
    if (!cats.includes(ui.cat)) ui.cat = cats[0];
    document.querySelectorAll('.cat-tab').forEach((b) => {
      const c = b.dataset.cat;
      b.classList.toggle('hidden', !cats.includes(c));
      b.className = `cat-tab px-2.5 py-1 rounded-lg whitespace-nowrap ${c === ui.cat ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'} ${cats.includes(c) ? '' : 'hidden'}`;
    });
    $('catalog-count-badge').textContent = lap ? 'Portátil: RAM y SSD' : `${Object.values(H.CATALOG).reduce((s, l) => s + l.length, 0)} piezas`;
    const slots = lap ? st.laptop.ram : st.desktop.ram;
    const slotNames = lap ? ['Ranura 1', 'Ranura 2'] : H.SLOT_NAMES;
    $('catalog-list').innerHTML = H.CATALOG[ui.cat].map((x) => {
      const inst = ui.cat === 'ram' ? slots.some((r) => r && r.id === x.id) : installedId(ui.cat) === x.id;
      const fits = ui.cat === 'ram' ? slots.some((r, i) => !r && H.canInstall(st, 'ram', x.id, i).ok) || inst : H.canInstall(st, ui.cat, x.id).ok || inst;
      const tags = [];
      if (x.socket) tags.push(`<span class="text-cyan-400">${esc(x.socket)}</span>`);
      if (x.maxPower) tags.push(`<span class="text-amber-400">${x.tdp}–${x.maxPower} W</span>`);
      if (x.tbp) tags.push(`<span class="text-amber-400">${x.tbp} W</span>`);
      if (x.ddr) tags.push(`<span class="text-blue-400">${esc(x.ddr)} ${esc(x.form || '')}</span>`);
      if (x.watts) tags.push(`<span class="text-emerald-400">${x.watts} W</span>`);
      if (x.capacity) tags.push(`<span class="text-emerald-400">≈${x.capacity} W</span>`);
      let actions;
      if (ui.cat === 'ram') {
        actions = `<div class="flex flex-wrap gap-1">${slotNames.map((n, i) => {
          const occ = slots[i];
          return occ ? '' : `<button data-act="installComponent" data-args='${JSON.stringify(['ram', x.id, i])}' class="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-[10px] border border-slate-700 font-code">${n.replace('DIMM_', '')}</button>`;
        }).join('')}</div>`;
      } else if (ui.cat === 'mobo' && inst) {
        actions = '<span class="text-[10px] text-cyan-300">En el banco</span>';
      } else {
        actions = inst
          ? `<button data-act="removeComponent" data-args='${JSON.stringify([ui.cat])}' class="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 text-[10px] font-semibold border border-rose-800">Quitar</button>`
          : `<button data-act="installComponent" data-args='${JSON.stringify([ui.cat, x.id])}' class="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-slate-300 text-[10px] font-semibold border border-slate-700">Montar</button>`;
      }
      return `<div class="p-2.5 rounded-xl border ${inst ? 'bg-cyan-950/40 border-cyan-500/70' : 'bg-slate-950/70 border-slate-800/80'} flex flex-col gap-1.5">
        <div><h4 class="font-bold text-xs text-white leading-tight flex items-center gap-1.5 flex-wrap">${esc(x.name)}${inst ? '<span class="text-[9px] px-1 rounded bg-cyan-900 text-cyan-300 font-code">montado</span>' : ''}${!fits ? '<span class="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-code">no encaja</span>' : ''}</h4>
        <p class="text-[10px] text-slate-400 leading-tight mt-0.5">${esc(x.desc)}</p></div>
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-900 text-[10px]"><div class="flex flex-wrap gap-2 font-code">${tags.join('')}</div>${actions}</div>
      </div>`;
    }).join('') + (ui.cat === 'ram' ? renderSlots(slots, slotNames, lap) : '');
  }

  function renderSlots(slots, names, lap) {
    return `<div class="p-2.5 rounded-xl border border-slate-700 bg-slate-900/60 space-y-1.5">
      <div class="text-[10px] font-bold text-slate-300 uppercase">Ranuras de memoria${lap ? '' : ' (A2 y B2 primero)'}</div>
      ${slots.map((r, i) => {
        const m = r ? it('ram', r.id) : null;
        return `<div class="flex items-center justify-between gap-1 text-[10px] font-code">
          <span class="${!lap && (i === 1 || i === 3) ? 'text-cyan-300 font-bold' : 'text-slate-400'} w-16 shrink-0">${names[i].replace('DIMM_', '')}</span>
          <span class="flex-1 truncate ${m ? 'text-white' : 'text-slate-600'}">${m ? esc(m.name) : 'vacía'}</span>
          ${m ? `<button data-act="toggleLatch" data-args='[${i}]' class="px-1.5 rounded border ${r.latched ? 'border-emerald-700 text-emerald-300' : 'border-rose-700 text-rose-300 animate-alert-blink'}" title="Pestillos de la ranura">${r.latched ? 'cerrados' : 'abiertos'}</button>
          <button data-act="removeComponent" data-args='["ram",${i}]' class="px-1.5 rounded bg-rose-950 text-rose-300 border border-rose-800">Quitar</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  }

  function installComponent(cat, id, slot) {
    initAudio();
    const r = H.install(st, cat, id, slot);
    if (!r.ok) { tone(250, 0, 220, 'sawtooth'); toast(r.reason, '⛔'); logPost(`No se puede montar: ${r.reason}`, 'warn'); return; }
    tone(60, 0, 820);
    (r.warn || []).forEach((w) => logPost(w, 'warn'));
    if (r.damage) { siren(); toast(r.damage, '💥'); logPost(r.damage, 'error'); }
    else toast(`Montado: ${it(cat, id).name}${slot !== undefined ? ` en ${st.device === 'laptop' ? 'ranura ' + (slot + 1) : H.SLOT_NAMES[slot]}` : ''}`, '🔧');
    if (cat === 'gpu' && it('gpu', id).needsPower) logPost(`Recuerda conectar la alimentación de la gráfica: ${it('gpu', id).connector}.`, 'info');
    if (cat === 'cooler') logPost(it('cooler', id).film ? 'El disipador trae una lámina protectora en la base: quítala antes de cerrar (herramienta «Lámina»). ¿Has puesto pasta?' : 'Disipador de serie: la pasta viene aplicada de fábrica.', 'info');
    changed();
  }

  function removeComponent(cat, slot) {
    tone(40, 0, 400);
    const r = H.remove(st, cat, slot);
    if (r.damage) { siren(); toast(r.damage, '💥'); logPost(r.damage, 'error'); }
    changed();
  }

  function toggleLatch(slot) {
    const on = H.toggleLatch(st, slot);
    tone(50, 0, on ? 900 : 500);
    toast(on ? 'Pestillos cerrados: el módulo ha hecho «clic» y está asentado.' : 'Pestillos abiertos: el módulo queda suelto en la ranura.', '💾');
    changed();
  }

  function toggleCable(name) {
    if (st.device !== 'desktop') return;
    const d = st.desktop;
    if (name !== 'fpanel' && !d.psu) { toast('Primero instala una fuente: los cables salen de ella.', '⚠'); return; }
    if (name === 'pcie' && (!d.gpu || !it('gpu', d.gpu).needsPower)) { toast(d.gpu ? 'Esta gráfica no lleva conector de alimentación: se alimenta por la ranura.' : 'No hay gráfica que alimentar.', 'ℹ'); return; }
    if (name === 'eps8' && !d.cpu) logPost('Has conectado el EPS sin CPU: no pasa nada, pero no servirá de mucho.', 'info');
    d.cables[name] = !d.cables[name];
    tone(50, 0, d.cables[name] ? 800 : 400);
    const label = { atx24: 'ATX 24 pines', eps8: 'EPS 8 pines (CPU)', pcie: 'alimentación de la GPU', fpanel: 'panel frontal (PWR_SW)' }[name];
    toast(`${label}: ${d.cables[name] ? 'conectado' : 'desconectado'}`, d.cables[name] ? '🔌' : '✂');
    changed();
  }

  function applyThermalPaste() {
    if (st.device === 'desktop') {
      if (!st.desktop.cpu) { toast('Primero monta la CPU.', '⚠'); return; }
      st.desktop.paste = true;
    } else st.laptop.paste = true;
    tone(60, 0, 750); toast('Pasta aplicada: un punto del tamaño de un guisante en el centro.', '💧');
    changed();
  }

  function peelCoolerPlastic() {
    if (st.device !== 'desktop' || !st.desktop.cooler) { toast('No hay disipador montado.', 'ℹ'); return; }
    const c = it('cooler', st.desktop.cooler);
    if (!c.film) { toast('Este disipador no trae lámina protectora.', 'ℹ'); return; }
    st.desktop.filmRemoved = true;
    tone(80, 0, 600); toast('Lámina protectora retirada de la base del disipador.', '✨');
    changed();
  }

  function cleanThermalPaste() {
    if (st.device === 'desktop') st.desktop.paste = false; else st.laptop.paste = false;
    tone(60, 0, 680);
    logPost('Pasta vieja retirada con alcohol isopropílico y paño sin pelusa. Aplica pasta nueva antes de montar.', 'info');
    toast('Superficie limpia con isopropílico. Falta pasta nueva.', '🧪');
    changed();
  }

  function toggleEsdStrap() {
    st.esd = !st.esd;
    tone(50, 0, st.esd ? 900 : 400);
    toast(st.esd ? 'Pulsera conectada al chasis.' : 'Pulsera desconectada: riesgo de descarga electrostática.', '⚡');
    renderAll();
  }

  function cleanAirDuster() {
    tone(300, 0, 1800, 'sawtooth');
    logPost('Aire comprimido en ranuras y ventiladores (sujeta las aspas para que no giren y generen corriente).', 'info');
    toast('Polvo fuera.', '💨');
  }

  function replaceCmos() {
    if (st.device !== 'desktop') return;
    if (ui.power) { toast('Apaga el equipo y desenchufa la fuente antes de cambiar la pila.', '⚠'); return; }
    H.replaceCmos(st);
    tone(60, 0, 900); toast('Pila CR2032 nueva (≈3,05 V). Toca volver a configurar la BIOS.', '🔋');
    changed();
  }

  function toggleLaptopBattery() { st.laptop.battery = !st.laptop.battery; tone(60, 0, st.laptop.battery ? 900 : 500); toast(st.laptop.battery ? 'Batería conectada a la placa.' : 'Batería desconectada.', '🔋'); changed(); }
  function toggleLaptopAc() { st.laptop.ac = !st.laptop.ac; tone(60, 0, st.laptop.ac ? 900 : 500); toast(st.laptop.ac ? 'Cargador enchufado: la placa tiene tensión aunque la batería esté desconectada.' : 'Cargador desenchufado.', '🔌'); changed(); }
  function toggleLaptopWifiAntennas() { st.laptop.antennas = !st.laptop.antennas; tone(50, 0, 700); toast(`Antenas Wi-Fi (Main/Aux): ${st.laptop.antennas ? 'conectadas' : 'sueltas'}`, '📡'); changed(); }

  function toggleLaptopThermalScrews() {
    const s = st.laptop.screws;
    if (s.every(Boolean)) { st.laptop.screws = [false, false, false, false]; toast('Tornillos del disipador aflojados.', '🔩'); }
    else { const n = s.indexOf(false); s[n] = true; toast(`Tornillo ${n + 1} apretado${n < 3 ? ` (sigue con el ${n + 2})` : ': disipador asentado'}.`, '🔩'); }
    tone(70, 0, 850);
    changed();
  }

  function replaceLaptopBoard() {
    if (!st.laptop.dead) { toast('La placa funciona: no hace falta cambiarla.', 'ℹ'); return; }
    H.replaceLaptopBoard(st);
    toast('Placa sustituida en el taller. Esta vez, desconecta la batería y el cargador antes de tocar.', '🛠');
    changed();
  }

  function resetAssembly() {
    const fresh = H.createState();
    if (st.device === 'desktop') st.desktop = fresh.desktop; else st.laptop = Object.assign(fresh.laptop, { battery: false, ram: [null, null], nvme: null });
    toast('Banco desmontado.', '🧹');
    changed();
  }

  function loadOptimalBuild() {
    if (st.device === 'desktop') H.optimalDesktop(st); else H.optimalLaptop(st);
    toast('Configuración de ejemplo compatible cargada.', '⚡');
    changed();
  }

  function setDevice(dev) {
    st.device = dev;
    document.querySelectorAll('[data-device]').forEach((b) => b.classList.toggle('is-active', b.dataset.device === dev));
    $('schematic-title').textContent = dev === 'desktop' ? 'Placa base ATX (vista superior)' : 'Portátil con la tapa inferior abierta';
    $('desktop-cables-panel').classList.toggle('hidden', dev !== 'desktop');
    $('laptop-controls-panel').classList.toggle('hidden', dev !== 'laptop');
    $('desktop-tools').classList.toggle('hidden', dev !== 'desktop');
    changed();
  }

  // ==========================================================================
  // DIBUJO DEL BANCO
  // ==========================================================================

  function renderCanvas() {
    $('svg-host').innerHTML = st.device === 'desktop' ? desktopSvg() : laptopSvg();
    const d = st.desktop;
    const mobo = it('mobo', d.mobo);
    $('socket-badge').textContent = st.device === 'desktop' ? `Socket ${mobo.socket}` : 'CPU soldada';
    const n = (st.device === 'desktop' ? d.ram : st.laptop.ram).filter((r) => r && r.latched).length;
    $('ram-type-badge').textContent = st.device === 'desktop' ? `${mobo.ddr} · ${n} módulo${n === 1 ? '' : 's'}` : `DDR5 SO-DIMM · ${n}`;
    // las clases de los cables
    const cab = { atx24: 'btn-cable-atx24', eps8: 'btn-cable-eps8', pcie: 'btn-cable-pcie', fpanel: 'btn-cable-fpanel' };
    Object.entries(cab).forEach(([k, id]) => $(id).classList.toggle('is-on', !!d.cables[k]));
    $('btn-laptop-battery').classList.toggle('is-on', st.laptop.battery);
    $('btn-laptop-battery-label').textContent = st.laptop.battery ? 'Batería conectada' : 'Batería desconectada';
    $('btn-laptop-ac').classList.toggle('is-on', st.laptop.ac);
    $('btn-laptop-ac-label').textContent = st.laptop.ac ? 'Cargador enchufado' : 'Cargador fuera';
    $('btn-laptop-board').classList.toggle('hidden', !st.laptop.dead);
    $('tool-paste-status').textContent = (st.device === 'desktop' ? d.paste : st.laptop.paste) ? 'Aplicada ✔' : 'Sin aplicar';
    $('tool-peel-status').textContent = d.cooler && it('cooler', d.cooler).film ? (d.filmRemoved ? 'Retirada ✔' : '¡Quitar!') : '—';
    $('tool-esd-status').textContent = st.esd ? 'Conectada' : 'Sin conectar';
    $('tool-cmos-status').textContent = `${d.cmosV.toFixed(2)} V`;
  }

  function desktopSvg() {
    const d = st.desktop;
    const mobo = it('mobo', d.mobo), cpu = it('cpu', d.cpu), cooler = it('cooler', d.cooler), gpu = it('gpu', d.gpu), psu = it('psu', d.psu), nvme = it('storage', d.nvme);
    const spin = ui.power ? 'fan-spin' : '';
    const ram = d.ram.map((r) => r ? { m: it('ram', r.id), latched: r.latched } : null);
    const slotX = [500, 535, 570, 605];
    const hexFill = ui.postHex === 'AA' ? '#10b981' : ui.postHex === '--' ? '#64748b' : ['00', '55', 'd6'].includes(ui.postHex) ? '#ef4444' : '#38bdf8';
    const ledFill = (i, c) => (ui.leds[i] ? c : '#1e293b');
    const cable = (on) => [on ? '#065f46' : '#1e293b', on ? '#10b981' : '#ef4444'];
    return `<svg viewBox="0 0 800 680" class="w-full h-full max-h-[580px] drop-shadow-2xl select-none" role="img" aria-label="Placa base con los componentes montados">
      <defs>
        <pattern id="pcbGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#132338" stroke-width="0.75"/></pattern>
        <linearGradient id="heatsinkMetal" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e293b"/><stop offset="50%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
      </defs>
      <rect x="40" y="20" width="720" height="640" rx="12" fill="#090d16" stroke="#1e293b" stroke-width="3"/>
      <rect x="40" y="20" width="720" height="640" fill="url(#pcbGrid)" opacity="0.6"/>
      <g fill="#f59e0b" opacity="0.8">${[[65, 45], [400, 45], [735, 45], [65, 340], [400, 340], [735, 340], [65, 635], [400, 635], [735, 635]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" stroke="#78350f" stroke-width="2"/>`).join('')}</g>
      <rect x="42" y="35" width="45" height="230" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
      <text x="65" y="150" fill="#64748b" font-size="10" font-family="monospace" text-anchor="middle" transform="rotate(-90 65 150)">PANEL TRASERO E/S</text>
      <rect x="95" y="48" width="45" height="172" rx="4" fill="url(#heatsinkMetal)" stroke="#475569"/>
      <rect x="150" y="48" width="175" height="30" rx="4" fill="url(#heatsinkMetal)" stroke="#475569"/>
      <text x="237" y="67" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">VRM</text>
      <g data-act="toggleCable" data-args='["eps8"]' class="cursor-pointer"><rect x="98" y="24" width="48" height="20" rx="2" fill="${cable(d.cables.eps8)[0]}" stroke="${cable(d.cables.eps8)[1]}" stroke-width="1.5"/><text x="122" y="38" fill="#e2e8f0" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">EPS 8P</text></g>
      <g data-act="filterCatalog" data-args='["cpu"]' class="cursor-pointer">
        <rect x="170" y="90" width="150" height="150" rx="6" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
        <rect x="180" y="100" width="130" height="130" fill="#090a0f" stroke="#334155"/>
        <polygon points="183,103 193,103 183,113" fill="#f59e0b"/>
        <rect x="322" y="100" width="6" height="130" rx="3" fill="#94a3b8"/>
        ${cpu ? `<rect x="185" y="105" width="120" height="120" rx="4" fill="#334155" stroke="#94a3b8" stroke-width="2"/>
          <text x="245" y="150" fill="#38bdf8" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">${esc(cpu.name.replace(/^(AMD|Intel) /, ''))}</text>
          <text x="245" y="168" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">${esc(cpu.socket)} · ${cpu.tdp}–${cpu.maxPower} W</text>
          <text x="245" y="185" fill="#f59e0b" font-size="8" font-family="monospace" text-anchor="middle">▲ triángulo = pin 1</text>`
        : `<text x="245" y="165" fill="#64748b" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">ZÓCALO ${esc(mobo.socket)}</text><text x="245" y="182" fill="#475569" font-size="9" text-anchor="middle">(clic: elegir CPU)</text>`}
        ${cpu && d.paste && !cooler ? '<circle cx="245" cy="160" r="14" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2" opacity="0.9"/><text x="245" y="163" fill="#0f172a" font-size="8" font-weight="bold" text-anchor="middle">PASTA</text>' : ''}
        ${cooler ? `<g class="${spin}"><circle cx="245" cy="165" r="62" fill="#0f172a" stroke="#0ea5e9" stroke-width="3"/><circle cx="245" cy="165" r="48" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
          <path d="M 245 165 Q 260 130 280 135 Q 265 155 245 165 Z" fill="#0284c7" opacity="0.75"/><path d="M 245 165 Q 280 180 275 200 Q 255 185 245 165 Z" fill="#0284c7" opacity="0.75"/>
          <path d="M 245 165 Q 230 200 210 195 Q 225 175 245 165 Z" fill="#0284c7" opacity="0.75"/><path d="M 245 165 Q 210 150 215 130 Q 235 145 245 165 Z" fill="#0284c7" opacity="0.75"/>
          <circle cx="245" cy="165" r="18" fill="#0284c7" stroke="#ffffff"/></g>
          ${cooler.film && !d.filmRemoved ? '<rect x="195" y="210" width="100" height="18" rx="3" fill="#dc2626"/><text x="245" y="222" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">¡LÁMINA PUESTA!</text>' : ''}
          ${!d.paste ? '<rect x="195" y="98" width="100" height="16" rx="3" fill="#b45309"/><text x="245" y="109" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">SIN PASTA</text>' : ''}` : ''}
      </g>
      <g data-act="filterCatalog" data-args='["ram"]' class="cursor-pointer">
        <text x="560" y="68" fill="#94a3b8" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">MEMORIA ${esc(mobo.ddr)}</text>
        ${slotX.map((x, i) => `<rect x="${x}" y="85" width="16" height="180" rx="2" fill="${i % 2 ? '#0f172a' : '#1e293b'}" stroke="${i % 2 ? '#06b6d4' : '#475569'}" stroke-width="${i % 2 ? 1.5 : 1}"/>
          <line x1="${x}" y1="${mobo.ddr === 'DDR5' ? 172 : 160}" x2="${x + 16}" y2="${mobo.ddr === 'DDR5' ? 172 : 160}" stroke="#f59e0b" stroke-width="2"/>
          ${ram[i] ? `<rect x="${x + 2}" y="${ram[i].latched ? 90 : 78}" width="12" height="170" rx="1" fill="${ram[i].latched ? '#0284c7' : '#7c2d12'}" stroke="${ram[i].latched ? '#38bdf8' : '#f97316'}"/>` : ''}
          <text x="${x + 8}" y="276" fill="${i % 2 ? '#06b6d4' : '#64748b'}" font-size="8" font-family="monospace" text-anchor="middle">${H.SLOT_NAMES[i].replace('DIMM_', '')}</text>`).join('')}
        <text x="560" y="290" fill="#06b6d4" font-size="8" font-family="monospace" text-anchor="middle">A2 y B2: primero (manual de la placa)</text>
      </g>
      <g data-act="toggleCable" data-args='["atx24"]' class="cursor-pointer"><rect x="680" y="100" width="28" height="150" rx="3" fill="${cable(d.cables.atx24)[0]}" stroke="${cable(d.cables.atx24)[1]}" stroke-width="2"/><text x="694" y="175" fill="#f8fafc" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle" transform="rotate(90 694 175)">ATX 24 PINES</text></g>
      <rect x="665" y="30" width="55" height="40" rx="4" fill="#000000" stroke="#334155" stroke-width="1.5"/>
      <text id="svg-post-hex-text" x="692" y="58" fill="${hexFill}" font-size="24" font-family="monospace" font-weight="900" text-anchor="middle">${esc(ui.postHex)}</text>
      <text x="692" y="25" fill="#94a3b8" font-size="7" font-family="monospace" text-anchor="middle">Q-CODE</text>
      <g transform="translate(670, 270)">
        <text x="25" y="-5" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">LEDs</text>
        ${[['cpu', 'CPU', '#ef4444'], ['dram', 'DRAM', '#f59e0b'], ['vga', 'VGA', '#f8fafc'], ['boot', 'BOOT', '#10b981']].map(([k, l, c], i) => `<circle id="svg-ezled-${k}" cx="10" cy="${10 + i * 15}" r="4" fill="${ledFill(i, c)}" stroke="#475569"/><text x="25" y="${13 + i * 15}" fill="#cbd5e1" font-size="7" font-family="monospace">${l}</text>`).join('')}
      </g>
      <g data-act="replaceCmos" class="cursor-pointer"><circle cx="460" cy="420" r="18" fill="#cbd5e1" stroke="${d.cmosV < 2.5 ? '#ef4444' : '#64748b'}" stroke-width="2"/><text x="460" y="423" fill="#0f172a" font-size="7" font-weight="bold" text-anchor="middle">CR2032</text><text x="460" y="450" fill="${d.cmosV < 2.5 ? '#f87171' : '#64748b'}" font-size="7" font-family="monospace" text-anchor="middle">${d.cmosV.toFixed(2)} V</text></g>
      <g data-act="filterCatalog" data-args='["storage"]' class="cursor-pointer" transform="translate(180, 260)">
        <rect x="0" y="0" width="220" height="35" rx="3" fill="#1e293b" stroke="#475569"/>
        <text x="100" y="22" fill="#94a3b8" font-size="9" font-family="monospace" text-anchor="middle">M.2_1 (NVMe 2280)</text>
        <circle cx="210" cy="17" r="4" fill="#cbd5e1" stroke="#000000"/>
        ${nvme ? `<rect x="5" y="4" width="200" height="27" rx="2" fill="#047857" stroke="#10b981"/><text x="100" y="21" fill="#ffffff" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">${esc(nvme.name)}</text><circle cx="200" cy="17" r="3.5" fill="#f59e0b"/>` : ''}
      </g>
      <g data-act="filterCatalog" data-args='["gpu"]' class="cursor-pointer">
        <rect x="120" y="320" width="380" height="22" rx="3" fill="#0f172a" stroke="#0284c7" stroke-width="1.5"/>
        <rect x="130" y="324" width="300" height="14" fill="#000000"/>
        <rect x="505" y="318" width="18" height="26" rx="3" fill="#0369a1"/>
        <text x="310" y="335" fill="#38bdf8" font-size="9" font-family="monospace" text-anchor="middle">PCIe x16</text>
        ${gpu ? `<g transform="translate(110, 310)"><rect x="0" y="0" width="440" height="95" rx="6" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/><rect x="10" y="10" width="420" height="75" fill="#1e293b" opacity="0.85"/>
          ${[75, 210, 345].map((x) => `<g class="${spin}"><circle cx="${x}" cy="47" r="32" fill="#090d16" stroke="#475569"/><line x1="${x}" y1="20" x2="${x}" y2="74" stroke="#38bdf8" stroke-width="2"/><line x1="${x - 27}" y1="47" x2="${x + 27}" y2="47" stroke="#38bdf8" stroke-width="2"/></g>`).join('')}
          <rect x="120" y="70" width="180" height="18" rx="3" fill="#000000" opacity="0.8"/><text x="210" y="83" fill="#ffffff" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">${esc(gpu.name.replace(/^(NVIDIA GeForce|AMD Radeon) /, ''))}</text>
          ${gpu.needsPower ? `<g data-act="toggleCable" data-args='["pcie"]' class="cursor-pointer"><rect x="350" y="-14" width="78" height="18" rx="2" fill="${d.cables.pcie ? '#065f46' : '#991b1b'}" stroke="${d.cables.pcie ? '#10b981' : '#ef4444'}" stroke-width="1.5"/><text x="389" y="-1" fill="#ffffff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">${gpu.id === 'rtx_4080' ? '12V-2x6' : '2× 8 PINES'}</text></g>` : ''}
        </g>` : ''}
      </g>
      <rect x="520" y="470" width="160" height="110" rx="6" fill="url(#heatsinkMetal)" stroke="#475569" stroke-width="1.5"/>
      <text x="600" y="520" fill="#94a3b8" font-size="11" font-family="monospace" font-weight="bold" text-anchor="middle">${esc(mobo.name.split('·')[1] ? mobo.name.split('·')[1].trim().split(' ')[1] : '')}</text>
      <text x="600" y="538" fill="#06b6d4" font-size="9" font-family="monospace" text-anchor="middle">chipset</text>
      <g data-act="toggleCable" data-args='["fpanel"]' class="cursor-pointer" transform="translate(600, 615)"><rect x="0" y="0" width="110" height="22" rx="2" fill="${d.cables.fpanel ? '#0f172a' : '#450a0a'}" stroke="${d.cables.fpanel ? '#334155' : '#ef4444'}"/><text x="55" y="15" fill="#f59e0b" font-size="8" font-family="monospace" text-anchor="middle">F_PANEL (PWR/RST)</text></g>
      <g data-act="filterCatalog" data-args='["psu"]' class="cursor-pointer" transform="translate(60, 480)">
        <rect x="0" y="0" width="240" height="160" rx="8" fill="#090d16" stroke="${psu ? '#0ea5e9' : '#334155'}" stroke-width="2"/>
        <circle cx="120" cy="80" r="55" fill="#000000" stroke="#1e293b" stroke-width="2"/>
        <g class="${spin}"><line x1="75" y1="80" x2="165" y2="80" stroke="#334155" stroke-width="2"/><line x1="120" y1="35" x2="120" y2="125" stroke="#334155" stroke-width="2"/><circle cx="120" cy="80" r="16" fill="#1e293b"/></g>
        <text x="120" y="148" fill="#e2e8f0" font-size="10" font-family="monospace" font-weight="bold" text-anchor="middle">${psu ? esc(psu.name) : 'BAHÍA DE LA FUENTE VACÍA'}</text>
      </g>
    </svg>`;
  }

  function laptopSvg() {
    const l = st.laptop;
    const spin = ui.power ? 'fan-spin-fast' : '';
    const nvme = it('storage', l.nvme);
    const ram = l.ram.map((r) => (r ? it('ram', r.id) : null));
    return `<svg viewBox="0 0 800 680" class="w-full h-full max-h-[580px] drop-shadow-2xl select-none" role="img" aria-label="Interior del portátil">
      <defs>
        <linearGradient id="laptopChassisGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#18181b"/><stop offset="100%" stop-color="#09090b"/></linearGradient>
        <linearGradient id="batteryGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#064e3b"/><stop offset="100%" stop-color="#022c22"/></linearGradient>
        <linearGradient id="copperPipe" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#d97706"/><stop offset="50%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
      </defs>
      <rect x="50" y="30" width="700" height="620" rx="16" fill="url(#laptopChassisGrad)" stroke="#3f3f46" stroke-width="3"/>
      <path d="M 80 60 L 720 60 L 720 380 L 80 380 Z" fill="${l.dead ? '#1c0a0a' : '#090d16'}" stroke="${l.dead ? '#7f1d1d' : '#1e293b'}" stroke-width="2"/>
      <rect x="150" y="38" width="500" height="20" rx="4" fill="#0f172a" stroke="#f59e0b"/>
      <text x="400" y="52" fill="#fbbf24" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">⚠ ANTES DE TOCAR: BATERÍA DESCONECTADA Y CARGADOR FUERA</text>
      ${l.dead ? '<text x="400" y="365" fill="#f87171" font-size="12" font-family="monospace" font-weight="bold" text-anchor="middle">PLACA DAÑADA POR CORTOCIRCUITO</text>' : ''}
      <g data-act="toggleLaptopBattery" class="cursor-pointer">
        <rect x="80" y="410" width="640" height="210" rx="10" fill="url(#batteryGrad)" stroke="${l.battery ? '#10b981' : '#f59e0b'}" stroke-width="2.5"/>
        <rect x="100" y="430" width="180" height="170" rx="6" fill="#000000" opacity="0.4"/><rect x="310" y="430" width="180" height="170" rx="6" fill="#000000" opacity="0.4"/><rect x="520" y="430" width="180" height="170" rx="6" fill="#000000" opacity="0.4"/>
        <text x="400" y="510" fill="#ffffff" font-size="16" font-family="monospace" font-weight="bold" text-anchor="middle">BATERÍA DE IONES DE LITIO</text>
        <text x="400" y="535" fill="${l.battery ? '#34d399' : '#fbbf24'}" font-size="12" font-family="monospace" text-anchor="middle">${l.battery ? '● CONECTADA (clic para desconectar)' : '○ DESCONECTADA'}</text>
        <g transform="translate(365, 385)"><rect x="0" y="0" width="70" height="25" rx="3" fill="${l.battery ? '#10b981' : '#991b1b'}" stroke="#ffffff" stroke-width="1.5"/><text x="35" y="16" fill="#ffffff" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">${l.battery ? 'CONECTOR' : 'SUELTO'}</text></g>
      </g>
      <g data-act="toggleLaptopAc" class="cursor-pointer" transform="translate(84, 70)"><rect x="0" y="0" width="70" height="26" rx="4" fill="${l.ac ? '#065f46' : '#1e293b'}" stroke="${l.ac ? '#10b981' : '#475569'}"/><text x="35" y="17" fill="#e2e8f0" font-size="8" font-family="monospace" text-anchor="middle">DC-IN ${l.ac ? '19 V' : '—'}</text></g>
      <g data-act="filterCatalog" data-args='["ram"]' class="cursor-pointer" transform="translate(110, 160)">
        <rect x="0" y="0" width="210" height="85" rx="4" fill="#090a0f" stroke="#0ea5e9" stroke-width="1.5"/>
        <text x="105" y="16" fill="#38bdf8" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">RANURAS SO-DIMM DDR5</text>
        ${[0, 1].map((i) => `<rect x="15" y="${25 + i * 28}" width="180" height="22" rx="2" fill="#1e293b" stroke="#475569"/><rect x="8" y="${27 + i * 28}" width="5" height="18" fill="#94a3b8"/><rect x="197" y="${27 + i * 28}" width="5" height="18" fill="#94a3b8"/>
          ${ram[i] ? `<rect x="18" y="${27 + i * 28}" width="174" height="18" rx="1" fill="#047857" stroke="#10b981"/><text x="105" y="${39 + i * 28}" fill="#ffffff" font-size="8" font-family="monospace" text-anchor="middle">${esc(ram[i].name)}</text>` : `<text x="105" y="${39 + i * 28}" fill="#64748b" font-size="8" font-family="monospace" text-anchor="middle">Ranura ${i + 1} vacía</text>`}`).join('')}
      </g>
      <g data-act="toggleLaptopThermalScrews" class="cursor-pointer" transform="translate(360, 90)">
        <path d="M 50 70 L 250 40 L 310 40" stroke="url(#copperPipe)" stroke-width="16" fill="none" stroke-linecap="round"/>
        <path d="M 50 110 L 250 65 L 310 65" stroke="url(#copperPipe)" stroke-width="16" fill="none" stroke-linecap="round"/>
        <rect x="10" y="45" width="110" height="100" rx="4" fill="#18181b" stroke="#f59e0b" stroke-width="1.5"/>
        <rect x="35" y="65" width="60" height="60" rx="2" fill="#1e293b" stroke="#00ffff"/>
        <text x="65" y="138" fill="#00ffff" font-size="7" font-family="monospace" font-weight="bold" text-anchor="middle">CHIP SIN IHS</text>
        ${l.paste ? '<circle cx="65" cy="95" r="12" fill="#94a3b8" opacity="0.85"/><text x="65" y="98" fill="#000000" font-size="7" font-weight="bold" text-anchor="middle">PASTA</text>' : ''}
        ${[[20, 55], [110, 135], [110, 55], [20, 135]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="7" fill="${l.screws[i] ? '#10b981' : '#ef4444'}"/><text x="${x}" y="${y + 3}" fill="#ffffff" font-size="8" font-weight="bold" text-anchor="middle">${i + 1}</text>`).join('')}
      </g>
      <g transform="translate(620, 80)"><rect x="0" y="0" width="90" height="90" rx="45" fill="#090a0f" stroke="#334155" stroke-width="2"/>
        <g class="${spin}"><circle cx="45" cy="45" r="38" fill="#18181b"/><line x1="45" y1="10" x2="45" y2="80" stroke="#64748b" stroke-width="2"/><line x1="10" y1="45" x2="80" y2="45" stroke="#64748b" stroke-width="2"/><line x1="20" y1="20" x2="70" y2="70" stroke="#64748b" stroke-width="2"/><line x1="70" y1="20" x2="20" y2="70" stroke="#64748b" stroke-width="2"/><circle cx="45" cy="45" r="14" fill="#0f172a" stroke="#0ea5e9" stroke-width="1.5"/></g>
        <text x="45" y="105" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">VENTILADOR</text></g>
      <g data-act="filterCatalog" data-args='["storage"]' class="cursor-pointer" transform="translate(110, 270)">
        <rect x="0" y="0" width="190" height="30" rx="3" fill="#1e293b" stroke="#475569"/>
        <text x="85" y="18" fill="#94a3b8" font-size="8" font-family="monospace" text-anchor="middle">M.2 NVMe (2280)</text>
        ${nvme ? `<rect x="4" y="3" width="170" height="24" rx="2" fill="#047857" stroke="#10b981"/><text x="85" y="18" fill="#ffffff" font-size="8" font-family="monospace" font-weight="bold" text-anchor="middle">${esc(nvme.name)}</text>` : ''}
      </g>
      <g data-act="toggleLaptopWifiAntennas" class="cursor-pointer" transform="translate(320, 270)">
        <rect x="0" y="0" width="70" height="50" rx="3" fill="#1e293b" stroke="#38bdf8"/>
        <text x="35" y="32" fill="#38bdf8" font-size="8" font-family="monospace" text-anchor="middle">WI-FI M.2</text>
        <circle cx="15" cy="10" r="3.5" fill="${l.antennas ? '#000000' : '#475569'}" stroke="#ffffff"/><circle cx="55" cy="10" r="3.5" fill="${l.antennas ? '#ffffff' : '#475569'}" stroke="#000000"/>
        <text x="15" y="22" fill="#cbd5e1" font-size="6" text-anchor="middle">MAIN</text><text x="55" y="22" fill="#cbd5e1" font-size="6" text-anchor="middle">AUX</text>
      </g>
    </svg>`;
  }

  // ==========================================================================
  // BIOS UEFI
  // ==========================================================================

  function openUefiBios(auto) {
    if (st.device !== 'desktop') { toast('En este simulador la BIOS está disponible en la torre.', 'ℹ'); return; }
    if (!ui.power || !ui.lastPost || !['ok', 'no-boot'].includes(ui.lastPost.outcome)) {
      toast('A la BIOS se entra pulsando Supr o F2 durante el arranque: el equipo tiene que estar encendido y pasar el POST.', 'ℹ');
      return;
    }
    tone(90, 0, 720);
    const b = H.biosInfo(st);
    $('uefi-mobo-name').textContent = b.mobo;
    $('uefi-cpu-name').textContent = b.cpu;
    $('uefi-cpu-freq').textContent = b.freq;
    $('uefi-socket-info').textContent = b.socket;
    $('uefi-fw').textContent = b.fw;
    $('uefi-total-ram').textContent = `${b.memTotal} GB ${b.memType} a ${b.speed} MT/s`;
    $('uefi-channels').textContent = b.channels;
    $('uefi-temp').textContent = `${ui.temp.toFixed(1)} °C`;
    $('uefi-dimm-slots').innerHTML = b.modules.map((m) => `<div class="p-2 rounded bg-slate-900 border ${m.module ? 'border-cyan-500/60' : 'border-slate-800'} text-center">
      <div class="text-[10px] text-slate-400">${esc(m.slot)}</div><div class="font-bold text-white text-[11px] mt-0.5">${m.module ? esc(m.module) : 'Vacía'}</div></div>`).join('');
    $('uefi-profile-name').textContent = b.profileName;
    $('uefi-expo-select').innerHTML = `<option value="off">Desactivado (JEDEC ${b.jedec} MT/s)</option><option value="on">${b.profileName} (${b.profileSpeed} MT/s)</option>`;
    $('uefi-expo-select').value = b.profileOn ? 'on' : 'off';
    const rail = (k) => H.dmmRead(st, k, true, false).value.toFixed(3);
    $('uefi-12v').textContent = `+${rail('atx_12v')} V`; $('uefi-5v').textContent = `+${rail('atx_5v')} V`; $('uefi-3v3').textContent = `+${rail('atx_3v3')} V`;
    $('uefi-boot-1').textContent = b.boot ? `Windows Boot Manager (${b.boot})` : 'Ninguno: no hay dispositivo de arranque';
    $('uefi-boot-1').className = b.boot ? 'text-white' : 'text-rose-400 font-bold';
    $('uefi-cmos-warning').classList.toggle('hidden', !(ui.lastPost && ui.lastPost.cmosLow));
    switchUefiTab(auto ? 'boot' : 'main');
    toggleModal('modal-uefi-bios', true);
  }

  function switchUefiTab(tab) {
    document.querySelectorAll('.uefi-nav-btn').forEach((b) => b.classList.toggle('uefi-tab-active', b.dataset.tab === tab));
    document.querySelectorAll('.uefi-tab-pane').forEach((p) => p.classList.toggle('hidden', p.id !== `uefi-tab-${tab}`));
  }

  function toggleExpoProfile(val) {
    st.desktop.profile = val === 'on';
    tone(60, 0, 880);
    toast(st.desktop.profile ? 'Perfil activado: se aplicará al guardar y reiniciar.' : 'Memoria a velocidad JEDEC.', '⚙');
  }

  function saveAndExitUefi() {
    toggleModal('modal-uefi-bios', false);
    logPost(`BIOS: cambios guardados (F10). Memoria a ${H.biosInfo(st).speed} MT/s. Reiniciando…`, 'info');
    powerOff(true);
    later(700, powerOn);
  }

  // ==========================================================================
  // TALLER DE AVERÍAS
  // ==========================================================================

  function setMode(mode) {
    ui.mode = mode;
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('is-active', b.dataset.mode === mode));
    $('challenge-box').classList.toggle('hidden', mode !== 'challenge');
    if (mode === 'challenge') loadScenario(ui.scenario || H.SCENARIOS[0].id);
    else toast('Montaje libre.', '🛠');
  }

  function loadScenario(id) {
    const sc = H.SCENARIOS.find((s) => s.id === id);
    if (!sc) return;
    ui.scenario = id;
    const fresh = H.createState();
    st.desktop = fresh.desktop; st.laptop = fresh.laptop;
    sc.setup(st);
    setDevice(st.device);
    $('challenge-scenario-select').value = id;
    $('challenge-title').textContent = sc.title;
    $('challenge-desc').textContent = sc.desc;
    $('challenge-clue').textContent = `Pista: ${sc.clue}`;
    $('challenge-clue').classList.add('hidden');
    setStatus('Avería pendiente de diagnosticar', 'text-rose-400');
    logPost(`>>> Nuevo ticket: ${sc.title}. Enciende el equipo y observa los síntomas.`, 'warn');
  }

  function setStatus(text, cls) {
    const e = $('challenge-resolution-status');
    e.textContent = text;
    e.className = `text-[10px] font-bold ${cls}`;
  }

  function checkChallengeFix(auto) {
    const sc = H.SCENARIOS.find((s) => s.id === ui.scenario);
    if (!sc) return;
    if (sc.verify(st, ui.lastPost, ui.lastStress)) {
      setStatus('✔ Avería resuelta', 'text-emerald-400');
      if (!auto || !ui._solved) { toast('¡Avería resuelta!', '🏆'); tone(100, 0, 523); tone(100, 120, 659); tone(200, 240, 784); }
      ui._solved = true;
      logPost('✔ TICKET CERRADO: reparación verificada.', 'info');
      return;
    }
    ui._solved = false;
    if (auto && sc.needsStress && ui.lastPost && ui.lastPost.outcome === 'ok' && !ui.lastStress) { setStatus('Arranca: ahora pasa la prueba de estrés para confirmar', 'text-amber-400'); return; }
    if (auto) return;
    setStatus(!ui.lastPost ? 'Enciende el equipo para comprobar la reparación' : 'La causa todavía no está corregida', 'text-rose-400');
    toast(!ui.lastPost ? 'Para comprobar una reparación, enciende el equipo después de cada cambio.' : 'Todavía falla algo. Mira el código POST, los LEDs y el registro.', '❌');
  }

  function checkScenarioHint() { if (ui.mode === 'challenge') checkChallengeFix(true); }
  function showClue() { $('challenge-clue').classList.toggle('hidden'); }

  function generateRandomFault() {
    const ids = H.SCENARIOS.map((s) => s.id).filter((x) => x !== ui.scenario);
    ui.scenario = ids[Math.floor(Math.random() * ids.length)];
    setMode('challenge');
    toast('Avería sorpresa asignada: diagnostícala con el display POST, los LEDs y los pitidos.', '🎲');
  }

  // ==========================================================================
  // EXAMEN Y CERTIFICADO
  // ==========================================================================

  function renderQuiz() {
    if (!ui.quiz) ui.quiz = H.shuffledQuiz(Date.now() & 0xffffffff);
    $('quiz-container').innerHTML = ui.quiz.map((q, qi) => {
      const sel = ui.quizAnswers[qi];
      const done = sel !== undefined;
      return `<div class="p-3 rounded-xl border ${done ? (sel === q.correct ? 'bg-emerald-950/30 border-emerald-600/60' : 'bg-rose-950/30 border-rose-600/60') : 'bg-slate-950/80 border-slate-800'} space-y-2">
        <div class="font-bold text-slate-100 flex items-start gap-2"><span class="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-code text-[10px] shrink-0">P${qi + 1}</span><span>${esc(q.q)}</span></div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">${q.options.map((o, oi) => {
          const cls = !done ? 'bg-slate-900 border border-slate-700/80 text-slate-300 hover:bg-slate-800' : oi === q.correct ? 'bg-emerald-900/70 border-2 border-emerald-500 text-white font-bold' : oi === sel ? 'bg-rose-900/70 border-2 border-rose-500 text-white font-bold' : 'bg-slate-950/50 border border-slate-800 text-slate-500 opacity-60';
          return `<button ${done ? 'disabled' : `data-act="selectQuizOption" data-args='[${qi},${oi}]'`} class="p-2 rounded-lg text-left text-[11px] ${cls}"><span class="font-code font-bold mr-1">${'ABCD'[oi]})</span> ${esc(o)}</button>`;
        }).join('')}</div>
        ${done ? `<div class="p-2 rounded-lg text-[10.5px] leading-tight ${sel === q.correct ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}"><strong>${sel === q.correct ? '✔ Correcto.' : '✖ Incorrecto.'}</strong> ${esc(q.why)}</div>` : ''}
      </div>`;
    }).join('');
    const score = quizScore();
    $('quiz-score-badge').textContent = `${score} / ${ui.quiz.length} aciertos · ${Object.keys(ui.quizAnswers).length} respondidas`;
  }

  function quizScore() { return ui.quiz ? ui.quiz.reduce((s, q, i) => s + (ui.quizAnswers[i] === q.correct ? 1 : 0), 0) : 0; }

  function selectQuizOption(qi, oi) {
    if (ui.quizAnswers[qi] !== undefined) return;
    ui.quizAnswers[qi] = oi;
    tone(ui.quiz[qi].correct === oi ? 100 : 250, 0, ui.quiz[qi].correct === oi ? 980 : 350);
    renderQuiz();
  }

  function resetQuiz() { ui.quiz = null; ui.quizAnswers = {}; renderQuiz(); toast('Examen reiniciado con las opciones en otro orden.', '🔄'); }

  function generateCertificate() {
    const answered = Object.keys(ui.quizAnswers).length;
    if (answered < ui.quiz.length) { toast(`Responde a todas las preguntas (${answered}/${ui.quiz.length}).`, '⚠'); return; }
    const name = $('quiz-name').value.trim().replace(/\s+/g, ' ').slice(0, 60);
    if (!name) { toast('Escribe tu nombre para el certificado.', '⚠'); $('quiz-name').focus(); return; }
    const score = quizScore();
    if (score < 5) { toast(`${score}/10: repasa las explicaciones y vuelve a intentarlo.`, '📚'); return; }
    $('cert-name').textContent = name;
    $('cert-score-display').textContent = `${score} / 10 · ${H.grade(score)}`;
    $('cert-date').textContent = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    [523, 659, 784, 1046].forEach((f, i) => tone(i === 3 ? 300 : 100, i * 130, f));
    toggleModal('modal-certificate', true);
  }

  function printCertificate() { document.body.classList.add('printing-cert'); window.print(); setTimeout(() => document.body.classList.remove('printing-cert'), 500); }

  // ==========================================================================
  // DESCARGA EN UN ÚNICO .HTML
  // ==========================================================================

  async function downloadSelfHTML() {
    if (window.HL_SINGLE_FILE) { toast('Ya es la versión de archivo único: guárdala con Ctrl+S.', 'ℹ'); return; }
    try {
      const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(u); return r; });
      const [html, css, core, app, logo] = await Promise.all([get('index.html').then((r) => r.text()), get('css/app.css').then((r) => r.text()), get('js/core.js').then((r) => r.text()), get('js/app.js').then((r) => r.text()), get('assets/logo.png').then((r) => r.blob())]);
      const uri = await new Promise((ok, ko) => { const f = new FileReader(); f.onload = () => ok(f.result); f.onerror = ko; f.readAsDataURL(logo); });
      const js = (s) => s.replace(/<\/script/gi, '<\\/script');
      const out = html
        .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; media-src \'none\'; base-uri \'none\'; form-action \'none\'" />')
        .replace('<link rel="stylesheet" href="css/app.css" />', () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`)
        .replace('<script src="js/core.js"></script>', () => `<script>window.HL_SINGLE_FILE = true;</script>\n<script>\n${js(core)}\n</script>`)
        .replace('<script src="js/app.js"></script>', () => `<script>\n${js(app)}\n</script>`)
        .split('assets/logo.png').join(uri);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'text/html;charset=utf-8' }));
      a.download = 'HardwareLab.html';
      document.body.appendChild(a); a.click(); a.remove();
      toast('Descargado HardwareLab.html: funciona sin conexión.', '📥');
    } catch (e) {
      toast('No se pudo empaquetar desde aquí (¿abierto como archivo local?). Descárgalo desde la web publicada.', '⚠');
    }
  }

  // ==========================================================================
  // ACCIONES (sin onclick en el HTML: compatible con la política CSP)
  // ==========================================================================

  const ACTIONS = {
    setDevice, setMode, togglePower, triggerReset, toggleModal, downloadSelfHTML, toggleThermalView, toggleMultimeter,
    openUefiBios: () => openUefiBios(false), generateRandomFault, applyThermalPaste, peelCoolerPlastic, cleanThermalPaste,
    toggleEsdStrap, cleanAirDuster, inspectSocketMacro: () => { tone(50, 0, 800); toggleModal('modal-socket-macro', true); },
    filterCatalog, resetAssembly, loadOptimalBuild, measurePoint, toggleCable, toggleLaptopBattery, toggleLaptopAc,
    toggleLaptopWifiAntennas, toggleLaptopThermalScrews, replaceLaptopBoard, replaceCmos, toggleLatch, installComponent, removeComponent,
    runStressTest, checkChallengeFix: () => checkChallengeFix(false), showClue, clearPostLog: () => { $('post-log-stream').innerHTML = ''; },
    switchUefiTab, saveAndExitUefi, resetQuiz, generateCertificate, printCertificate, selectQuizOption,
    toggleMute: () => { ui.muted = !ui.muted; $('icon-sound-on').classList.toggle('hidden', ui.muted); $('icon-sound-off').classList.toggle('hidden', !ui.muted); toast(ui.muted ? 'Altavoz silenciado.' : 'Altavoz activado.', ui.muted ? '🔇' : '🔊'); if (!ui.muted) tone(80, 0, 880); },
    playTestBeep: () => { tone(80, 0, 659); tone(120, 140, 880); },
    playPattern: (vendor, kind) => { if (kind === 'siren') siren(); else playBeepCode(H.BEEPS[vendor][kind]); },
  };
  const CHANGE = {
    setVolume: (v) => { ui.volume = parseFloat(v); },
    setBiosVendor: (v) => { st.biosVendor = v; toast(`Tabla de pitidos: ${v}`, '⚙'); renderGlossary(); },
    loadScenario: (v) => loadScenario(v),
    toggleExpoProfile,
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    initAudio();
    let args = [];
    try { args = el.dataset.args ? JSON.parse(el.dataset.args) : []; } catch (err) { args = []; }
    fn(...args);
  });
  document.addEventListener('change', (e) => { const f = CHANGE[e.target.dataset.change]; if (f) f(e.target.value); });
  document.addEventListener('input', (e) => { const f = CHANGE[e.target.dataset.input]; if (f) f(e.target.value); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { document.querySelectorAll('.hl-modal:not(.hidden)').forEach((m) => toggleModal(m.id, false)); return; }
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Delete' || e.key === 'F2') { e.preventDefault(); openUefiBios(false); }
    else if (e.key === 'F10' && !$('modal-uefi-bios').classList.contains('hidden')) { e.preventDefault(); saveAndExitUefi(); }
  });
  document.querySelectorAll('.hl-modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) toggleModal(m.id, false); }));

  function renderGlossary() {
    const rows = [];
    for (const v of ['AMI', 'Award']) for (const [k, label] of [['ok', 'POST correcto'], ['ram', 'Memoria no detectada'], ['vga', 'Sin vídeo']]) {
      rows.push(`<tr class="${v === st.biosVendor ? 'bg-cyan-950/30' : ''}"><td class="p-1.5 font-code">${v}</td><td class="p-1.5">${esc(H.BEEPS[v][k].label)}</td><td class="p-1.5">${label}</td><td class="p-1.5"><button data-act="playPattern" data-args='${JSON.stringify([v, k])}' class="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-700 text-[10px]">▶ Oír</button></td></tr>`);
    }
    rows.push('<tr><td class="p-1.5 font-code">Varias</td><td class="p-1.5">Sirena aguda/grave</td><td class="p-1.5">Alarma de temperatura (si la placa la tiene activada)</td><td class="p-1.5"><button data-act="playPattern" data-args=\'["AMI","siren"]\' class="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-700 text-[10px]">▶ Oír</button></td></tr>');
    $('beep-table-body').innerHTML = rows.join('');
    $('qcode-list').innerHTML = Object.entries(H.QCODES).map(([c, t]) => `<div class="p-2 rounded-lg bg-slate-950 border border-slate-800"><span class="font-code font-bold text-cyan-300">${c}</span> <span class="text-slate-300">${esc(t)}</span></div>`).join('');
  }

  function renderAll() {
    renderCanvas();
    renderCatalog();
    renderAudit();
    updateTelemetry();
    if (ui.dmm) measurePoint(ui.dmmPoint);
    if (ui.flir) updateThermal();
  }

  // Arranque
  $('challenge-scenario-select').innerHTML = H.SCENARIOS.map((s, i) => `<option value="${s.id}">Caso ${i + 1}: ${esc(s.title)}${s.device === 'laptop' ? ' (portátil)' : ''}</option>`).join('');
  renderGlossary();
  setDevice('desktop');
  setPowerUi(false, 'APAGADO');
  setPostHex('--', 'En espera', 'Equipo apagado');
  logPost('HardwareLab listo. Monta las piezas desde el catálogo (o pulsa «Preset óptimo») y enciende.', 'info');
  logPost('Para entrar en la BIOS: enciende y pulsa Supr o F2 cuando haya terminado el POST.', 'info');
})();
