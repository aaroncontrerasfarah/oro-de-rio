import { ley } from './tramo.js';
const K = 'oro.diario', D = document.getElementById('diario');
const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || []; } catch { return []; } };
const guardar = a => { try { localStorage.setItem(K, JSON.stringify(a)); return true; } catch { return false; } };
const t = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
let pos = null;
export const registros = leer;
export function abrirRegistro(lugar = '', p = null) { document.querySelector('nav [data-v=diario]').click(); pintar(); D.querySelector('[name=lugar]').value = lugar; pos = p; if (!p) ubicar(); else donde(); }
function donde(txt) { const e = D.querySelector('#donde'); if (e) e.textContent = txt || (pos ? `Ubicación: ${pos.lat.toFixed(5)}, ${pos.lon.toFixed(5)}` : 'Sin ubicación'); }
function ubicar() { donde('Buscando ubicación…'); navigator.geolocation?.getCurrentPosition(g => { pos = { lat: g.coords.latitude, lon: g.coords.longitude }; donde(); }, () => donde('Sin ubicación. Activa el GPS y vuelve a intentarlo.'), { enableHighAccuracy: true, timeout: 15000 }); }
export function pintar() {
  D.innerHTML = `<h1>Bitácora</h1><form><label class="ancho">Lugar probado<input name="lugar" required placeholder="Ej.: detrás del bloque grande"></label>
  <label>Método<select name="metodo" style="min-height:48px"><option>Batea</option><option>Canaleta</option><option>Detector VLF</option></select></label>
  <label>Bateas lavadas<input name="bateas" type="number" min="0" step="1" inputmode="numeric"></label>
  <label>Litros por batea<input name="litros" type="number" min="0" step=".5" value="8" inputmode="decimal"></label>
  <label>Oro (mg)<input name="mg" type="number" min="0" step=".1" inputmode="decimal"></label>
  <label>Colores vistos<input name="colores" type="number" min="0" inputmode="numeric"></label>
  <label class="ancho">Notas<textarea name="notas" rows="2"></textarea></label>
  <p class="ancho" id="donde" style="margin:0">Sin ubicación</p><button type="button" class="claro" id="ub">Tomar ubicación</button><button class="principal">Guardar prueba</button></form><h2>Pruebas guardadas</h2><div id="lista"></div>`;
  D.querySelector('#ub').onclick = ubicar;
  D.querySelector('form').onsubmit = e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const ok = guardar([{ ...f, pos, fecha: new Date().toISOString(), id: Date.now() }, ...leer()]); if (!ok) return donde('No hay espacio para guardar. Exporta y borra pruebas antiguas.'); pos = null; pintar(); };
  const L = D.querySelector('#lista'), a = leer();
  if (!a.length) L.append(t('p', 'Anota también las pruebas sin oro: comparar es lo que te lleva al tramo bueno.'));
  for (const r of a) {
    const g = r.mg !== '' ? ley(+r.mg, +r.bateas, +r.litros) : null, d = t('div', null, 'reg'), c = t('div');
    c.append(t('p', r.lugar)); c.firstChild.style.fontWeight = 700;
    c.append(t('p', [new Date(r.fecha).toLocaleDateString('es-CL'), r.metodo, r.colores && `${r.colores} colores`, r.mg && `${r.mg} mg`, g != null && `${g.toFixed(3)} g/m³ de muestra`].filter(Boolean).join(', ')));
    if (r.notas) c.append(t('p', r.notas)); if (r.pos) c.append(t('p', `${r.pos.lat.toFixed(5)}, ${r.pos.lon.toFixed(5)}`));
    const b = t('button', 'Borrar', 'claro'); b.onclick = () => { if (confirm('¿Borrar esta prueba? No se puede deshacer.')) { guardar(leer().filter(x => x.id !== r.id)); pintar(); } }; d.append(c, b); L.append(d);
  }
  if (a.length) { const b = t('button', 'Exportar CSV', 'claro'); b.onclick = () => { const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s) && isNaN(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }, csv = ['fecha,lugar,metodo,bateas,litros,mg,colores,lat,lon,notas', ...a.map(r => [r.fecha, r.lugar, r.metodo, r.bateas, r.litros, r.mg, r.colores, r.pos?.lat, r.pos?.lon, r.notas].map(q).join(','))].join('\n'); const l = document.createElement('a'); l.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); l.download = 'bitacora-oro.csv'; l.click(); }; L.append(b); }
}
