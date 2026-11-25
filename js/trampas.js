// Motor hidráulico: de una imagen segmentada a zonas donde el oro tiende a depositarse.
// No detecta oro; detecta lugares donde la corriente pierde fuerza y suelta lo pesado.
export const N = 128; // rejilla N×N, ejes normalizados 0..1
export const OTRO = 0, AGUA = 1, ROCA = 2, SEDIMENTO = 3;

const ADE = { [AGUA]: [21, 26, 60, 109, 113, 128], [ROCA]: [34], [SEDIMENTO]: [13, 46, 6, 52, 94, 11] };
const TABLA = new Uint8Array(150);
for (const t of [AGUA, ROCA, SEDIMENTO]) for (const c of ADE[t]) TABLA[c] = t;
const CALZADA = new Set([6, 52, 11]); // el modelo confunde grava con camino/acera

export const TIPOS = {
  resguardo: { nombre: 'Detrás de una roca', base: 0.85, util: 'batea',
    porque: 'Aguas abajo del bloque la corriente se frena y suelta lo pesado.',
    hacer: 'Saca grava de la base de la roca, hasta la arcilla o el lecho duro, y lávala en batea.' },
  barra: { nombre: 'Cabeza de barra de grava', base: 0.75, util: 'batea',
    porque: 'El extremo aguas arriba de la barra recibe primero la carga pesada.',
    hacer: 'Prueba bajo las piedras más grandes, en la línea de agua. Si da color, instala la canaleta.' },
  curva: { nombre: 'Interior de curva', base: 0.82, util: 'batea',
    porque: 'La grava avanza hacia el agua: por dentro de la curva la corriente va más lenta.',
    hacer: 'Muestrea a lo largo de la orilla, desde aguas arriba, una batea cada 2 o 3 pasos.' },
  remanso: { nombre: 'Salida del rápido', base: 0.65, util: 'batea',
    porque: 'El agua pasa de turbulenta a calma y pierde capacidad de arrastre.',
    hacer: 'Busca grava gruesa donde muere la espuma. No entres si el agua supera la rodilla.' },
  grieta: { nombre: 'Roca en la orilla', base: 0.72, util: 'detector',
    porque: 'Si es roca madre, sus grietas atrapan el oro como los rifles de una canaleta.',
    hacer: 'Limpia las grietas transversales a la corriente, pasa el detector lento y lava lo que saques.' },
  seca: { nombre: 'Grava fuera del agua', base: 0.4, util: 'detector',
    porque: 'Las crecidas dejan material en barras altas y terrazas.',
    hacer: 'Pasa el detector en franjas solapadas. El oro fino no lo marcará: comprueba también con batea.' },
};

/** logits CHW (150×N×N) -> rejilla de materiales + confianza */
export function materiales(logits) {
  const n = N * N, mat = new Uint8Array(n), crudo = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let b = 0, m = -Infinity;
    for (let c = 0; c < 150; c++) { const v = logits[c * n + i]; if (v > m) { m = v; b = c; } }
    crudo[i] = b; mat[i] = TABLA[b];
  }
  // "camino" solo cuenta como grava si su mancha toca agua
  for (const comp of componentes(mat, SEDIMENTO)) {
    if (!comp.celdas.some(i => vecinos(i).some(v => mat[v] === AGUA)) && comp.celdas.every(i => CALZADA.has(crudo[i])))
      for (const i of comp.celdas) mat[i] = OTRO;
  }
  return mat;
}

export function vecinos(i) {
  const x = i % N, y = (i / N) | 0, r = [];
  if (x > 0) r.push(i - 1); if (x < N - 1) r.push(i + 1);
  if (y > 0) r.push(i - N); if (y < N - 1) r.push(i + N);
  return r;
}

