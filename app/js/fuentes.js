// Descargas: ríos, relieve, geología y clima
import { leerRios, empalmar } from './teselas.js';
export async function traer(u, o = {}, ms = 30000) { const r = await fetch(u, { ...o, signal: AbortSignal.timeout(ms) }); if (!r.ok) throw new Error(r.status); return r; }
let plantilla;
export async function rios(b) {
  try {
    plantilla ||= (await (await traer('https://tiles.openfreemap.org/planet', {}, 15000)).json()).tiles[0];
    const z = 14, n = 2 ** z, tx = lo => Math.floor((lo + 180) / 360 * n), ty = la => Math.floor((1 - Math.asinh(Math.tan(la * Math.PI / 180)) / Math.PI) / 2 * n), P = [];
    for (let x = tx(b.getWest()); x <= tx(b.getEast()); x++) for (let y = ty(b.getNorth()); y <= ty(b.getSouth()); y++) P.push(traer(plantilla.replace('{z}', z).replace('{x}', x).replace('{y}', y), {}, 20000).then(r => r.arrayBuffer()).then(a => a.byteLength ? leerRios(a, z, x, y) : []));
    return empalmar((await Promise.all(P)).flat());
  } catch (e) {
    console.warn('teselas', e);
    const q = `[out:json][timeout:20];way(${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()})[waterway~"^(river|stream)$"];out geom;`;
    const j = await (await traer('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: q }) }, 20000)).json();
    return j.elements.filter(w => w.geometry).map(w => ({ nombre: w.tags?.name, puntos: w.geometry.map(g => [g.lat, g.lon]) }));
  }
}
export async function relieve(b) {
  const z = 13, n = 2 ** z, tx = lo => (lo + 180) / 360 * n, ty = la => { const s = Math.asinh(Math.tan(la * Math.PI / 180)); return (1 - s / Math.PI) / 2 * n; }, T = new Map(), P = [];
  for (let x = Math.floor(tx(b.getWest())); x <= tx(b.getEast()); x++) for (let y = Math.floor(ty(b.getNorth())); y <= ty(b.getSouth()); y++) P.push((async () => { try { const im = await createImageBitmap(await (await traer(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`)).blob(), { colorSpaceConversion: 'none' }), c = new OffscreenCanvas(256, 256).getContext('2d'); c.drawImage(im, 0, 0); T.set(x + '/' + y, c.getImageData(0, 0, 256, 256).data); } catch { } })());
  await Promise.all(P);
  return (la, lo) => { const X = tx(lo), Y = ty(la), d = T.get(Math.floor(X) + '/' + Math.floor(Y)); if (!d) return null; const i = (Math.floor(Y % 1 * 256) * 256 + Math.floor(X % 1 * 256)) * 4; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768; };
}

export const json = u => traer(u, {}, 12000).then(r => r.json()).catch(() => null);
export const geologia = (la, lo) => json(`https://macrostrat.org/api/v2/geologic_units/map?lat=${la.toFixed(3)}&lng=${lo.toFixed(3)}&response=short`).then(g => g?.success?.data ?? null);
export const lluvia = (la, lo) => json(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}&daily=precipitation_sum&past_days=2&forecast_days=2&timezone=auto`).then(f => f?.daily?.precipitation_sum?.reduce((a, v) => a + (v || 0), 0) ?? null);
export const caja = (la, lo, km) => { const a = km / 111.32, o = a / Math.cos(la * Math.PI / 180); return { getSouth: () => la - a, getNorth: () => la + a, getWest: () => lo - o, getEast: () => lo + o }; };
