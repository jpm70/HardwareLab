'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/core.js');

const fresh = () => H.createState();
const opt = () => H.optimalDesktop(fresh());

test('Lo que no encaja no se monta', () => {
  const st = fresh();
  assert.match(H.canInstall(st, 'cpu', 'i9_14900k').reason, /LGA1700.*AM5/);
  assert.ok(H.canInstall(st, 'cpu', 'r7_7800x3d').ok);
  assert.match(H.canInstall(st, 'ram', 'dimm_ddr4_8', 1).reason, /muesca/i);
  assert.match(H.canInstall(st, 'ram', 'sodimm_ddr5_16', 1).reason, /SO-DIMM/);
  assert.ok(H.canInstall(st, 'ram', 'dimm_ddr5_16', 1).ok);
  assert.match(H.canInstall(st, 'cooler', 'aio_360').reason, /Primero la CPU/);
  H.install(st, 'cpu', 'r7_7800x3d');
  assert.match(H.canInstall(st, 'mobo', 'lga1700_z790').reason, /Quita antes la CPU/);
  H.install(st, 'ram', 'dimm_ddr5_16', 1);
  assert.match(H.canInstall(st, 'ram', 'dimm_ddr5_16', 1).reason, /ocupada/);
  st.device = 'laptop';
  assert.match(H.canInstall(st, 'gpu', 'rtx_4080').reason, /solo se pueden cambiar/);
  assert.match(H.canInstall(st, 'ram', 'dimm_ddr5_16', 0).reason, /no cabe/);
  assert.match(H.canInstall(st, 'ram', 'sodimm_ddr4_8', 0).reason, /muesca/);
  st.esd = false;
  assert.ok(H.canInstall(st, 'storage', 'nvme_1tb').warn.some((w) => /antiestática/.test(w)));
});

test('Preset óptimo: POST AA con un pitido corto y prueba de estrés estable', () => {
  const st = opt();
  const p = H.postPlan(st);
  assert.equal(p.outcome, 'ok');
  assert.equal(p.steps.at(-1).hex, 'AA');
  assert.equal(p.beep.label, '1 corto');
  const s = H.stressTest(st);
  assert.equal(s.shutdown, null);
  assert.equal(s.clock, 100);
  assert.ok(s.temp < 89);
  assert.deepEqual(H.audit(st).filter((i) => i.level !== 'INFO'), []);
});

test('Sin 24 pines ni siquiera giran los ventiladores; sin EPS: 00, LED CPU y silencio', () => {
  let st = opt(); st.desktop.cables.atx24 = false;
  let p = H.postPlan(st);
  assert.equal(p.outcome, 'no-power'); assert.equal(p.fans, false);
  st = opt(); st.desktop.cables.eps8 = false;
  p = H.postPlan(st);
  assert.equal(p.outcome, 'halt-cpu'); assert.equal(p.steps.at(-1).hex, '00'); assert.deepEqual(p.steps.at(-1).leds, [1, 0, 0, 0]);
  assert.equal(p.beep, undefined, 'sin CPU funcionando no hay pitidos');
  st = opt(); st.desktop.cpu = null;
  assert.equal(H.postPlan(st).beep, undefined);
  st = opt(); st.desktop.cables.fpanel = false;
  assert.match(H.postPlan(st).toast, /panel frontal/);
});

test('Memoria: 55 con pitidos según fabricante; módulo suelto con otro bueno arranca con menos memoria', () => {
  const st = opt();
  st.desktop.ram = [null, { id: 'dimm_ddr5_16', latched: false }, null, null];
  let p = H.postPlan(st);
  assert.equal(p.outcome, 'halt-dram'); assert.equal(p.steps.at(-1).hex, '55');
  assert.equal(p.beep.label, '3 cortos');
  st.biosVendor = 'Award';
  assert.equal(H.postPlan(st).beep.label, 'largos repetidos');
  st.desktop.ram = [null, { id: 'dimm_ddr5_16', latched: true }, null, { id: 'dimm_ddr5_16', latched: false }];
  p = H.postPlan(st);
  assert.equal(p.outcome, 'ok');
  assert.ok(p.steps.some((x) => /16 GB detectados/.test(x.log) && /un solo canal/.test(x.log)));
});