export function componentes(g, valor) {
  const visto = new Uint8Array(N * N), out = [];
  for (let s = 0; s < N * N; s++) {
    if (g[s] !== valor || visto[s]) continue;
    const celdas = [s]; visto[s] = 1;
    for (let k = 0; k < celdas.length; k++) for (const v of vecinos(celdas[k]))
      if (g[v] === valor && !visto[v]) { visto[v] = 1; celdas.push(v); }
    out.push({ celdas });
  }
  return out;
}

const media = (c, f) => c.reduce((a, i) => a + f(i), 0) / c.length;
const X = i => i % N, Y = i => (i / N) | 0;

/**
 * mat: materiales; flujo {x,y} dirección de la corriente en la imagen (hacia dónde va);
 * espuma: Float32Array opcional 0..1; velocidad: Float32Array opcional (relativa, NaN = sin dato)
 */
export function detectarTrampas(mat, flujo, espuma, velocidad, pesos = {}) {
  const l = Math.hypot(flujo.x, flujo.y) || 1, f = { x: flujo.x / l, y: flujo.y / l };
  const p = i => X(i) * f.x + Y(i) * f.y;
  const agua = componentes(mat, AGUA).filter(c => c.celdas.length >= 120);
  const total = agua.reduce((a, c) => a + c.celdas.length, 0);
  if (!total) return { zonas: [], agua: 0 };
  const esAgua = new Uint8Array(N * N); agua.forEach(c => c.celdas.forEach(i => esAgua[i] = 1));
  const toca = i => vecinos(i).some(v => esAgua[v]);
  const zonas = [];
  const pon = (tipo, x, y, r, factor = 1) => {
    if (x < 1 || y < 1 || x > N - 2 || y > N - 2) return;
    zonas.push({ tipo, x: x / N, y: y / N, r: Math.min(.12, Math.max(.025, r / N)), puntaje: TIPOS[tipo].base * factor * (pesos[tipo] ?? 1) });
  };

  // Islas no-agua rodeadas por agua = bloques (el modelo a veces no las llama "rock")
  const solido = new Uint8Array(N * N).map((_, i) => (esAgua[i] ? 0 : 1));
  const islas = new Set();
  for (const c of componentes(solido, 1)) {
    const n = c.celdas.length;
    const tocaBorde = c.celdas.some(i => X(i) === 0 || Y(i) === 0 || X(i) === N - 1 || Y(i) === N - 1);
    if (n < 4 || n > 500 || tocaBorde) continue;
    c.celdas.forEach(i => islas.add(i));
    const r = Math.sqrt(n / Math.PI), sedim = c.celdas.filter(i => mat[i] === SEDIMENTO).length / n;
    if (sedim > .6 && n > 60) { // isla de grava: cabeza
      const o = [...c.celdas].sort((a, b) => p(a) - p(b)).slice(0, Math.max(3, n >> 2));
      pon('barra', media(o, X), media(o, Y), r * .6);
      continue;
    }
    const cola = [...c.celdas].sort((a, b) => p(b) - p(a)).slice(0, Math.max(1, n >> 3));
    const d = Math.max(2, r * .7);
    pon('resguardo', media(cola, X) + f.x * d, media(cola, Y) + f.y * d, r * .9 + 2, Math.min(1, .75 + r / 24));
  }

  // Grava pegada al agua
  for (const c of componentes(mat, SEDIMENTO)) {
    if (c.celdas.length < 40 || c.celdas.every(i => islas.has(i))) continue;
    const orilla = c.celdas.filter(toca);
    if (orilla.length >= 8) {
      orilla.sort((a, b) => p(a) - p(b));
      const a = orilla[0], b = orilla[orilla.length - 1], L = Math.hypot(X(b) - X(a), Y(b) - Y(a)) || 1;
      const nx = -(Y(b) - Y(a)) / L, ny = (X(b) - X(a)) / L;
      const lado = i => (X(i) - X(a)) * nx + (Y(i) - Y(a)) * ny;
      const s = Math.sign(media(c.celdas, lado) - media(orilla, lado)) || 1; // lado de tierra
      const abomba = -s * media(orilla, lado) / L; // >0: la grava entra en el agua
      const cab = orilla.slice(0, Math.max(4, Math.ceil(orilla.length * .25)));
      if (abomba > .1) {
        pon('curva', media(orilla.slice(0, Math.ceil(orilla.length * .6)), X), media(orilla.slice(0, Math.ceil(orilla.length * .6)), Y), L * .22, Math.min(1.1, .9 + abomba));
      }
      pon('barra', media(cab, X), media(cab, Y), Math.max(4, L * .14));
    }
    const seca = c.celdas.filter(i => !cerca(i, esAgua, 7));
    if (seca.length > 150) pon('seca', media(seca, X), media(seca, Y), Math.sqrt(seca.length) * .4);
  }

  // Roca grande de orilla: por tramos, para no dar un único centro en mitad de la pared
  for (const c of componentes(mat, ROCA)) {
    if (c.celdas.length < 30 || c.celdas.every(i => islas.has(i))) continue;
    const orilla = c.celdas.filter(toca);
    if (orilla.length < 6) continue;
    orilla.sort((a, b) => p(a) - p(b));
    const tramos = Math.min(3, Math.ceil(orilla.length / 28)), k = Math.ceil(orilla.length / tramos);
    for (let t = 0; t < tramos; t++) {
      const o = orilla.slice(t * k, (t + 1) * k);
      // elegir celda real más cercana a la media: siempre sobre la orilla
      const mx = media(o, X), my = media(o, Y);
      const q = o.reduce((m, i) => Math.hypot(X(i) - mx, Y(i) - my) < Math.hypot(X(m) - mx, Y(m) - my) ? i : m, o[0]);
      pon('grieta', X(q), Y(q), 5, t === 0 ? 1 : .92);
    }
  }

  // Fin del rápido
  if (espuma) {
    const b = new Uint8Array(N * N).map((_, i) => esAgua[i] && espuma[i] > .55 ? 1 : 0);
    for (const c of componentes(b, 1)) {
      if (c.celdas.length < 25) continue;
      const ext = [...c.celdas].sort((m, n) => p(n) - p(m)).slice(0, Math.max(4, c.celdas.length >> 3));
      const x = media(ext, X) + f.x * 5, y = media(ext, Y) + f.y * 5;
      const i = Math.round(y) * N + Math.round(x);
      if (x >= 0 && x < N && y >= 0 && y < N && esAgua[i] && espuma[i] < .4) pon('remanso', x, y, 6);
    }
  }

  // Ajuste con corriente medida: más lenta = mejor
  if (velocidad) for (const z of zonas) {
    let s = 0, n = 0; const cx = z.x * N | 0, cy = z.y * N | 0;
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 4; x <= cx + 4; x++)
      if (x >= 0 && y >= 0 && x < N && y < N && Number.isFinite(velocidad[y * N + x])) { s += velocidad[y * N + x]; n++; }
    if (n > 5) z.puntaje *= 1.15 - .3 * Math.min(1, s / n);
  }

  zonas.sort((a, b) => b.puntaje - a.puntaje);
  const fin = [];
  for (const z of zonas) if (!fin.some(q => Math.hypot(q.x - z.x, q.y - z.y) < .09)) fin.push(z);
  return { zonas: fin.slice(0, 6).map(z => ({ ...z, puntaje: Math.min(1, z.puntaje), nivel: z.puntaje >= .75 ? 'alta' : z.puntaje >= .55 ? 'media' : 'baja' })), agua: total / (N * N) };
}

