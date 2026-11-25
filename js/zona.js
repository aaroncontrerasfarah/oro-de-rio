// Reconoce el tipo de zona a partir de relieve, ríos y geología. Reglas explícitas y orientativas.
import { dist, remuestrear } from './tramo.js';
const rad = Math.PI / 180;
export const rumbo = (a, b) => (Math.atan2((b[1] - a[1]) * Math.cos(a[0] * rad), b[0] - a[0]) / rad + 360) % 360;

/** Río más cercano, con posición, rumbo de la corriente, pendiente y sinuosidad (±1 km) */
export function rioCercano(rios, pos, cota = () => null) {
  let m = null;
  for (const r of rios) { const p = remuestrear(r.puntos, 25); for (let i = 0; i < p.length; i++) { const d = dist(pos, p[i]); if (!m || d < m.d) m = { d, p, i, nombre: r.nombre }; } }
  if (!m || m.p.length < 3) return null;
  const { p, i } = m, a = Math.max(0, i - 2), b = Math.min(p.length - 1, i + 2), ini = Math.max(0, i - 40), fin = Math.min(p.length - 1, i + 40);
  const L = (fin - ini) * 25, ca = cota(...p[ini]), cb = cota(...p[fin]);
  return { nombre: m.nombre || null, distancia: m.d, punto: p[i], rumbo: rumbo(p[a], p[b]), pendiente: L >= 500 && ca != null && cb != null ? Math.max(0, (ca - cb) / L) : null, sinuosidad: L >= 500 ? L / Math.max(1, dist(p[ini], p[fin])) : null, arriba: p[ini] };
}
export function terreno(pos, cota, km = 1.5) {
  const z = cota(...pos); if (z == null) return null; const v = [];
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const c = cota(pos[0] + y / 6 * km / 111.32, pos[1] + x / 6 * km / 111.32 / Math.cos(pos[0] * rad)); if (c != null) v.push(c); }
  return { altura: z, desnivel: Math.max(...v) - Math.min(...v) };
}
const CLASES = [
  [/metamorph|schist|phyll|slate|gneiss|quartzite|amphibol/i, 'metamórfica', 'puede tener vetas de cuarzo con oro', 1],
  [/granit|intrus|pluton|diorit|tonalit|batholith/i, 'granítica o intrusiva', 'sus bordes pueden alojar vetas auríferas', 1],
  [/volcan|andesit|rhyolit|basalt|tuff|lava/i, 'volcánica', 'solo interesa si está alterada o con vetas', .4],
  [/glaci|till|morain/i, 'depósito glacial', 'el oro puede venir de lejos y estar repartido', .5],
  [/alluv|gravel|conglom|fluvial|unconsol|quatern/i, 'grava o relleno reciente', 'depende de la roca que haya aguas arriba', .4],
  [/sediment|silicic|sandstone|shale|marl|limestone|carbonat/i, 'sedimentaria', 'rara vez es la fuente; el oro tendría que llegar de más arriba', .2],
];
export function clasificarRoca(unidades) {
  for (const u of unidades || []) { const t = `${u.lith} ${u.name} ${u.descrip ?? ''}`; for (const [re, nombre, nota, valor] of CLASES) if (re.test(t)) return { nombre, nota, valor }; }
  return null;
}
export const FORMAS = {
  torrente: { nombre: 'Torrente de montaña', texto: 'Mucha fuerza y poca grava estable. El oro, si lo hay, suele quedar en grietas y tras bloques grandes.', oro: 'más bien grueso', pesos: { resguardo: 1.12, grieta: 1.22, remanso: 1.1, barra: .85, curva: .85, seca: .85 } },
  montana: { nombre: 'Río de montaña', texto: 'Alterna rápidos y pozas. Conviene revisar bloques, roca de orilla y el final de cada rápido.', oro: 'grueso a medio', pesos: { resguardo: 1.12, grieta: 1.12, remanso: 1.15 } },
  piedemonte: { nombre: 'Río de piedemonte', texto: 'Empieza a perder fuerza y forma barras: de los mejores tramos para batea y canaleta.', oro: 'medio a fino', pesos: { curva: 1.12, barra: 1.12, resguardo: .95 } },
  llano: { nombre: 'Río de llano', texto: 'Corriente suave, curvas y barras extensas. El oro suele ser muy fino: el detector ayuda poco.', oro: 'fino, en polvo o laminillas', pesos: { curva: 1.15, barra: 1.1, grieta: .75, seca: .7, resguardo: .9 } },
};
export const forma = p => p == null ? null : p >= .04 ? 'torrente' : p >= .015 ? 'montana' : p >= .003 ? 'piedemonte' : 'llano';

export function describirZona({ pos, rios, cota, rocaAqui, rocaArriba, lluvia, historicas }) {
  const rio = rioCercano(rios, pos, cota), t = terreno(pos, cota), f = rio && rio.distancia <= 2000 ? forma(rio.pendiente) : null;
  const aqui = clasificarRoca(rocaAqui), arriba = clasificarRoca(rocaArriba);
  const h = historicas.map(z => ({ n: z.n, km: dist(pos, z.p) / 1000 })).sort((a, b) => a.km - b.km)[0];
  let pts = 0; const razones = [];
  if (h && h.km < 40) { pts += h.km < 15 ? 2 : 1; razones.push(`${h.km < 15 ? 'Dentro del entorno' : 'A menos de 40 km'} de un distrito con lavaderos históricos: ${h.n}.`); } else razones.push('Sin distrito aurífero de nuestra lista a menos de 40 km.');
  const v = Math.max(aqui?.valor || 0, arriba?.valor || 0); pts += v * 1.5;
  if (aqui) razones.push(`Roca ${aqui.nombre}: ${aqui.nota}.`);
  if (arriba && arriba.nombre !== aqui?.nombre) razones.push(`Aguas arriba, roca ${arriba.nombre}: ${arriba.nota}.`);
  if (f) pts += f === 'piedemonte' || f === 'montana' ? .75 : .3;
  const datos = [rios.length > 0, !!t, !!(aqui || arriba)].filter(Boolean).length;
  return { pos, fecha: Date.now(), rio: rio && { ...rio }, terreno: t, forma: f, aqui, arriba, lluvia, razones, pesos: f ? FORMAS[f].pesos : {}, completo: datos === 3, interes: datos < 2 ? null : !rio || rio.distancia > 2000 ? 'sin río cerca' : pts >= 3.6 ? 'alto' : pts >= 2 ? 'medio' : 'bajo' };
}
/** Sentido de la corriente en pantalla según rumbo del río y hacia dónde mira la cámara. */
export function corrienteEnPantalla(rumboRio, camara) { const a = (rumboRio - camara) * rad; return { x: Math.sin(a), y: -Math.cos(a) }; }
/** Rumbo de la cámara trasera con el móvil vertical (W3C DeviceOrientation) */
export function rumboCamara(alpha, beta, gamma) {
  const a = alpha * rad, b = beta * rad, g = gamma * rad;
  return (Math.atan2(-Math.cos(a) * Math.sin(g) - Math.sin(a) * Math.sin(b) * Math.cos(g), -Math.sin(a) * Math.sin(g) + Math.cos(a) * Math.sin(b) * Math.cos(g)) / rad + 360) % 360;
}