test('Vídeo: d6 por CPU sin iGPU o gráfica sin alimentar; AMI 8 cortos, Award 1 largo + 2 cortos', () => {
  const st = opt();
  st.desktop.cables.pcie = false;
  const p = H.postPlan(st);
  assert.equal(p.outcome, 'halt-vga'); assert.equal(p.steps.at(-1).hex, 'd6'); assert.equal(p.beep.label, '8 cortos');
  st.biosVendor = 'Award';
  assert.equal(H.postPlan(st).beep.label, '1 largo + 2 cortos');
  const s2 = opt();
  Object.assign(s2.desktop, { mobo: 'am4_b550', cpu: 'r5_5600x', gpu: null, ram: [null, { id: 'dimm_ddr4_8', latched: true }, null, null] });
  assert.equal(H.postPlan(s2).outcome, 'halt-vga');
  s2.desktop.gpu = 'gtx_1650';
  assert.equal(H.postPlan(s2).outcome, 'ok', 'la GTX 1650 no necesita cable');
});

test('Térmica: sin disipador o lámina + sin pasta se apaga; solo sin pasta arranca pero limita frecuencia', () => {
  let st = opt(); st.desktop.cooler = null;
  assert.equal(H.postPlan(st).outcome, 'thermtrip');
  st = opt(); st.desktop.paste = false; st.desktop.filmRemoved = false;
  assert.equal(H.postPlan(st).outcome, 'thermtrip');
  st = opt(); st.desktop.paste = false;
  assert.equal(H.postPlan(st).outcome, 'ok');
  let s = H.stressTest(st);
  assert.equal(s.shutdown, null); assert.ok(s.clock < 100 && s.clock > 25); assert.equal(s.temp, 89);
  st = opt(); st.desktop.filmRemoved = false;
  assert.equal(H.postPlan(st).outcome, 'ok');
  assert.equal(H.stressTest(st).shutdown, 'thermtrip');
  st = opt(); st.desktop.cooler = 'passive_25'; st.desktop.paste = true;
  assert.equal(H.stressTest(st).shutdown, 'thermtrip');
  st = opt(); Object.assign(st.desktop, { cpu: 'i9_14900k', mobo: 'lga1700_z790', cooler: 'air_stock', psu: 'psu_1000' });
  s = H.stressTest(st);
  assert.equal(s.shutdown, null); assert.ok(s.clock < 40, 'un disipador de 65 W con un i9 limita muchísimo');
});

test('Fuente: OPP solo bajo carga, recomendación coherente con el fabricante', () => {
  const st = opt(); st.desktop.psu = 'psu_450';
  assert.equal(H.postPlan(st).outcome, 'ok', 'en reposo arranca');
  const s = H.stressTest(st);
  assert.equal(s.shutdown, 'opp'); assert.equal(s.power, 532);
  assert.equal(H.powerBudget(st).recommended, 750);
  st.desktop.psu = 'psu_650';
  assert.equal(H.stressTest(st).shutdown, null);
  assert.ok(H.audit(st).some((i) => i.level === 'WARN' && /750 W/.test(i.text)));
});

test('Multímetro: PS_ON# alto en reposo y bajo encendido; PWR_OK en voltios; sin cable no hay tensión', () => {
  const st = opt();
  assert.equal(H.dmmRead(st, 'atx_pson', false).value, 4.98);
  assert.ok(H.dmmRead(st, 'atx_pson', true).value < 0.8);
  assert.equal(H.dmmRead(st, 'atx_pwrok', false).value, 0);
  assert.ok(H.dmmRead(st, 'atx_pwrok', true).value > 2.4);
  assert.equal(H.dmmRead(st, 'atx_12v', false).value, 0);
  assert.equal(H.dmmRead(st, 'atx_5vsb', false).value, 5.02);
  const r = H.dmmRead(st, 'atx_12v', true);
  assert.ok(r.ok && r.value === 12.08);
  assert.ok(H.dmmRead(st, 'atx_12v', true, true).value < 12.08, 'bajo carga cae un poco');
  st.desktop.cables.eps8 = false;
  assert.equal(H.dmmRead(st, 'eps_12v', true).value, 0);
  st.desktop.cmosV = 2.11;
  assert.equal(H.dmmRead(st, 'cmos', false).ok, false);
});