function cerca(i, g, d) {
  const x = X(i), y = Y(i);
  for (let b = Math.max(0, y - d); b <= Math.min(N - 1, y + d); b++)
    for (let a = Math.max(0, x - d); a <= Math.min(N - 1, x + d); a++) if (g[b * N + a]) return true;
  return false;
}

/** RGBA 512×512 -> espuma 0..1 (brillante, sin color y con textura) */
export function mapaEspuma(rgba, lado = 512) {
  const k = lado / N, out = new Float32Array(N * N);
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    let s = 0, s2 = 0, sat = 0, n = 0;
    for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
      const o = ((gy * k + y) * lado + gx * k + x) * 4, r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      const v = .3 * r + .59 * g + .11 * b; s += v; s2 += v * v; sat += Math.max(r, g, b) - Math.min(r, g, b); n++;
    }
    const m = s / n, sd = Math.sqrt(Math.max(0, s2 / n - m * m));
    out[gy * N + gx] = Math.min(1, Math.max(0, (m - 135) / 70)) * Math.min(1, Math.max(0, 1 - sat / n / 60)) * Math.min(1, .4 + sd / 14);
  }
  // Suavizado 3×3
  return out.map((_, i) => { const v = vecinos(i); return (out[i] + v.reduce((a, j) => a + out[j], 0)) / (v.length + 1); });
}

