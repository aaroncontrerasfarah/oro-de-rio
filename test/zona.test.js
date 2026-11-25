import test from 'node:test'; import assert from 'node:assert/strict';
import { rioCercano, forma, clasificarRoca, describirZona, corrienteEnPantalla, rumboCamara, rumbo } from '../app/js/zona.js';
import { detectarTrampas, N, AGUA, ROCA } from '../app/js/trampas.js';
const g = 1 / 111320, cerca = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const rio = { nombre: 'R', puntos: [[0, -3000 * g], [0, 3000 * g]] }, cota = s => (la, lo) => 500 - lo / g * s;
test('río cercano: distancia, rumbo y pendiente', () => { const r = rioCercano([rio], [100 * g, 0], cota(.02)); cerca(r.distancia, 100, 2); cerca(r.rumbo, 90, 1); cerca(r.pendiente, .02, 1e-3); });
test('formas por pendiente', () => assert.deepEqual([.06, .02, .008, .001, null].map(forma), ['torrente', 'montana', 'piedemonte', 'llano', null]));
test('rocas reales de Macrostrat', () => { assert.equal(clasificarRoca([{ lith: 'Low to medium grade metamorphic' }]).nombre, 'metamórfica'); assert.equal(clasificarRoca([{ lith: 'Granite' }]).valor, 1); assert.equal(clasificarRoca([{ lith: 'Volcaniclastic, volcanic' }]).nombre, 'volcánica'); assert.equal(clasificarRoca([{ lith: 'Siliciclastic' }]).nombre, 'sedimentaria'); assert.equal(clasificarRoca(null), null); });
const base = { pos: [100 * g, 0], rios: [rio], cota: cota(.008), lluvia: 0 };
test('interés alto, bajo, sin río y sin datos', () => {
  assert.equal(describirZona({ ...base, rocaAqui: [{ lith: 'schist' }], historicas: [{ n: 'H', p: [0, 0] }] }).interes, 'alto');
  assert.equal(describirZona({ ...base, rocaAqui: [{ lith: 'shale' }], historicas: [] }).interes, 'bajo');
  assert.equal(describirZona({ ...base, rios: [], rocaAqui: [{ lith: 'schist' }], historicas: [] }).interes, 'sin río cerca');
  assert.equal(describirZona({ ...base, rios: [], cota: () => null, historicas: [] }).interes, null);
});
test('corriente en pantalla', () => { const a = corrienteEnPantalla(90, 0); cerca(a.x, 1); cerca(a.y, 0); cerca(corrienteEnPantalla(0, 0).y, -1); cerca(corrienteEnPantalla(180, 0).y, 1); });
test('rumbo de cámara con móvil vertical', () => { cerca(rumboCamara(0, 90, 0), 0); cerca(rumboCamara(270, 90, 0), 90); cerca(rumboCamara(90, 90, 0), 270); cerca(rumbo([0, 0], [1, 0]), 0); });
test('el perfil cambia la prioridad', () => { const m = new Uint8Array(N * N); for (let y = 30; y < 100; y++) for (let x = 0; x < N; x++) m[y * N + x] = AGUA; for (let y = 100; y < N; y++) for (let x = 0; x < 50; x++) m[y * N + x] = ROCA; const p = w => detectarTrampas(m, { x: 1, y: 0 }, null, null, { grieta: w }).zonas.find(z => z.tipo === 'grieta').puntaje; assert.ok(p(1.2) > p(.75)); });
