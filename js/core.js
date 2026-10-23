/*!
 * HardwareLab — núcleo de simulación (sin DOM)
 * Copyright (c) 2026 Un Fantasma en el Sistema — Licencia MIT
 *
 * Catálogo, compatibilidad física, modelo eléctrico y térmico, secuencia POST,
 * multímetro, códigos de pitidos, averías y examen. Se usa en el navegador
 * (window.HL) y en Node (require) para las pruebas.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HL = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================================================
  // CATÁLOGO (datos de fabricante; potencias máximas sostenidas, no picos)
  // ==========================================================================

  const CATALOG = {
    cpu: [
      { id: 'r7_7800x3d', name: 'AMD Ryzen 7 7800X3D', vendor: 'AMD', socket: 'AM5', mem: ['DDR5'], tdp: 120, maxPower: 162, tjmax: 89, igpu: true, base: 4.2, boost: 5.0, desc: '8 núcleos / 16 hilos, 3D V-Cache. TDP 120 W (PPT 162 W). Gráficos Radeon básicos.' },
      { id: 'i9_14900k', name: 'Intel Core i9-14900K', vendor: 'Intel', socket: 'LGA1700', mem: ['DDR4', 'DDR5'], tdp: 125, maxPower: 253, tjmax: 100, igpu: true, base: 3.2, boost: 6.0, desc: '24 núcleos (8P + 16E) / 32 hilos. Base 125 W, hasta 253 W (PL2). UHD 770.' },
      { id: 'r5_5600x', name: 'AMD Ryzen 5 5600X', vendor: 'AMD', socket: 'AM4', mem: ['DDR4'], tdp: 65, maxPower: 88, tjmax: 95, igpu: false, base: 3.7, boost: 4.6, desc: '6 núcleos / 12 hilos, AM4. SIN gráficos integrados: necesita tarjeta gráfica.' },
      { id: 'i5_13400', name: 'Intel Core i5-13400', vendor: 'Intel', socket: 'LGA1700', mem: ['DDR4', 'DDR5'], tdp: 65, maxPower: 148, tjmax: 100, igpu: true, base: 2.5, boost: 4.6, desc: '10 núcleos (6P + 4E) / 16 hilos. Base 65 W, hasta 148 W. UHD 730.' },
    ],
    mobo: [
      { id: 'am5_x670e', name: 'Placa AM5 · chipset X670E (ATX)', socket: 'AM5', ddr: 'DDR5', form: 'ATX', fw: 'AGESA ComboAM5PI 1.2.0.2', desc: 'Socket AM5, 4 ranuras DDR5, display de códigos POST y LEDs de diagnóstico.' },
      { id: 'lga1700_z790', name: 'Placa LGA1700 · chipset Z790 (ATX)', socket: 'LGA1700', ddr: 'DDR5', form: 'ATX', fw: 'Microcódigo Intel 0x129', desc: 'Socket LGA1700, 4 ranuras DDR5, display de códigos POST y LEDs de diagnóstico.' },
      { id: 'am4_b550', name: 'Placa AM4 · chipset B550 (ATX)', socket: 'AM4', ddr: 'DDR4', form: 'ATX', fw: 'AGESA ComboV2PI 1.2.0.B', desc: 'Socket AM4, 4 ranuras DDR4, PCIe 4.0. Display POST y LEDs de diagnóstico.' },
    ],
    ram: [
      { id: 'dimm_ddr5_16', name: 'DIMM DDR5 16 GB · 6000 MT/s', ddr: 'DDR5', form: 'DIMM', gb: 16, jedec: 4800, profile: 6000, desc: 'Sobremesa. Muesca casi centrada. Arranca a 4800 MT/s (JEDEC); 6000 con perfil XMP/EXPO.' },
      { id: 'dimm_ddr4_8', name: 'DIMM DDR4 8 GB · 3200 MT/s', ddr: 'DDR4', form: 'DIMM', gb: 8, jedec: 2133, profile: 3200, desc: 'Sobremesa. Muesca desplazada respecto a DDR5. Arranca a 2133 MT/s; 3200 con XMP.' },
      { id: 'sodimm_ddr5_16', name: 'SO-DIMM DDR5 16 GB · 5600 MT/s', ddr: 'DDR5', form: 'SO-DIMM', gb: 16, jedec: 5600, profile: 5600, desc: 'Portátil. Módulo corto de 262 contactos.' },
      { id: 'sodimm_ddr4_8', name: 'SO-DIMM DDR4 8 GB · 3200 MT/s', ddr: 'DDR4', form: 'SO-DIMM', gb: 8, jedec: 3200, profile: 3200, desc: 'Portátil antiguo. 260 contactos, muesca distinta de DDR5.' },
    ],
    gpu: [
      { id: 'rtx_4080', name: 'NVIDIA GeForce RTX 4080', tbp: 320, connector: '16 pines (12VHPWR / 12V-2x6)', needsPower: true, recommendedPsu: 750, desc: '16 GB GDDR6X. 320 W. Fuente recomendada por NVIDIA: 750 W.' },
      { id: 'rx_7800xt', name: 'AMD Radeon RX 7800 XT', tbp: 263, connector: '2 × 8 pines PCIe', needsPower: true, recommendedPsu: 700, desc: '16 GB GDDR6. 263 W. Fuente recomendada por AMD: 700 W.' },
      { id: 'gtx_1650', name: 'NVIDIA GeForce GTX 1650', tbp: 75, connector: 'ninguno (solo ranura)', needsPower: false, recommendedPsu: 300, desc: '4 GB. 75 W: se alimenta solo por la ranura PCIe x16.' },
    ],
    cooler: [
      { id: 'aio_360', name: 'Refrigeración líquida AIO 360 mm', capacity: 300, film: true, desc: 'Radiador de 360 mm. Base de cobre con lámina protectora.' },
      { id: 'air_tower', name: 'Disipador de torre doble (140 mm)', capacity: 250, film: true, desc: 'Torre de heatpipes de gama alta. Base con lámina protectora.' },
      { id: 'air_stock', name: 'Disipador de serie de perfil bajo', capacity: 65, film: false, desc: 'El que viene en la caja de las CPU de 65 W. Pasta ya aplicada de fábrica.' },
      { id: 'passive_25', name: 'Bloque pasivo sin ventilador', capacity: 25, film: false, desc: 'Solo para chips de muy bajo consumo (≈25 W).' },
    ],
    psu: [
      { id: 'psu_1000', name: 'Fuente 1000 W 80 PLUS Platinum', watts: 1000, desc: 'ATX 3.x, conector 12V-2x6 nativo.' },
      { id: 'psu_850', name: 'Fuente 850 W 80 PLUS Gold', watts: 850, desc: 'Modular. Buena opción para gráficas de gama alta.' },
      { id: 'psu_650', name: 'Fuente 650 W 80 PLUS Gold', watts: 650, desc: 'Gama media.' },
      { id: 'psu_450', name: 'Fuente genérica 450 W', watts: 450, desc: 'Sin certificación. Corta por sobrepotencia (OPP) con equipos exigentes.' },
    ],
    storage: [
      { id: 'nvme_2tb', name: 'SSD NVMe PCIe 4.0 · 2 TB', form: 'M.2 2280', desc: 'Con caché DRAM. Lleva el sistema operativo instalado.' },
      { id: 'nvme_1tb', name: 'SSD NVMe PCIe 4.0 · 1 TB', form: 'M.2 2280', desc: 'Vale para sobremesa y portátil.' },
    ],
  };

  const LAPTOP = { cpu: { name: 'CPU de portátil (soldada a la placa)', tjmax: 100, postPower: 15, maxPower: 45 }, cooler: 50, ddr: 'DDR5', ramForm: 'SO-DIMM' };
  const SLOT_NAMES = ['DIMM_A1', 'DIMM_A2', 'DIMM_B1', 'DIMM_B2'];

  function item(cat, id) {
    return (CATALOG[cat] || []).find((x) => x.id === id) || null;
  }

  // ==========================================================================
  // ESTADO
  // ==========================================================================

  function createState() {
    return {
      device: 'desktop',
      biosVendor: 'AMI',
      esd: true,
      desktop: {
        mobo: 'am5_x670e', cpu: null, paste: false, cooler: null, filmRemoved: false,
        ram: [null, null, null, null], nvme: null, gpu: null, psu: null,
        cables: { atx24: false, eps8: false, pcie: false, fpanel: true },
        cmosV: 3.05, profile: false,
      },
      laptop: {
        battery: true, ac: false, dead: false, everDamaged: false, ram: [null, null], nvme: null,
        paste: true, screws: [true, true, true, true], antennas: true,
      },
    };
  }

  function cloneState(st) { return JSON.parse(JSON.stringify(st)); }

  function optimalDesktop(st) {
    const d = st.desktop;
    Object.assign(d, {
      mobo: 'am5_x670e', cpu: 'r7_7800x3d', paste: true, cooler: 'aio_360', filmRemoved: true,
      ram: [null, { id: 'dimm_ddr5_16', latched: true }, null, { id: 'dimm_ddr5_16', latched: true }],
      nvme: 'nvme_2tb', gpu: 'rtx_4080', psu: 'psu_850',
      cables: { atx24: true, eps8: true, pcie: true, fpanel: true }, cmosV: 3.05, profile: false,
    });
    return st;
  }

  function optimalLaptop(st) {
    Object.assign(st.laptop, {
      battery: true, ac: false, dead: false, everDamaged: false,
      ram: [{ id: 'sodimm_ddr5_16', latched: true }, { id: 'sodimm_ddr5_16', latched: true }],
      nvme: 'nvme_1tb', paste: true, screws: [true, true, true, true], antennas: true,
    });
    return st;
  }

  // ==========================================================================
  // MONTAJE: lo que no encaja, no entra
  // ==========================================================================

  /** Comprueba si una pieza se puede montar. Devuelve { ok, reason, warn, damage }. */
  function canInstall(st, cat, id, slot) {
    const it = item(cat, id);
    if (!it) return { ok: false, reason: 'Pieza desconocida' };
    const warn = [];
    if (!st.esd) warn.push('Estás trabajando sin pulsera antiestática: una descarga que ni notas puede dañar la pieza sin dejar marca.');
    if (st.device === 'laptop') {
      if (cat !== 'ram' && cat !== 'storage') return { ok: false, reason: 'En este portátil la CPU, la gráfica y la fuente vienen soldadas o integradas: solo se pueden cambiar la memoria y el SSD.' };
      const l = st.laptop;
      if (cat === 'ram') {
        if (it.form !== 'SO-DIMM') return { ok: false, reason: 'Un DIMM de sobremesa (133 mm) no cabe en una ranura SO-DIMM de portátil (69,6 mm).' };
        if (it.ddr !== LAPTOP.ddr) return { ok: false, reason: `La muesca no coincide: la placa usa ${LAPTOP.ddr} y el módulo es ${it.ddr}. Forzarlo rompe la ranura.` };
        if (slot === undefined || slot < 0 || slot > 1) return { ok: false, reason: 'Ranura SO-DIMM no válida' };
        if (l.ram[slot]) return { ok: false, reason: `La ranura SO-DIMM ${slot + 1} ya está ocupada` };
      }
      const live = l.battery || l.ac;
      return { ok: true, warn, damage: live ? `Has tocado la placa con ${l.battery ? 'la batería conectada' : 'el cargador enchufado'}: las líneas de standby están vivas y el cortocircuito ha dañado la placa.` : null };
    }
    const d = st.desktop;
    const mobo = item('mobo', d.mobo);
    if (cat === 'cpu') {
      if (it.socket !== mobo.socket) return { ok: false, reason: `No encaja: la CPU es ${it.socket} y el zócalo de la placa es ${mobo.socket}. Forzarla dobla los pines del zócalo.` };
      if (!it.mem.includes(mobo.ddr)) return { ok: false, reason: `El controlador de memoria de la CPU no admite ${mobo.ddr}.` };
    }
    if (cat === 'mobo') {
      if (d.cpu && item('cpu', d.cpu).socket !== it.socket) return { ok: false, reason: `Quita antes la CPU: es ${item('cpu', d.cpu).socket} y la placa nueva es ${it.socket}.` };
      if (d.ram.some((r) => r && item('ram', r.id).ddr !== it.ddr)) return { ok: false, reason: `Quita antes la memoria: la placa nueva usa ${it.ddr}.` };
    }
    if (cat === 'ram') {
      if (it.form !== 'DIMM') return { ok: false, reason: 'Un SO-DIMM de portátil no encaja en una ranura DIMM de sobremesa.' };
      if (it.ddr !== mobo.ddr) return { ok: false, reason: `La muesca no coincide: la placa es ${mobo.ddr} y el módulo ${it.ddr}. DDR4 y DDR5 no son intercambiables.` };
      if (slot === undefined || slot < 0 || slot > 3) return { ok: false, reason: 'Ranura no válida' };
      if (d.ram[slot]) return { ok: false, reason: `${SLOT_NAMES[slot]} ya está ocupada` };
    }
    if (cat === 'cooler' && !d.cpu) return { ok: false, reason: 'Primero la CPU: el disipador se monta encima.' };
    return { ok: true, warn, damage: null };
  }

  /** Monta la pieza si se puede. Devuelve el resultado de canInstall. */
  function install(st, cat, id, slot) {
    const chk = canInstall(st, cat, id, slot);
    if (!chk.ok) return chk;
    if (st.device === 'laptop') {
      const l = st.laptop;
      if (chk.damage) { l.dead = true; l.everDamaged = true; }
      if (cat === 'ram') l.ram[slot] = { id, latched: true };
      else l.nvme = id;
      return chk;
    }
    const d = st.desktop;
    if (cat === 'ram') d.ram[slot] = { id, latched: true };
    else if (cat === 'mobo') d.mobo = id;
    else if (cat === 'storage') d.nvme = id;
    else {
      d[cat] = id;
      if (cat === 'cooler') {
        const c = item('cooler', id);
        d.filmRemoved = !c.film;
        if (!c.film) d.paste = true; // los disipadores de serie traen la pasta aplicada
      }
      if (cat === 'cpu') d.paste = false;
      if (cat === 'gpu') d.cables.pcie = false;
    }
    return chk;
  }

  function remove(st, cat, slot) {
    if (st.device === 'laptop') {
      const l = st.laptop;
      const live = l.battery || l.ac;
      if (cat === 'ram') l.ram[slot] = null;
      if (cat === 'storage') l.nvme = null;
      if (live) { l.dead = true; l.everDamaged = true; return { damage: 'Has extraído una pieza con la placa alimentada: cortocircuito y placa dañada.' }; }
      return {};
    }
    const d = st.desktop;
    if (cat === 'ram') d.ram[slot] = null;
    else if (cat === 'storage') d.nvme = null;
    else if (cat === 'cpu') { d.cpu = null; d.cooler = null; d.paste = false; }
    else if (cat === 'cooler') { d.cooler = null; }
    else if (cat === 'gpu') { d.gpu = null; d.cables.pcie = false; }
    else if (cat === 'psu') { d.psu = null; d.cables = { atx24: false, eps8: false, pcie: false, fpanel: d.cables.fpanel }; }
    return {};
  }

  /** Abre o cierra los pestillos de una ranura de memoria. */
  function toggleLatch(st, slot) {
    const slots = st.device === 'laptop' ? st.laptop.ram : st.desktop.ram;
    if (!slots[slot]) return false;
    slots[slot].latched = !slots[slot].latched;
    return slots[slot].latched;
  }

  function replaceCmos(st) { st.desktop.cmosV = 3.05; st.desktop.profile = false; }

  /** Sustituye la placa del portátil dañada (la avería queda registrada para los retos). */
  function replaceLaptopBoard(st) { st.laptop.dead = false; }

  // ==========================================================================
  // MODELO ELÉCTRICO
  // ==========================================================================

  function powerBudget(st) {
    if (st.device === 'laptop') return { idle: 12, load: 65, psu: 90, recommended: 90 };
    const d = st.desktop;
    const cpu = item('cpu', d.cpu), gpu = item('gpu', d.gpu), psu = item('psu', d.psu);
    const rest = 50; // placa, memoria, SSD, ventiladores
    const load = (cpu ? cpu.maxPower : 0) + (gpu ? gpu.tbp : 0) + rest;
    const idle = (cpu ? 30 : 0) + (gpu ? 20 : 0) + rest - 10;
    // Recomendación: carga sostenida + 30 % de margen para picos, redondeada a 50 W
    const recommended = Math.max(gpu ? gpu.recommendedPsu : 0, Math.ceil((load * 1.3) / 50) * 50);
    return { idle, load, psu: psu ? psu.watts : 0, recommended };
  }

  // ==========================================================================
  // MODELO TÉRMICO
  // ==========================================================================

  /** Calidad del contacto CPU-disipador (1 = perfecto, 0 = sin disipador). */
  function contactQuality(st) {
    if (st.device === 'laptop') {
      const l = st.laptop;
      let q = l.paste ? 1 : 0.3;
      if (!l.screws.every(Boolean)) q *= 0.25;
      return q;
    }
    const d = st.desktop;
    if (!d.cooler) return 0;
    const c = item('cooler', d.cooler);
    let q = 1;
    if (!d.paste) q *= 0.3;
    if (c.film && !d.filmRemoved) q *= 0.08;
    return q;
  }

  /**
   * Temperatura de la CPU a una potencia dada: T = 25 + 60·P / (capacidad·contacto).
   * Si supera Tjmax, la CPU baja su frecuencia (throttling) hasta la potencia que puede disipar;
   * si ni así se sostiene, salta la protección THERMTRIP y la placa se apaga.
   */
  function thermal(st, mode) {
    const lap = st.device === 'laptop';
    const cpu = lap ? LAPTOP.cpu : item('cpu', st.desktop.cpu);
    if (!cpu) return { temp: 25, status: 'no-cpu' };
    const capacity = lap ? LAPTOP.cooler : (st.desktop.cooler ? item('cooler', st.desktop.cooler).capacity : 0);
    const q = contactQuality(st);
    const P = mode === 'stress' ? cpu.maxPower : (lap ? cpu.postPower : 40);
    const k = capacity * q;
    if (k <= 0) return { temp: cpu.tjmax + 20, status: 'trip', power: P, tjmax: cpu.tjmax };
    const raw = 25 + (60 * P) / k;
    if (raw <= cpu.tjmax) return { temp: Math.round(raw), status: 'ok', power: P, tjmax: cpu.tjmax, clock: 100 };
    const sustainable = ((cpu.tjmax - 25) * k) / 60;
    if (mode !== 'stress') {
      // En POST/BIOS la carga es baja: solo se apaga si el contacto es casi nulo
      if (raw > cpu.tjmax + 40) return { temp: cpu.tjmax + 15, status: 'trip', power: P, tjmax: cpu.tjmax };
      return { temp: cpu.tjmax, status: 'throttle', power: P, tjmax: cpu.tjmax, clock: Math.round((sustainable / P) * 100) };
    }
    if (sustainable < 0.25 * P) return { temp: cpu.tjmax + 15, status: 'trip', power: P, tjmax: cpu.tjmax };
    return { temp: cpu.tjmax, status: 'throttle', power: P, tjmax: cpu.tjmax, clock: Math.round((sustainable / P) * 100) };
  }

  // ==========================================================================
  // PITIDOS Y CÓDIGOS
  // ==========================================================================

  // Tablas clásicas más citadas. Cada fabricante de placa puede variarlas: el manual manda.
  const BEEPS = {
    AMI: {
      ok: { label: '1 corto', seq: [['s']] },
      ram: { label: '3 cortos', seq: [['s'], ['s'], ['s']] },
      vga: { label: '8 cortos', seq: [['s'], ['s'], ['s'], ['s'], ['s'], ['s'], ['s'], ['s']] },
    },
    Award: {
      ok: { label: '1 corto', seq: [['s']] },
      ram: { label: 'largos repetidos', seq: [['l'], ['l'], ['l'], ['l']] },
      vga: { label: '1 largo + 2 cortos', seq: [['l'], ['s'], ['s']] },
    },
  };

  const QCODES = {
    '00': 'Sin ejecución de firmware (CPU sin alimentación EPS, sin CPU o CPU no soportada)',
    '15': 'Inicialización temprana del chipset / entrenamiento de memoria',
    '55': 'Memoria no instalada o no detectada',
    '92': 'Inicialización del bus PCI',
    'b2': 'Inicialización de las ROM de los dispositivos PCIe',
    'd6': 'Sin dispositivo de salida de vídeo',
    'A2': 'Detección de dispositivos de arranque (sin disco arrancable se queda aquí)',
    'AA': 'POST completado: control al cargador del sistema operativo / BIOS',
  };

  // ==========================================================================
  // POST
  // ==========================================================================

  function detectedModules(slots) {
    return slots.map((r, i) => ({ r, i })).filter((x) => x.r && x.r.latched);
  }

  /**
   * Calcula la secuencia de arranque. Cada paso: { hex, leds:[cpu,dram,vga,boot], log, type }.
   * Resultado: { steps, outcome, beep, powered, fans, toast }.
   * outcome: 'no-power' | 'halt-cpu' | 'thermtrip' | 'halt-dram' | 'halt-vga' | 'no-boot' | 'ok' | 'dead'
   */
  function postPlan(st) {
    const steps = [];
    const S = (hex, leds, log, type) => steps.push({ hex, leds, log, type: type || 'info' });
    const vendor = st.biosVendor;
    if (st.device === 'laptop') return postLaptop(st, steps, S, vendor);
    const d = st.desktop;
    const psu = item('psu', d.psu), cpu = item('cpu', d.cpu), mobo = item('mobo', d.mobo), gpu = item('gpu', d.gpu);
    if (!psu) return { steps: [{ hex: '--', leds: [0, 0, 0, 0], log: 'No hay fuente de alimentación instalada.', type: 'error' }], outcome: 'no-power', powered: false, fans: false, toast: 'No pasa nada: no hay fuente instalada.' };
    if (!d.cables.atx24) return { steps: [{ hex: '--', leds: [0, 0, 0, 0], log: 'El ATX de 24 pines no está conectado: la señal PS_ON# no llega a la fuente y esta no arranca. Ni siquiera giran los ventiladores.', type: 'error' }], outcome: 'no-power', powered: false, fans: false, toast: 'No enciende: falta el cable ATX de 24 pines.' };
    if (!d.cables.fpanel) return { steps: [{ hex: '--', leds: [0, 0, 0, 0], log: 'El botón de la caja no está conectado al F_PANEL de la placa: pulsarlo no hace nada.', type: 'error' }], outcome: 'no-power', powered: false, fans: false, toast: 'El botón no responde: revisa el conector del panel frontal (PWR_SW).' };

    S('--', [0, 0, 0, 0], 'PS_ON# a nivel bajo: la fuente arranca. PWR_OK llega tras 100–500 ms y la placa libera el RESET de la CPU.');
    if (!cpu) {
      S('00', [1, 0, 0, 0], 'Zócalo vacío: no hay procesador que ejecute el firmware. Sin CPU no puede sonar ningún pitido.', 'error');
      return { steps, outcome: 'halt-cpu', powered: true, fans: true, toast: 'Ventiladores girando, LED CPU fijo y display en 00: no hay CPU.' };
    }
    if (!d.cables.eps8) {
      S('00', [1, 0, 0, 0], 'Falta el EPS de 8 pines (12 V de la CPU): los reguladores VRM no alimentan el procesador. Ventiladores girando, LED CPU fijo, sin pitidos.', 'error');
      return { steps, outcome: 'halt-cpu', powered: true, fans: true, toast: 'LED CPU fijo y 00: revisa el EPS de 8 pines junto al zócalo.' };
    }
    S('15', [1, 0, 0, 0], `CPU ${cpu.name} detectada. Inicialización temprana del chipset.`);
    const th = thermal(st, 'post');
    if (th.status === 'trip') {
      S('15', [1, 0, 0, 0], `La temperatura de la CPU sube sin control (${d.cooler ? 'contacto con el disipador casi nulo' : 'no hay disipador'}). Supera Tjmax (${th.tjmax} °C) y salta THERMTRIP#: la placa corta la alimentación en segundos.`, 'error');
      return { steps, outcome: 'thermtrip', powered: false, fans: true, temp: th.temp, siren: true, toast: 'Apagado brusco por temperatura: revisa disipador, lámina protectora y pasta térmica.' };
    }
    S('15', [0, 1, 0, 0], 'Entrenando la memoria (lectura del SPD de cada módulo)…');
    const mods = detectedModules(d.ram);
    const loose = d.ram.map((r, i) => (r && !r.latched ? SLOT_NAMES[i] : null)).filter(Boolean);
    if (!mods.length) {
      S('55', [0, 1, 0, 0], loose.length ? `Ningún módulo detectado: ${loose.join(', ')} sin asentar (pestillos abiertos).` : 'No hay memoria instalada.', 'error');
      return { steps, outcome: 'halt-dram', powered: true, fans: true, beep: BEEPS[vendor].ram, toast: `55 y LED DRAM: memoria no detectada (${BEEPS[vendor].ram.label} en ${vendor}).` };
    }
    if (loose.length) S('15', [0, 1, 0, 0], `${loose.join(', ')} sin asentar: no se detecta y el equipo arranca con menos memoria.`, 'warn');
    const totalGb = mods.reduce((s, m) => s + item('ram', m.r.id).gb, 0);
    const dual = mods.some((m) => m.i < 2) && mods.some((m) => m.i >= 2);
    S('15', [0, 1, 0, 0], `${totalGb} GB detectados en ${mods.map((m) => SLOT_NAMES[m.i]).join(' + ')} · ${dual ? 'doble canal' : 'un solo canal'}.`);
    S('92', [0, 0, 1, 0], 'Enumerando el bus PCI Express…');
    const gpuOk = gpu ? (!gpu.needsPower || d.cables.pcie) : cpu.igpu;
    if (!gpuOk) {
      S('d6', [0, 0, 1, 0], gpu ? `La ${gpu.name} no tiene conectada su alimentación auxiliar (${gpu.connector}): no inicializa y no hay salida de vídeo.` : `${cpu.name} no tiene gráficos integrados y no hay tarjeta gráfica: no hay dispositivo de vídeo.`, 'error');
      return { steps, outcome: 'halt-vga', powered: true, fans: true, beep: BEEPS[vendor].vga, toast: `d6 y LED VGA: sin salida de vídeo (${BEEPS[vendor].vga.label} en ${vendor}).` };
    }
    S('b2', [0, 0, 1, 0], gpu ? `${gpu.name} inicializada.` : 'Gráficos integrados de la CPU inicializados.');
    if (th.status === 'throttle') S('b2', [0, 0, 1, 0], `CPU a ${th.temp} °C en reposo: está limitando su frecuencia. Algo falla en la refrigeración.`, 'warn');
    S('A2', [0, 0, 0, 1], 'Buscando dispositivos de arranque…');
    const cmosLow = d.cmosV < 2.5;
    if (cmosLow) S('A2', [0, 0, 0, 1], `CMOS checksum bad: la pila CR2032 está a ${d.cmosV.toFixed(2)} V. Se han cargado los valores por defecto y la fecha ha vuelto a 2020. Press F1 to Run SETUP.`, 'warn');
    if (!d.nvme) {
      S('A2', [0, 0, 0, 1], 'No hay ningún disco arrancable: el POST ha terminado bien, pero el equipo entra en la BIOS.', 'warn');
      return { steps, outcome: 'no-boot', powered: true, fans: true, beep: BEEPS[vendor].ok, cmosLow, toast: 'POST correcto pero sin disco de arranque: entra en la BIOS.' };
    }
    S('AA', [0, 0, 0, 0], `POST completado. Arrancando desde ${item('storage', d.nvme).name}.`);
    return { steps, outcome: 'ok', powered: true, fans: true, beep: BEEPS[vendor].ok, cmosLow, temp: th.temp, toast: cmosLow ? 'Arranca, pero pide F1 y olvida la configuración: pila CMOS agotada.' : 'POST correcto (AA): arrancando el sistema operativo.' };
  }

  function postLaptop(st, steps, S, vendor) {
    const l = st.laptop;
    if (l.dead) return { steps: [{ hex: '--', leds: [0, 0, 0, 0], log: 'La placa no responde: quedó dañada al manipularla con alimentación. Hay que sustituirla.', type: 'error' }], outcome: 'dead', powered: false, fans: false, toast: 'No hace nada: placa dañada por cortocircuito.' };
    if (!l.battery && !l.ac) return { steps: [{ hex: '--', leds: [0, 0, 0, 0], log: 'Ni batería conectada ni cargador: no hay alimentación.', type: 'warn' }], outcome: 'no-power', powered: false, fans: false, toast: 'Sin alimentación: conecta la batería o el cargador para encender.' };
    S('--', [0, 0, 0, 0], 'Encendido. Los portátiles no traen display POST: estos códigos son los que verías con una tarjeta de diagnóstico.');
    const th = thermal(st, 'post');
    if (th.status === 'trip') {
      S('15', [1, 0, 0, 0], 'La CPU se calienta sin control (sin pasta o disipador sin apretar) y salta la protección térmica.', 'error');
      return { steps, outcome: 'thermtrip', powered: false, fans: true, temp: th.temp, toast: 'Se apaga solo: revisa pasta térmica y tornillos del disipador.' };
    }
    const mods = detectedModules(l.ram);
    if (!mods.length) {
      S('55', [0, 1, 0, 0], 'No hay módulos SO-DIMM.', 'error');
      return { steps, outcome: 'halt-dram', powered: true, fans: true, beep: BEEPS[vendor].ram, toast: 'Sin memoria: el portátil no pasa del POST.' };
    }
    const totalGb = mods.reduce((s, m) => s + item('ram', m.r.id).gb, 0);
    S('15', [0, 1, 0, 0], `${totalGb} GB detectados${mods.length === 2 ? ' en doble canal' : ''}.`);
    if (th.status === 'throttle') S('15', [0, 1, 0, 0], `CPU a ${th.temp} °C en reposo: limitando frecuencia.`, 'warn');
    if (!l.antennas) S('92', [0, 0, 0, 0], 'Antenas Wi-Fi desconectadas: la tarjeta funciona pero apenas tendrá cobertura.', 'warn');
    if (!l.nvme) {
      S('A2', [0, 0, 0, 1], 'Sin SSD: entra en la BIOS.', 'warn');
      return { steps, outcome: 'no-boot', powered: true, fans: true, beep: BEEPS[vendor].ok, toast: 'POST correcto pero sin disco: entra en la BIOS.' };
    }
    S('AA', [0, 0, 0, 0], 'POST completado. Arrancando el sistema.');
    return { steps, outcome: 'ok', powered: true, fans: true, beep: BEEPS[vendor].ok, temp: th.temp, toast: 'Portátil arrancado.' };
  }

  // ==========================================================================
  // PRUEBA DE ESTRÉS (CPU + GPU al 100 %)
  // ==========================================================================

  function stressTest(st) {
    const post = postPlan(st);
    if (post.outcome !== 'ok' && post.outcome !== 'no-boot') return { ran: false, reason: 'El equipo tiene que pasar el POST antes de la prueba de estrés.' };
    const pb = powerBudget(st);
    const th = thermal(st, 'stress');
    const res = { ran: true, power: pb.load, psu: pb.psu, recommended: pb.recommended, temp: th.temp, clock: th.clock || 0, tjmax: th.tjmax, events: [] };
    if (st.device === 'desktop' && pb.load > pb.psu) {
      res.shutdown = 'opp';
      res.events.push(`El consumo sube a ${pb.load} W y la fuente es de ${pb.psu} W: salta la protección de sobrepotencia (OPP) y el equipo se apaga de golpe. Desde fuera parece un «reinicio» al empezar a jugar.`);
      return res;
    }
    if (th.status === 'trip') {
      res.shutdown = 'thermtrip';
      res.events.push(`La CPU llega a ${th.tjmax} °C y ni bajando la frecuencia puede disipar el calor: THERMTRIP apaga el equipo.`);
      return res;
    }
    if (th.status === 'throttle') res.events.push(`La CPU se mantiene en ${th.tjmax} °C rebajando su frecuencia al ${th.clock} %: funciona, pero rinde mucho menos (thermal throttling).`);
    else res.events.push(`CPU estable a ${th.temp} °C a plena carga.`);
    if (st.device === 'desktop') {
      const pct = Math.round((pb.load / pb.psu) * 100);
      res.events.push(pct > 90 ? `La fuente trabaja al ${pct} %: aguanta, pero sin margen para los picos de la gráfica.` : `La fuente trabaja al ${pct} % de su potencia.`);
    }
    res.shutdown = null;
    return res;
  }

  // ==========================================================================
  // MULTÍMETRO
  // ==========================================================================

  const DMM_POINTS = {
    atx_12v: { name: '+12 V (ATX 24 pines, pin 10)', unit: 'V', min: 11.4, max: 12.6, nominal: 12.08 },
    atx_5v: { name: '+5 V (ATX 24 pines, pin 4)', unit: 'V', min: 4.75, max: 5.25, nominal: 5.04 },
    atx_3v3: { name: '+3,3 V (ATX 24 pines, pin 1)', unit: 'V', min: 3.135, max: 3.465, nominal: 3.32 },
    atx_5vsb: { name: '+5 VSB standby (pin 9)', unit: 'V', min: 4.75, max: 5.25, nominal: 5.02 },
    atx_pson: { name: 'PS_ON# (pin 16, verde)', unit: 'V' },
    atx_pwrok: { name: 'PWR_OK / Power Good (pin 8, gris)', unit: 'V' },
    eps_12v: { name: '+12 V EPS (CPU)', unit: 'V', min: 11.4, max: 12.6, nominal: 12.06 },
    pcie_12v: { name: '+12 V alimentación de la GPU', unit: 'V', min: 11.4, max: 12.6, nominal: 12.05 },
    cmos: { name: 'Pila CMOS CR2032', unit: 'V', min: 2.8, max: 3.3 },
  };

  /** Lectura del multímetro. on = equipo encendido; load = en prueba de estrés. Devuelve { value, ok, text }. */
  function dmmRead(st, point, on, load) {
    const p = DMM_POINTS[point];
    if (!p) return null;
    if (st.device === 'laptop') return { value: 0, ok: false, text: 'En el portátil no hay conector ATX: mide la batería o la entrada del cargador con el equipo apagado.' };
    const d = st.desktop;
    const psu = !!d.psu, atx = psu && d.cables.atx24;
    if (point === 'cmos') {
      const v = d.cmosV;
      return { value: v, ok: v >= p.min, text: v >= p.min ? 'Pila en buen estado (una CR2032 nueva da unos 3,0–3,2 V).' : `Pila agotada (${v.toFixed(2)} V): por debajo de ~2,5 V la placa pierde la configuración y la hora al desenchufarla.` };
    }
    if (point === 'atx_5vsb') {
      if (!atx) return { value: 0, ok: false, text: psu ? 'No llega: el cable de 24 pines está desconectado.' : 'No hay fuente.' };
      return { value: p.nominal, ok: true, text: '+5 VSB está presente siempre que la fuente esté enchufada, aunque el equipo esté apagado: alimenta el circuito de encendido y el Wake-on-LAN.' };
    }
    if (point === 'atx_pson') {
      if (!atx) return { value: 0, ok: false, text: 'Sin fuente o sin cable de 24 pines no hay tensión de referencia.' };
      return on
        ? { value: 0.12, ok: true, text: 'Nivel bajo (< 0,8 V): la placa está pidiendo a la fuente que encienda. Puentear PS_ON# a masa es la «prueba del clip».' }
        : { value: 4.98, ok: true, text: 'Nivel alto (~5 V, tirado a +5 VSB dentro de la fuente): equipo apagado. Al pulsar el botón, la placa lo baja a masa.' };
    }
    if (point === 'atx_pwrok') {
      if (!atx || !on) return { value: 0, ok: !on && atx, text: on ? 'Sin señal Power Good.' : 'Equipo apagado: PWR_OK a 0 V. Al encender, la fuente lo sube a nivel alto entre 100 y 500 ms después de estabilizar las tensiones (100–250 ms en fuentes compatibles con ALPM).' };
      return { value: 4.95, ok: true, text: 'Nivel alto (> 2,4 V): todas las tensiones están estables y la placa libera el RESET de la CPU. El retardo (100–500 ms) no se ve con un multímetro: hace falta un osciloscopio.' };
    }
    const cable = point === 'eps_12v' ? 'eps8' : point === 'pcie_12v' ? 'pcie' : 'atx24';
    if (!on) return { value: 0, ok: false, text: 'Equipo apagado: +12 V, +5 V y +3,3 V están a 0 V hasta que PS_ON# baja a masa.' };
    if (!psu || !d.cables[cable]) return { value: 0, ok: false, text: 'No hay tensión: el cable de esta línea no está conectado.' };
    if (point === 'pcie_12v' && !d.gpu) return { value: 0, ok: false, text: 'No hay tarjeta gráfica que alimentar.' };
    let v = p.nominal;
    if (load && p.min === 11.4) {
      const pb = powerBudget(st);
      const ratio = pb.load / pb.psu;
      v = +(p.nominal - 0.25 * ratio).toFixed(2);
    }
    const ok = v >= p.min && v <= p.max;
    return { value: v, ok, text: ok ? `Dentro de tolerancia (${p.min}–${p.max} V, ±5 % según ATX12V 2.x${p.min === 11.4 ? '; ATX 3.x permite bajar hasta 11,2 V en +12 V' : ''}).` : 'Fuera de tolerancia.' };
  }

  // ==========================================================================
  // BIOS UEFI
  // ==========================================================================

  function biosInfo(st) {
    const d = st.desktop;
    const cpu = item('cpu', d.cpu), mobo = item('mobo', d.mobo);
    const mods = detectedModules(d.ram).map((m) => ({ slot: SLOT_NAMES[m.i], ...item('ram', m.r.id) }));
    const first = mods[0];
    const profileName = cpu && cpu.vendor === 'AMD' && mobo.ddr === 'DDR5' ? 'EXPO' : 'XMP';
    const speed = first ? (d.profile ? first.profile : first.jedec) : 0;
    return {
      mobo: mobo.name, socket: mobo.socket, fw: mobo.fw,
      cpu: cpu ? cpu.name : '—', freq: cpu ? `${cpu.base.toFixed(2)} GHz (turbo hasta ${cpu.boost.toFixed(1)} GHz)` : '—',
      memTotal: mods.reduce((s, m) => s + m.gb, 0), memType: mobo.ddr,
      modules: SLOT_NAMES.map((n, i) => { const m = mods.find((x) => x.slot === n); return { slot: n, module: m ? m.name : null }; }),
      channels: mods.length === 0 ? '—' : (mods.some((m) => m.slot.includes('A')) && mods.some((m) => m.slot.includes('B')) ? 'Doble canal' : 'Un canal'),
      profileName, profileOn: d.profile, speed, jedec: first ? first.jedec : 0, profileSpeed: first ? first.profile : 0,
      boot: d.nvme ? item('storage', d.nvme).name : null,
    };
  }

  // ==========================================================================
  // AUDITORÍA DEL MONTAJE
  // ==========================================================================

  function audit(st) {
    const out = [];
    const add = (level, text) => out.push({ level, text });
    if (!st.esd) add('WARN', 'Pulsera antiestática desconectada: conéctala al chasis antes de tocar componentes.');
    if (st.device === 'laptop') {
      const l = st.laptop;
      if (l.dead) add('ERROR', 'Placa dañada por manipularla con alimentación. Hay que sustituirla.');
      if (l.battery || l.ac) add('WARN', `Con ${l.battery && l.ac ? 'batería y cargador' : l.battery ? 'la batería' : 'el cargador'} conectado no toques la memoria ni el SSD.`);
      if (!l.paste) add('ERROR', 'Sin pasta térmica entre el chip y el disipador.');
      if (!l.screws.every(Boolean)) add('ERROR', 'Disipador sin apretar: apriétalo en cruz siguiendo la numeración.');
      if (!l.ram.some(Boolean)) add('WARN', 'Sin memoria SO-DIMM.');
      if (!l.nvme) add('INFO', 'Sin SSD: no tendrá desde dónde arrancar.');
      return out;
    }
    const d = st.desktop;
    const cpu = item('cpu', d.cpu), gpu = item('gpu', d.gpu), cooler = item('cooler', d.cooler), psu = item('psu', d.psu);
    if (!cpu) add('WARN', 'Zócalo de CPU vacío.');
    const mods = d.ram.filter(Boolean);
    if (!mods.length) add('WARN', 'Sin memoria RAM.');
    d.ram.forEach((r, i) => { if (r && !r.latched) add('ERROR', `${SLOT_NAMES[i]}: módulo sin asentar (pestillos abiertos).`); });
    if (mods.length === 1 && !d.ram[1]) add('INFO', 'Con un solo módulo, el fabricante recomienda DIMM_A2 (la ranura más alejada de la CPU en topología daisy-chain).');
    if (mods.length === 2 && !(d.ram[1] && d.ram[3])) add('INFO', 'Con dos módulos, usa DIMM_A2 y DIMM_B2 para el doble canal recomendado.');
    if (cpu && !cooler) add('ERROR', 'CPU sin disipador: se apagará por temperatura en segundos.');
    if (cooler) {
      if (cooler.film && !d.filmRemoved) add('ERROR', 'La lámina protectora sigue en la base del disipador: aísla el calor.');
      if (!d.paste) add('ERROR', 'Falta pasta térmica entre la CPU y el disipador.');
      if (cpu && cpu.maxPower > cooler.capacity) add('WARN', `Disipador justo: ${cooler.name} disipa ≈${cooler.capacity} W y la CPU puede consumir ${cpu.maxPower} W. Bajo carga limitará su frecuencia.`);
    }
    if (cpu && !cpu.igpu && !gpu) add('ERROR', `${cpu.name} no tiene gráficos integrados: hace falta una tarjeta gráfica.`);
    if (gpu && gpu.needsPower && !d.cables.pcie) add('ERROR', `Falta la alimentación de la gráfica (${gpu.connector}).`);
    if (psu) {
      if (!d.cables.atx24) add('ERROR', 'Falta el ATX de 24 pines.');
      if (cpu && !d.cables.eps8) add('ERROR', 'Falta el EPS de 8 pines de la CPU.');
      const pb = powerBudget(st);
      if (pb.load > pb.psu) add('ERROR', `Consumo máximo ≈${pb.load} W con una fuente de ${pb.psu} W: se apagará por sobrepotencia (OPP) al exigirle. Recomendado: ${pb.recommended} W.`);
      else if (pb.psu < pb.recommended) add('WARN', `Fuente de ${pb.psu} W para ≈${pb.load} W de carga: se recomienda ${pb.recommended} W para tener margen ante picos.`);
    } else add('WARN', 'Sin fuente de alimentación.');
    if (!d.cables.fpanel) add('WARN', 'El cable del botón de encendido (F_PANEL) está suelto.');
    if (d.cmosV < 2.5) add('WARN', 'Pila CMOS agotada.');
    return out;
  }

  // ==========================================================================
  // AVERÍAS (TALLER)
  // ==========================================================================

  const SCENARIOS = [
    {
      id: 'ram', title: 'Pantalla negra tras montar', device: 'desktop',
      desc: 'El cliente montó su PC. Los ventiladores giran, pero no da imagen. El display se queda en «55», se enciende el LED DRAM y suenan pitidos.',
      clue: 'Mira las ranuras de memoria: ¿está bien asentado el módulo?',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.ram = [null, { id: 'dimm_ddr5_16', latched: false }, null, null]; },
      verify(st, post) { return post && post.outcome === 'ok' && detectedModules(st.desktop.ram).length >= 1; },
    },
    {
      id: 'eps', title: 'El conector olvidado', device: 'desktop',
      desc: 'Los ventiladores giran pero no hay imagen ni pitidos. El display marca «00» y el LED CPU queda fijo.',
      clue: 'Sin pitidos es que el firmware ni siquiera se ejecuta. ¿Le llega corriente al procesador?',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.cables.eps8 = false; },
      verify(st, post) { return post && post.outcome === 'ok'; },
    },
    {
      id: 'thermal', title: 'Se apaga solo al encender', device: 'desktop',
      desc: 'El equipo arranca, los ventiladores se disparan y a los pocos segundos se apaga de golpe, sin llegar a dar imagen.',
      clue: 'Desmonta el disipador. ¿Hay pasta? ¿Se quitó la lámina transparente de la base?',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.paste = false; st.desktop.filmRemoved = false; },
      verify(st, post, stress) { return post && post.outcome === 'ok' && stress && stress.ran && !stress.shutdown && stress.clock === 100; },
      needsStress: true,
    },
    {
      id: 'gpu', title: 'Gráfica nueva, pantalla negra', device: 'desktop',
      desc: 'Acaban de instalar una RTX 4080. El equipo enciende, pero el display se queda en «d6», el LED VGA encendido y suenan pitidos.',
      clue: 'Una gráfica de 320 W no puede vivir de los 75 W de la ranura.',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.cables.pcie = false; },
      verify(st, post) { return post && post.outcome === 'ok'; },
    },
    {
      id: 'boot', title: 'Siempre entra en la BIOS', device: 'desktop',
      desc: 'El POST termina bien (un pitido corto), pero en vez de arrancar Windows aparece siempre la BIOS diciendo que no hay dispositivo de arranque.',
      clue: '¿Hay algún disco donde esté el sistema operativo?',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.nvme = null; },
      verify(st, post) { return post && post.outcome === 'ok'; },
    },
    {
      id: 'psu', title: 'Se apaga al empezar a jugar', device: 'desktop',
      desc: 'Arranca bien y en el escritorio va perfecto, pero al abrir un juego (o pasar un benchmark) se apaga de golpe, como si le cortaran la luz.',
      clue: 'Lanza la prueba de estrés y compara el consumo con la fuente.',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.psu = 'psu_450'; },
      verify(st, post, stress) { return post && post.outcome === 'ok' && stress && stress.ran && !stress.shutdown; },
      needsStress: true,
    },
    {
      id: 'cmos', title: 'Pierde la hora y la configuración', device: 'desktop',
      desc: 'Cada vez que desenchufan el equipo, al encender pide pulsar F1, la fecha vuelve a 2020 y el perfil de memoria se desactiva.',
      clue: 'Mide la pila de la placa con el multímetro.',
      setup(st) { st.device = 'desktop'; optimalDesktop(st); st.desktop.cmosV = 2.11; },
      verify(st, post) { return post && post.outcome === 'ok' && !post.cmosLow; },
    },
    {
      id: 'laptop', title: 'Ampliar la memoria de un portátil', device: 'laptop',
      desc: 'Un cliente quiere pasar su portátil de 16 a 32 GB. Tiene un SO-DIMM DDR5 de 16 GB en la primera ranura y la segunda libre. Haz la ampliación siguiendo el protocolo de seguridad y comprueba que arranca.',
      clue: 'Antes de tocar nada: batería desconectada y cargador fuera. Después, vuelve a conectar para encender.',
      setup(st) { st.device = 'laptop'; optimalLaptop(st); st.laptop.ram = [{ id: 'sodimm_ddr5_16', latched: true }, null]; st.laptop.battery = true; },
      verify(st, post) { return post && post.outcome === 'ok' && !st.laptop.everDamaged && st.laptop.ram.every(Boolean); },
    },
  ];

  // ==========================================================================
  // EXAMEN
  // ==========================================================================

  const QUIZ = [
    { q: 'El display marca «55», se enciende el LED DRAM y no hay imagen. ¿Qué revisas primero?', a: 'Que los módulos de memoria estén bien asentados y en las ranuras correctas', wrong: ['La alimentación de la tarjeta gráfica', 'El disco de arranque', 'La pila CMOS'], why: 'En los Q-codes de AMI (los de ASUS, MSI y otros) el 55 es «memoria no instalada o no detectada». Lo más habitual es un módulo sin asentar: los dos pestillos tienen que cerrar solos.' },
    { q: 'Con dos módulos en una placa de cuatro ranuras, ¿dónde se colocan normalmente?', a: 'En A2 y B2, las más alejadas de la CPU', wrong: ['En A1 y A2, juntas', 'En A1 y B1, las más cercanas a la CPU', 'Da igual: todas las ranuras rinden igual'], why: 'Con topología daisy-chain, las ranuras del final de la pista (A2 y B2) evitan «stubs» que reflejan la señal. Así se obtiene el doble canal con más estabilidad. El manual de la placa siempre manda.' },
    { q: 'Ventiladores girando, LED CPU fijo, display en «00» y ningún pitido. ¿Causa más probable?', a: 'Falta el cable EPS de 8 pines de la CPU', wrong: ['La memoria tiene desactivado el perfil XMP', 'El monitor está desconectado', 'Falta el SSD'], why: 'El ATX de 24 pines arranca la fuente y mueve los ventiladores, pero los reguladores de la CPU se alimentan del EPS. Sin CPU funcionando no se ejecuta el firmware, por eso no hay pitidos.' },
    { q: '¿Qué pasa si montas el disipador sin quitar la lámina protectora de la base?', a: 'El calor apenas pasa al disipador: la CPU se calienta mucho y limita su frecuencia o se apaga bajo carga', wrong: ['Nada: la lámina es conductora', 'Solo hace más ruido el ventilador', 'La placa muestra el código d6'], why: 'La lámina es plástico: un aislante. La CPU sube hasta su temperatura máxima (Tjmax), reduce frecuencia para protegerse y, si ni así puede, salta la protección térmica y se apaga.' },
    { q: 'Antes de cambiar la memoria o el SSD de un portátil hay que…', a: 'Desconectar la batería interna y quitar el cargador', wrong: ['Formatear el disco', 'Retirar la pantalla', 'Entrar en la BIOS y guardar'], why: 'Con la batería o el cargador conectados, las líneas de standby siguen vivas. Un contacto accidental al insertar el módulo puede dañar la placa o la memoria.' },
    { q: 'Según ATX12V 2.x, ¿entre qué valores debe estar la línea de +12 V?', a: 'Entre 11,40 V y 12,60 V (±5 %)', wrong: ['Entre 11,88 V y 12,12 V (±1 %)', 'Entre 10,20 V y 13,80 V (±15 %)', 'Exactamente 12,00 V'], why: 'ATX12V 2.x fija ±5 % en +12 V, +5 V y +3,3 V. ATX 3.x relaja el mínimo de +12 V a 11,2 V (−7 %) en casi todos los conectores para soportar los picos de las gráficas.' },
    { q: '¿Por qué los tornillos del disipador de un portátil van numerados?', a: 'Para apretarlos en cruz y poco a poco, repartiendo la presión sobre el chip', wrong: ['Para saber quién los montó', 'Para nivelar el teclado', 'Para que la pasta no se evapore'], why: 'Muchos chips de portátil no tienen chapa protectora (IHS). Apretar un tornillo a fondo antes que los demás inclina el disipador y puede astillar el silicio o dejar mal contacto.' },
    { q: 'Un Ryzen 5 5600X sin tarjeta gráfica…', a: 'No da imagen: el POST se detiene en el vídeo (d6) y suenan los pitidos de vídeo', wrong: ['Da imagen a 800×600', 'Saca vídeo por USB', 'Arranca sin pitidos y con código AA'], why: 'El 5600X no tiene gráficos integrados. Sin ningún dispositivo de vídeo el firmware no puede inicializar la salida.' },
    { q: '¿Qué es la señal PWR_OK (Power Good)?', a: 'La fuente avisa a la placa de que las tensiones ya son estables', wrong: ['Indica que el ventilador de la fuente gira', 'Apaga el equipo al suspender Windows', 'Lleva la señal de vídeo'], why: 'La fuente la pone a nivel alto entre 100 y 500 ms después de estabilizar las tensiones. Hasta entonces la placa mantiene la CPU en RESET para que no arranque con tensiones inestables.' },
    { q: 'Al cambiar la pasta térmica vieja, ¿por qué se limpia con alcohol isopropílico?', a: 'Porque disuelve los restos y se evapora sin dejar residuos ni humedad', wrong: ['Porque el alcohol refrigera la CPU', 'Porque ablanda el silicio', 'Porque conduce la electricidad'], why: 'Mezclar pasta nueva con restos secos deja huecos de aire. El isopropílico de alta pureza limpia y se evapora por completo.' },
  ];

  /** Examen con las opciones barajadas (la v1 tenía 8 de 10 respuestas en la opción B). */
  function shuffledQuiz(seed) {
    let s = (seed >>> 0) || 1;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    return QUIZ.map((x) => {
      const opts = [x.a, ...x.wrong];
      for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
      return { q: x.q, options: opts, correct: opts.indexOf(x.a), why: x.why };
    });
  }

  function grade(score) {
    if (score >= 9) return 'Sobresaliente';
    if (score >= 7) return 'Notable';
    if (score >= 5) return 'Aprobado';
    return 'No superado';
  }

  return {
    CATALOG, LAPTOP, SLOT_NAMES, BEEPS, QCODES, DMM_POINTS, SCENARIOS, QUIZ,
    item, createState, cloneState, optimalDesktop, optimalLaptop,
    canInstall, install, remove, toggleLatch, replaceCmos, replaceLaptopBoard, powerBudget, contactQuality, thermal,
    postPlan, stressTest, dmmRead, biosInfo, audit, shuffledQuiz, grade,
  };
});
