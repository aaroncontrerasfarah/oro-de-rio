import { candidatos } from './tramo.js'; import { orientar } from './teselas.js'; import { traer, rios, relieve } from './fuentes.js'; import { ZONAS } from './textos.js'; import { abrirRegistro, registros } from './diario.js';
const $ = id => document.getElementById(id), I = $('infomapa'); let m, capa, pruebas, yo;
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
const QUE = { curva: ['Interior de curva', 'La corriente pierde fuerza por dentro. Busca la barra de grava y empieza por su extremo aguas arriba.'], pendiente: ['Cambio de pendiente', 'El río deja de caer tan fuerte: aquí suelta grava gruesa y minerales pesados.'], confluencia: ['Confluencia', 'Dos corrientes se frenan al juntarse. Muestrea la barra de la unión y compara ambos ríos aguas arriba.'] };
export function iniciar() {
  if (m) { m.invalidateSize(); return marcarPruebas(); }
  m = L.map('lienzo').setView([-38.5, -72.5], 6);
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Imagen: Esri, Maxar' }), topo = L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '© OpenStreetMap, SRTM, OpenTopoMap (CC-BY-SA)' }), osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap, OpenFreeMap © OpenMapTiles' }).addTo(m);
  m.attributionControl.setPrefix(false); L.control.layers({ Calles: osm, Satélite: sat, Relieve: topo }).addTo(m); L.control.scale({ imperial: false }).addTo(m); capa = L.layerGroup().addTo(m); pruebas = L.layerGroup().addTo(m); marcarPruebas();
  ZONAS.forEach((z, i) => { $('zonas').add(new Option(z.n, i)); L.circle(z.p, { radius: 4000, color: '#b98500', weight: 2, fillOpacity: .12 }).addTo(m).bindPopup(`<b>${esc(z.n)}</b><br>${esc(z.d)}<br>Ubicación aproximada.`); });
  $('zonas').onchange = e => { const z = ZONAS[e.target.value]; if (e.target.value === '') return; m.setView(z.p, 13); I.innerHTML = `<h2>${z.n}</h2><p>${z.d} Ubicación aproximada. Comprueba si hay concesiones antes de ir.</p>`; };
  $('gps').onclick = () => navigator.geolocation?.getCurrentPosition(g => { const p = [g.coords.latitude, g.coords.longitude]; m.setView(p, 15); yo?.remove(); yo = L.circle(p, { radius: g.coords.accuracy, color: '#0b5c6b' }).addTo(m); }, () => I.innerHTML = '<p>No se pudo obtener tu ubicación. Activa el GPS y permite el acceso.</p>', { enableHighAccuracy: true, timeout: 15000 });
  $('analizar').onclick = buscar; m.on('click', e => abrirPunto(e.latlng));
}
function marcarPruebas() { pruebas.clearLayers(); for (const r of registros()) if (r.pos) L.circleMarker([r.pos.lat, r.pos.lon], { radius: 8, color: '#12312f', fillColor: +r.mg > 0 || +r.colores > 0 ? '#ffc526' : '#fff', fillOpacity: 1 }).addTo(pruebas).bindPopup(`${esc(r.lugar)}<br>${esc(r.mg || 0)} mg, ${esc(r.colores || 0)} colores`); }
async function buscar() {
  if (m.getZoom() < 12) { I.innerHTML = '<p>Acércate más al río (hasta ver unos pocos kilómetros) y vuelve a buscar.</p>'; return; }
  const B = $('analizar'), b = m.getBounds(); B.disabled = true; I.innerHTML = '<p>Leyendo ríos y relieve…</p>';
  try {
    const [crudo, cota] = await Promise.all([rios(b), relieve(b)]), lista = orientar(crudo, cota);
    const c = candidatos(lista, cota).filter(q => b.contains([q.lat, q.lon])); capa.clearLayers();
    lista.forEach(r => L.polyline(r.puntos, { color: '#1b7fa3', weight: 3 }).addTo(capa));
    c.forEach(q => L.circleMarker([q.lat, q.lon], { radius: 7 + q.puntaje * 7, color: '#12312f', weight: 2, fillColor: '#ffc526', fillOpacity: .5 + q.puntaje / 2 }).addTo(capa).on('click', e => { L.DomEvent.stop(e); detalle(q); }));
    I.innerHTML = c.length ? `<h2>${c.length} puntos para explorar</h2><p>Círculo más grande, mayor prioridad. Se calculan con la forma del río y el relieve, no con hallazgos de oro.</p>` : `<p>${lista.length ? 'Este tramo es demasiado recto para destacar puntos.' : 'No hay ríos cartografiados en esta vista.'}</p>`;
  } catch (e) { console.warn(e); I.innerHTML = '<p>No se pudieron descargar los ríos. Comprueba la conexión y vuelve a buscar.</p>'; }
  B.disabled = false;
}
async function detalle(q) { const [n, d] = QUE[q.tipo]; await ficha({ lat: q.lat, lng: q.lon }, `<h2>${n}</h2><p>${esc(q.rio)}. ${d}</p>`, n); }
const abrirPunto = p => ficha(p, '<h2>Punto elegido</h2>', 'Punto del mapa');
let nf = 0;
async function ficha(p, cab, nombre) {
  const k = ++nf; I.innerHTML = cab + `<p>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</p><p class="ex">Consultando geología y clima…</p>`; const b = document.createElement('button'); b.className = 'claro'; b.textContent = 'Anotar en bitácora'; b.onclick = () => abrirRegistro(nombre, { lat: p.lat, lon: p.lng }); I.append(b);
  const la = p.lat.toFixed(3), lo = p.lng.toFixed(3), J = u => traer(u, {}, 12000).then(r => r.json()).catch(() => null);
  const [g, f, c] = await Promise.all([J(`https://macrostrat.org/api/v2/geologic_units/map?lat=${la}&lng=${lo}&response=short`), J(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&daily=precipitation_sum&past_days=2&forecast_days=2&timezone=auto`), J(`https://flood-api.open-meteo.com/v1/flood?latitude=${la}&longitude=${lo}&daily=river_discharge&past_days=30&forecast_days=2`)]);
  if (k !== nf) return; const t = [], u = g?.success?.data?.[0]; if (u) t.push(`Roca regional: ${esc(u.lith || u.name)} (Macrostrat, escala general, en inglés).`);
  const pr = f?.daily?.precipitation_sum; if (pr) { const s = pr.reduce((a, v) => a + (v || 0), 0); t.push(`Lluvia, 2 días previos a mañana: ${s.toFixed(0)} mm.${s > 25 ? ' <b>Riesgo de crecida: no entres al cauce.</b>' : ''}`); }
  const q = c?.daily?.river_discharge?.filter(v => v != null); if (q?.length > 10) { const med = [...q].sort((a, b) => a - b)[q.length >> 1], h = q[q.length - 2]; t.push(`Caudal modelado: ${h.toFixed(1)} m³/s${h > med * 1.6 ? ', <b>muy por encima de lo habitual del mes</b>' : h < med * .8 ? ', bajo: buen momento para barras expuestas' : ', cercano a lo habitual del mes'}. Es una estimación de celda de 5 km.`); }
  const e = I.querySelector('.ex'); if (e) e.innerHTML = t.join('<br>') || 'Sin datos de geología ni clima. Comprueba la conexión.';
}
