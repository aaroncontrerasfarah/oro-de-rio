import { describirZona, FORMAS, rioCercano } from './zona.js'; import { rios, relieve, geologia, lluvia, caja } from './fuentes.js'; import { orientar } from './teselas.js'; import { ZONAS } from './textos.js'; import { dist } from './tramo.js';
const K = 'oro.zonas', leer = () => { try { return JSON.parse(localStorage.getItem(K)) || []; } catch { return []; } };
export let zona = null;
export const ubicar = () => new Promise((si, no) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(g => si({ pos: [g.coords.latitude, g.coords.longitude], error: g.coords.accuracy }), no, { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 }) : no(new Error('sin gps')));
export const usar = z => zona = z;
export async function reconocer(pos) {
  const b = caja(...pos, 3); let r = [], cota = () => null, fallo = false;
  const [R, C, ga, ll] = await Promise.allSettled([rios(b), relieve(b), geologia(...pos), lluvia(...pos)]);
  if (R.status === 'fulfilled') r = R.value; else fallo = true;
  if (C.status === 'fulfilled') cota = C.value;
  r = orientar(r, cota);
  const rc = rioCercano(r, pos, cota);
  const garr = rc && dist(rc.arriba, pos) > 300 ? await geologia(...rc.arriba) : null;
  const z = describirZona({ pos, rios: r, cota, rocaAqui: ga.value, rocaArriba: garr, lluvia: ll.value ?? null, historicas: ZONAS });
  if (fallo || z.interes == null) { // sin red: perfil guardado cercano
    const g = leer().map(q => ({ q, d: dist(q.pos, pos) })).filter(x => x.d < 3000).sort((x, y) => x.d - y.d)[0];
    if (g) return zona = { ...g.q, guardada: g.d };
    if (fallo && z.interes == null) return zona = null;
  } else if (z.completo) try { localStorage.setItem(K, JSON.stringify([z, ...leer().filter(q => dist(q.pos, pos) > 200)].slice(0, 30))); } catch { }
  return zona = z;
}
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`), n = (v, d = 0) => v.toLocaleString('es-CL', { maximumFractionDigits: d });
export function tarjeta(z) {
  if (!z) return '<h2>Zona sin reconocer</h2><p>No hay conexión ni datos guardados de este lugar. La cámara funciona igual, con reglas generales.</p>';
  const F = FORMAS[z.forma], r = z.rio, f = [];
  if (r) f.push(['Río', `${esc(r.nombre || 'Cauce sin nombre')}, a ${r.distancia < 1000 ? n(r.distancia) + ' m' : n(r.distancia / 1000, 1) + ' km'}`]);
  if (r?.pendiente != null) f.push(['Pendiente', `${n(r.pendiente * 100, 1)} %${r.sinuosidad > 1.3 ? ', con curvas marcadas' : r.sinuosidad ? ', bastante recto' : ''}`]);
  if (z.terreno) f.push(['Relieve', `${n(z.terreno.altura)} m de altura, ${z.terreno.desnivel > 400 ? 'valle encajado' : z.terreno.desnivel > 120 ? 'lomas y laderas' : 'terreno abierto'}`]);
  if (z.aqui) f.push(['Roca', esc(z.aqui.nombre)]);
  if (F) f.push(['Si hay oro', 'probablemente ' + F.oro]);
  if (z.lluvia != null && !z.guardada) f.push(['Lluvia', `${n(z.lluvia)} mm, últimos 2 días a mañana`]);
  return `<h2>${F ? F.nombre : r && r.distancia <= 2000 ? 'Río de tipo no determinado' : 'Sin río cerca'}</h2>${z.interes ? `<p class="interes ${z.interes === 'alto' ? 'alto' : ''}">${z.interes === 'sin río cerca' ? 'No hay río a menos de 2 km' : `Interés para prospectar: ${z.interes}`}</p>` : ''}${F ? `<p>${F.texto}</p>` : ''}<dl>${f.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl><p>${z.razones.map(esc).join(' ')}</p>${z.lluvia > 25 && !z.guardada ? '<p><b>Riesgo de crecida: no entres al cauce.</b></p>' : ''}${z.guardada != null ? `<p>Datos guardados, tomados a ${n(z.guardada)} m de aquí.</p>` : ''}${z.completo ? '' : '<p>Faltan datos: hay fuentes que no respondieron.</p>'}<p class="nota">Orientativo: geología a escala regional. No prueba que haya oro ni que esté permitido extraerlo.</p>`;
}