/**
 * Corriente por emparejamiento de bloques entre dos fotogramas grises w×h.
 * Resta el movimiento de la orilla (pulso de la mano). mat en rejilla N.
 */
export function medirCorriente(a, b, w, h, mat, B = 8, R = 5) {
  const mov = [], quieto = [];
  for (let y = R; y + B + R <= h; y += B) for (let x = R; x + B + R <= w; x += B) {
    let m = 0, s2 = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const v = a[(y + j) * w + x + i]; m += v; s2 += v * v; }
    if (s2 / 64 - (m / 64) ** 2 < 12) continue; // sin textura no hay medida
    let best = Infinity, bx = 0, by = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      let e = (Math.abs(dx) + Math.abs(dy)) * .5;
      for (let j = 0; j < B && e < best; j++) for (let i = 0; i < B; i++)
        e += Math.abs(a[(y + j) * w + x + i] - b[(y + dy + j) * w + x + dx + i]);
      if (e < best) { best = e; bx = dx; by = dy; }
    }
    if (best / 64 > 22) continue;
    const gx = ((x + B / 2) / w * N) | 0, gy = ((y + B / 2) / h * N) | 0;
    (mat[gy * N + gx] === AGUA ? mov : quieto).push({ gx, gy, dx: bx, dy: by });
  }
  const med = v => v.length ? v.sort((p, q) => p - q)[v.length >> 1] : 0;
  const mx = med(quieto.map(q => q.dx)), my = med(quieto.map(q => q.dy));
  return mov.map(m => ({ ...m, dx: (m.dx - mx) / w, dy: (m.dy - my) / h }));
}

/** Acumula muestras -> dirección + velocidad relativa (0..1) + coherencia */
export function resumirCorriente(muestras) {
  if (muestras.length < 20) return null;
  let sx = 0, sy = 0, sm = 0;
  for (const m of muestras) { sx += m.dx; sy += m.dy; sm += Math.hypot(m.dx, m.dy); }
  const coherencia = sm ? Math.hypot(sx, sy) / sm : 0;
  const s = new Float32Array(N * N), n = new Float32Array(N * N), D = 5;
  for (const m of muestras) for (let y = Math.max(0, m.gy - D); y <= Math.min(N - 1, m.gy + D); y++)
    for (let x = Math.max(0, m.gx - D); x <= Math.min(N - 1, m.gx + D); x++) { s[y * N + x] += Math.hypot(m.dx, m.dy); n[y * N + x]++; }
  let max = 1e-9; for (let i = 0; i < N * N; i++) if (n[i]) max = Math.max(max, s[i] / n[i]);
  return { x: sx, y: sy, coherencia, fiable: coherencia > .45 && sm / muestras.length > .002, velocidad: s.map((v, i) => n[i] ? v / n[i] / max : NaN) };
}
