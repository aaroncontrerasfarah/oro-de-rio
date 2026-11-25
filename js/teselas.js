// Ríos desde teselas vectoriales OpenFreeMap (esquema OpenMapTiles)
import Pbf from '../vendor/pbf.js';
import { dist } from './tramo.js';
export function leerRios(buf, z, X, Y) {
  const out = [], n = 2 ** z;
  new Pbf(buf).readFields((tag, _, p) => {
    if (tag !== 3) return;
    const c = { f: [], k: [], v: [], e: 4096, n: '' };
    const fin = p.readVarint() + p.pos;
    p.readFields((t, _, q) => {
      if (t === 1) c.n = q.readString(); else if (t === 3) c.k.push(q.readString()); else if (t === 5) c.e = q.readVarint();
      else if (t === 2) { const F = { g: [], t: [], ty: 0 }, h = q.readVarint() + q.pos; q.readFields((a, _, w) => { if (a === 2) w.readPackedVarint(F.t); else if (a === 3) F.ty = w.readVarint(); else if (a === 4) w.readPackedVarint(F.g); }, null, h); c.f.push(F); }
      else if (t === 4) { let val = null; const h = q.readVarint() + q.pos; q.readFields((a, _, w) => { if (a === 1) val = w.readString(); }, null, h); c.v.push(val); }
    }, null, fin);
    if (c.n !== 'waterway') return;
    for (const F of c.f) {
      if (F.ty !== 2) continue; const tags = {}; for (let i = 0; i < F.t.length; i += 2) tags[c.k[F.t[i]]] = c.v[F.t[i + 1]];
      if (tags.class !== 'river' && tags.class !== 'stream') continue;
      let x = 0, y = 0, i = 0, l = null; const zz = v => (v >> 1) ^ -(v & 1);
      const cerrar = () => { if (l?.length > 1) out.push({ nombre: tags.name, puntos: l.map(([a, b]) => [Math.atan(Math.sinh(Math.PI * (1 - 2 * (Y + b / c.e) / n))) * 180 / Math.PI, (X + a / c.e) / n * 360 - 180]) }); };
      while (i < F.g.length) { const cmd = F.g[i] & 7, k = F.g[i++] >> 3; for (let j = 0; j < k && cmd !== 7; j++) { x += zz(F.g[i++]); y += zz(F.g[i++]); if (cmd === 1) { cerrar(); l = []; }
        l.push([x, y]); } }
      // Recortar el margen de la tesela para que los tramos vecinos empalmen
      if (l) { const todo = l; l = null; let prev = null; const D = q => q[0] >= 0 && q[1] >= 0 && q[0] <= c.e && q[1] <= c.e;
        const corte = (a, b) => { let t = 1; for (const k of [0, 1]) { const d = b[k] - a[k]; if (b[k] < 0) t = Math.min(t, -a[k] / d); if (b[k] > c.e) t = Math.min(t, (c.e - a[k]) / d); } return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
        for (const q of todo) { const dentro = D(q); if (dentro) { if (!l) l = prev ? [corte(q, prev)] : []; l.push(q); } else if (l) { l.push(corte(l[l.length - 1], q)); cerrar(); l = null; } prev = q; } cerrar(); }
    }
  });
  return out;
}
/** Une final con inicio (mismo nombre, <4 m) */
export function empalmar(r) {
  r = r.map(x => ({ ...x, puntos: [...x.puntos] }));
  for (let hecho = true; hecho;) { hecho = false;
    for (let i = 0; i < r.length && !hecho; i++) for (let j = 0; j < r.length; j++) { if (i === j || r[i].nombre !== r[j].nombre) continue;
      const a = r[i].puntos, b = r[j].puntos; if (dist(a[a.length - 1], b[0]) < 4) { r[i].puntos = a.concat(b.slice(1)); r.splice(j, 1); hecho = true; break; } } }
  return r;
}
/** El agua baja: invierte líneas dibujadas al revés según el relieve */
export const orientar = (r, cota) => r.map(x => { const a = cota(...x.puntos[0]), b = cota(...x.puntos[x.puntos.length - 1]); return a != null && b != null && b > a + 8 ? { ...x, puntos: [...x.puntos].reverse() } : x; });
