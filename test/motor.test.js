import test from 'node:test'; import assert from 'node:assert/strict';
import { N, AGUA, ROCA, SEDIMENTO, detectarTrampas, medirCorriente, resumirCorriente } from '../app/js/trampas.js';
import { candidatos, remuestrear, ley, dist } from '../app/js/tramo.js';
const rio = () => { const m = new Uint8Array(N * N); for (let y = 30; y < 100; y++) for (let x = 0; x < N; x++) m[y * N + x] = AGUA; return m; };
const disco = (m, cx, cy, r, v) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) m[y * N + x] = v; return m; };
test('sin agua no hay zonas', () => assert.deepEqual(detectarTrampas(new Uint8Array(N * N), { x: 1, y: 0 }).zonas, []));
test('resguardo aguas abajo y se invierte con el flujo', () => {
  const m = disco(rio(), 64, 65, 6, ROCA), z = d => detectarTrampas(m, d).zonas.find(z => z.tipo === 'resguardo');
  assert.ok(z({ x: 1, y: 0 }).x * N > 70); assert.ok(z({ x: -1, y: 0 }).x * N < 58);
});
test('grava que entra en el agua = interior de curva; cabeza aguas arriba', () => {
  const m = rio(); for (let y = 100; y < N; y++) for (let x = 0; x < N; x++) m[y * N + x] = 0;
  disco(m, 64, 108, 30, SEDIMENTO);
  const z = detectarTrampas(m, { x: 1, y: 0 }).zonas;
  assert.ok(z.find(q => q.tipo === 'curva')); assert.ok(z.find(q => q.tipo === 'barra').x < .5);
});
test('grava recta no se llama curva', () => {
  const m = rio(); for (let y = 100; y < N; y++) for (let x = 0; x < N; x++) m[y * N + x] = SEDIMENTO;
  assert.ok(!detectarTrampas(m, { x: 1, y: 0 }).zonas.some(z => z.tipo === 'curva'));
});
test('roca de orilla = grieta', () => {
  const m = rio(); for (let y = 100; y < N; y++) for (let x = 0; x < 50; x++) m[y * N + x] = ROCA;
  assert.ok(detectarTrampas(m, { x: 1, y: 0 }).zonas.some(z => z.tipo === 'grieta'));
});
test('fin de rápido', () => {
  const e = new Float32Array(N * N); for (let y = 50; y < 80; y++) for (let x = 20; x < 50; x++) e[y * N + x] = 1;
  const z = detectarTrampas(rio(), { x: 1, y: 0 }, e).zonas.find(z => z.tipo === 'remanso'); assert.ok(z.x * N > 49);
});
test('corriente: mide el agua y descuenta el pulso', () => {
  const w = 160, h = 160, ruido = Array.from({ length: 200 * 200 }, (_, i) => (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * 255);
  const px = (x, y) => ruido[(y + 10) * 200 + x + 10], a = new Float32Array(w * h), b = new Float32Array(w * h), m = rio();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ag = m[(y / h * N | 0) * N + (x / w * N | 0)] === AGUA;
    a[y * w + x] = px(x, y); b[y * w + x] = px(x - (ag ? 4 : 1), y);
  }
  const r = resumirCorriente(medirCorriente(a, b, w, h, m));
  assert.ok(r.fiable); assert.ok(r.x > 0 && Math.abs(r.y) < r.x * .2);
});
const g = 1 / 111320;
test('curva en mapa: punto hacia el interior', () => {
  // baja al sur y gira al oeste: el interior queda al oeste y al norte del vértice
  const c = candidatos([{ nombre: 'A', puntos: [[300 * g, 0], [0, 0], [0, -300 * g]] }]).find(c => c.tipo === 'curva');
  assert.ok(c.lat > 0 && c.lon < 0);
});
test('confluencia y quiebre de pendiente', () => {
  const A = { nombre: 'A', puntos: [[0, 0], [0, 100 * g], [0, 200 * g]] }, B = { nombre: 'B', puntos: [[200 * g, 100 * g], [0, 100 * g]] };
  assert.ok(candidatos([A, B]).some(c => c.tipo === 'confluencia'));
  const L = { nombre: 'L', puntos: [[0, 0], [0, 2000 * g]] };
  const q = candidatos([L], (la, lo) => Math.max(0, 1000 - lo / g) * .05).filter(c => c.tipo === 'pendiente');
  assert.ok(q.length && Math.abs(q[0].lon / g - 1000) < 450);
});
test('remuestreo y ley', () => {
  const p = remuestrear([[0, 0], [0, 1000 * g]]); assert.ok(p.length >= 40 && p.length <= 41); assert.ok(Math.abs(dist(p[3], p[4]) - 25) < .5);
  assert.ok(Math.abs(ley(10, 10, 10) - .1) < 1e-9); assert.equal(ley(1, 0, 10), null);
});