test('Portátil: tocar con batería o cargador daña la placa; con protocolo arranca', () => {
  const st = fresh(); H.optimalLaptop(st); st.device = 'laptop';
  st.laptop.ram = [{ id: 'sodimm_ddr5_16', latched: true }, null];
  const r = H.install(st, 'ram', 'sodimm_ddr5_16', 1);
  assert.ok(r.damage); assert.equal(H.postPlan(st).outcome, 'dead');
  H.replaceLaptopBoard(st);
  assert.equal(H.postPlan(st).outcome, 'ok');
  assert.ok(st.laptop.everDamaged);
  const s2 = fresh(); H.optimalLaptop(s2); s2.device = 'laptop'; s2.laptop.battery = false; s2.laptop.ac = true;
  s2.laptop.ram = [null, null];
  assert.ok(H.install(s2, 'ram', 'sodimm_ddr5_16', 0).damage, 'el cargador también alimenta la placa');
  const s3 = fresh(); H.optimalLaptop(s3); s3.device = 'laptop'; s3.laptop.battery = false;
  s3.laptop.ram = [null, null];
  assert.equal(H.install(s3, 'ram', 'sodimm_ddr5_16', 0).damage, null);
  assert.equal(H.postPlan(s3).outcome, 'no-power');
  s3.laptop.battery = true;
  assert.equal(H.postPlan(s3).outcome, 'ok');
  s3.laptop.screws = [true, false, true, true];
  assert.ok(H.thermal(s3, 'stress').status !== 'ok', 'disipador sin apretar no refrigera');
});

test('Averías: fallan al cargarlas y se resuelven con la reparación correcta', () => {
  const fix = {
    ram: (st) => H.toggleLatch(st, 1),
    eps: (st) => { st.desktop.cables.eps8 = true; },
    thermal: (st) => { st.desktop.paste = true; st.desktop.filmRemoved = true; },
    gpu: (st) => { st.desktop.cables.pcie = true; },
    boot: (st) => H.install(st, 'storage', 'nvme_1tb'),
    psu: (st) => { H.remove(st, 'psu'); H.install(st, 'psu', 'psu_850'); Object.assign(st.desktop.cables, { atx24: true, eps8: true, pcie: true }); },
    cmos: (st) => H.replaceCmos(st),
    laptop: (st) => { st.laptop.battery = false; H.install(st, 'ram', 'sodimm_ddr5_16', 1); st.laptop.battery = true; },
  };
  for (const sc of H.SCENARIOS) {
    const st = fresh();
    sc.setup(st);
    assert.equal(st.device, sc.device);
    const before = H.postPlan(st);
    assert.ok(!sc.verify(st, before, H.stressTest(st)), `${sc.id} no debería estar resuelta de salida`);
    fix[sc.id](st);
    const post = H.postPlan(st);
    assert.ok(sc.verify(st, post, H.stressTest(st)), `${sc.id}: ${post.outcome} ${JSON.stringify(H.stressTest(st))}`);
  }
  const st = fresh(); H.SCENARIOS.find((x) => x.id === 'thermal').setup(st);
  st.desktop.filmRemoved = true; // solo quita la lámina
  assert.ok(!H.SCENARIOS.find((x) => x.id === 'thermal').verify(st, H.postPlan(st), H.stressTest(st)), 'sin pasta sigue limitando frecuencia');
  const lp = fresh(); H.SCENARIOS.find((x) => x.id === 'laptop').setup(lp);
  H.install(lp, 'ram', 'sodimm_ddr5_16', 1); H.replaceLaptopBoard(lp);
  assert.ok(!H.SCENARIOS.find((x) => x.id === 'laptop').verify(lp, H.postPlan(lp)), 'dañar la placa no vale aunque luego se cambie');
});

test('BIOS: datos según la CPU y la memoria montadas', () => {
  const st = opt();
  let b = H.biosInfo(st);
  assert.equal(b.memTotal, 32); assert.equal(b.profileName, 'EXPO'); assert.equal(b.speed, 4800); assert.equal(b.channels, 'Doble canal');
  st.desktop.profile = true;
  assert.equal(H.biosInfo(st).speed, 6000);
  Object.assign(st.desktop, { mobo: 'lga1700_z790', cpu: 'i5_13400' });
  b = H.biosInfo(st);
  assert.equal(b.profileName, 'XMP'); assert.match(b.fw, /Intel/);
});

test('Examen: 10 preguntas, respuesta correcta conservada y repartida entre opciones', () => {
  const pos = new Set();
  for (let seed = 1; seed < 6; seed++) {
    const q = H.shuffledQuiz(seed);
    assert.equal(q.length, 10);
    q.forEach((x, i) => { assert.equal(x.options[x.correct], H.QUIZ[i].a); assert.equal(new Set(x.options).size, 4); pos.add(x.correct); });
  }
  assert.equal(pos.size, 4);
  assert.equal(H.grade(4), 'No superado'); assert.equal(H.grade(10), 'Sobresaliente');
});
