import { N, AGUA, ROCA, SEDIMENTO, TIPOS, detectarTrampas, medirCorriente, resumirCorriente } from './trampas.js';
import { abrirRegistro } from './diario.js';
const $ = id => document.getElementById(id);
const escena = $('escena'), marco = $('marco'), video = $('video'), foto = $('foto'), capa = $('capa'), marcas = $('marcas');
let w, pend = new Map(), sec = 0, listo = false, modo = null, flujo = { x: 1, y: 0 }, flujoDado = false, vel = null, ult = null, zonas = [], sel = 0, imagen = null, turno = 0, midiendo = false, pincel = null;
const decir = t => $('estado').textContent = t || '';

function obrero() {
  if (w) return; w = new Worker('js/vision.js', { type: 'module' });
  w.onmessage = ({ data }) => {
    if (data.listo) { listo = true; return; }
    if (data.id == null) { w = null; for (const p of pend.values()) p.no(new Error(data.error)); pend.clear(); return decir('No se pudo cargar el reconocimiento. Abre la app una vez con conexión.'); }
    const p = pend.get(data.id); pend.delete(data.id); data.error ? p?.no(new Error(data.error)) : p?.si(data);
  };
  w.onerror = () => { decir('Este navegador no puede ejecutar el reconocimiento. Actualízalo.'); w = null; for (const p of pend.values()) p.no(new Error('worker')); pend.clear(); };
}
const inferir = rgba => new Promise((si, no) => { obrero(); const id = ++sec; pend.set(id, { si, no }); w.postMessage({ id, rgba }, [rgba.buffer]); });

function encajar() {
  const W = escena.clientWidth, H = escena.clientHeight; let a = W, b = H;
  if (modo === 'foto' && imagen) { const k = Math.min(W / imagen.width, H / imagen.height); a = imagen.width * k; b = imagen.height * k; }
  Object.assign(marco.style, { width: a + 'px', height: b + 'px', left: (W - a) / 2 + 'px', top: (H - b) / 2 + 'px' });
  const d = Math.min(2, devicePixelRatio || 1);
  for (const c of [foto, capa]) { c.width = a * d; c.height = b * d; }
  if (modo === 'foto' && imagen) foto.getContext('2d').drawImage(imagen, 0, 0, foto.width, foto.height);
  pintar();
}
new ResizeObserver(encajar).observe(escena);

/** Recorte visible del vídeo (cover) o la foto entera */
function copiar(ctx, w, h) {
  if (modo === 'foto') return ctx.drawImage(imagen, 0, 0, w, h);
  const vw = video.videoWidth, vh = video.videoHeight, k = Math.max(marco.clientWidth / vw, marco.clientHeight / vh);
  const sw = marco.clientWidth / k, sh = marco.clientHeight / k;
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h);
}
const lienzo = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c.getContext('2d', { willReadFrequently: true }); };
const x512 = lienzo(512, 512);

async function analizar() {
  const t = turno; copiar(x512, 512, 512);
  if (!listo) decir('Cargando reconocimiento…');
  const r = await inferir(x512.getImageData(0, 0, 512, 512).data);
  if (t !== turno) return; ult = r; recalcular();
}
function recalcular() {
  if (!ult) return;
  // La dirección está en píxeles de pantalla; la rejilla está estirada
  const f = { x: flujo.x / (marco.clientWidth || 1), y: flujo.y / (marco.clientHeight || 1) };
  const r = detectarTrampas(ult.mat, f, ult.espuma, vel); zonas = r.zonas.filter((z, i, a) => !a.slice(0, i).some(q => Math.hypot((q.x - z.x) * marco.clientWidth, (q.y - z.y) * marco.clientHeight) < 48)); sel = Math.min(sel, Math.max(0, zonas.length - 1));
  decir(r.agua < .02 ? 'No veo agua. Encuadra el cauce y sus orillas.' : !zonas.length ? 'Veo agua, pero ninguna trampa clara. Busca rocas, barras de grava o una curva.' : !flujoDado ? 'Desliza el dedo sobre el agua hacia donde corre.' : `${zonas.length} ${zonas.length === 1 ? 'zona' : 'zonas'} para probar`);
  pintar();
}
function pintar() {
  const c = capa.getContext('2d'), W = capa.width, H = capa.height; c.clearRect(0, 0, W, H); marcas.textContent = '';
  if (modo && ult) {
    const m = lienzo(N, N), im = m.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const q = { [AGUA]: [40, 150, 190, 45], [ROCA]: [99, 224, 255, 75], [SEDIMENTO]: [255, 215, 130, 75] }[ult.mat[i]];
      if (q) im.data.set(q, i * 4);
    }
    m.putImageData(im, 0, 0); c.imageSmoothingEnabled = true; c.drawImage(m.canvas, 0, 0, W, H);
    zonas.forEach((z, k) => {
      const x = z.x * W, y = z.y * H, r = Math.max(48 * W / (marco.clientWidth || 1), z.r * Math.sqrt(W * H) * 1.6), col = TIPOS[z.tipo].util === 'detector' ? '99,224,255' : '255,197,38';
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},.85)`); g.addColorStop(.55, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
      const b = document.createElement('button'); b.className = 'marca ' + TIPOS[z.tipo].util; b.textContent = k + 1;
      const A = marco.clientWidth, B = marco.clientHeight; b.style.left = Math.min(A - 22, Math.max(22, z.x * A)) + 'px'; b.style.top = Math.min(B - 22, Math.max(22, z.y * B)) + 'px'; b.setAttribute('aria-pressed', k === sel); b.setAttribute('aria-label', `Zona ${k + 1}: ${TIPOS[z.tipo].nombre}`);
      b.onclick = () => { sel = k; pintar(); }; marcas.append(b);
    });
  }
  const z = modo && zonas[sel], R = $('resultado'); R.textContent = '';
  if (z) {
    const T = TIPOS[z.tipo];
    R.innerHTML = `<article><h2>${sel + 1}. ${T.nombre}</h2><p><b>Prioridad ${z.nivel}.</b> ${T.porque}</p><p>${T.hacer}</p><p>Empieza con: <b>${T.util === 'detector' ? 'detector VLF, luego batea' : 'batea, luego canaleta'}</b>${flujoDado ? '' : '. Indica la corriente para afinar.'}</p></article>`;
    const b = document.createElement('button'); b.className = 'claro'; b.textContent = 'Anotar en bitácora'; b.onclick = () => abrirRegistro(T.nombre); R.firstChild.append(b);
  }
  const a = Math.atan2(flujo.y, flujo.x) * 180 / Math.PI; $('rumbo').firstElementChild.style.transform = `rotate(${a}deg)`; $('rumbo').classList.toggle('pendiente', !flujoDado);
}
function activar(m) {
  modo = m; turno++; ult = null; zonas = []; vel = null; sel = 0; flujoDado = false; flujo = { x: 1, y: 0 };
  escena.classList.add('activo'); $('mandos').hidden = false; video.hidden = m !== 'video'; video.style.display = m === 'video' ? '' : 'none'; foto.style.display = m === 'video' ? 'none' : '';
  $('disparo').textContent = m === 'video' ? 'Congelar' : 'Cámara'; pincel = null; $('medir').textContent = m === 'video' ? 'Medir corriente' : 'Corregir'; encajar();
}
function parar() { video.srcObject?.getTracks().forEach(t => t.stop()); video.srcObject = null; }

export async function abrir() {
  if (!navigator.mediaDevices?.getUserMedia) return decir('La cámara en vivo necesita https. Puedes usar una foto.');
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    parar(); video.srcObject = s; await video.play(); imagen = null; activar('video'); bucle();
  } catch (e) { decir(e.name === 'NotAllowedError' ? 'Cámara bloqueada. Permítela en los ajustes del navegador, o usa una foto.' : 'No encuentro una cámara disponible. Usa una foto.'); }
}
async function bucle() {
  const t = turno; 
  while (modo === 'video' && t === turno && video.srcObject) {
    if (midiendo || document.hidden || !$('camara').classList.contains('activa')) { await new Promise(r => setTimeout(r, 400)); continue; }
    try { await analizar(); } catch { decir('Falló el análisis. Vuelve a intentarlo.'); return; }
    await new Promise(r => setTimeout(r, 250));
  }
}
function congelar() {
  const c = lienzo(Math.max(1, marco.clientWidth * 2), Math.max(1, marco.clientHeight * 2)); copiar(c, c.canvas.width, c.canvas.height);
  const f = flujo, fd = flujoDado, v = vel; imagen = c.canvas; parar(); activar('foto'); flujo = f; flujoDado = fd; vel = v; analizar().catch(() => decir('Falló el análisis. Vuelve a intentarlo.'));
}
export async function usarFoto(blob) {
  try {
    const im = await createImageBitmap(blob, { imageOrientation: 'from-image' }); parar(); imagen = im;
    activar('foto'); decir('Analizando…'); await analizar();
  } catch (e) { console.error(e); decir('No se pudo analizar esa foto. Prueba con una JPG.'); }
}
async function medir() {
  if (!ult || midiendo) return; midiendo = true; const t = turno, W = 160, H = Math.max(80, Math.round(160 * marco.clientHeight / marco.clientWidth)), c = lienzo(W, H), muestras = [];
  decir('Mantén el teléfono quieto 3 segundos…');
  const gris = () => { copiar(c, W, H); const d = c.getImageData(0, 0, W, H).data, g = new Float32Array(W * H); for (let i = 0; i < g.length; i++) g[i] = .3 * d[i * 4] + .59 * d[i * 4 + 1] + .11 * d[i * 4 + 2]; return g; };
  let a = gris(); const fin = performance.now() + 3000;
  while (performance.now() < fin && t === turno && modo === 'video') { await new Promise(r => setTimeout(r, 80)); const b = gris(); muestras.push(...medirCorriente(a, b, W, H, ult.mat)); a = b; }
  midiendo = false; if (t !== turno) return;
  const r = resumirCorriente(muestras);
  if (r?.fiable) { const x = r.x * marco.clientWidth, y = r.y * marco.clientHeight, l = Math.hypot(x, y); flujo = { x: x / l, y: y / l }; flujoDado = true; vel = r.velocidad; recalcular(); }
  else decir('No pude medir la corriente. Apoya el teléfono, o desliza el dedo hacia donde corre.');
}
export function iniciar() {
  $('abrir').onclick = abrir; $('elegir').onclick = $('otra').onclick = () => $('archivo').click();
  $('archivo').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) usarFoto(f); };
  $('disparo').onclick = () => modo === 'video' ? congelar() : abrir(); $('medir').onclick = () => { if (modo === 'video') return medir(); pincel = pincel == null ? AGUA : pincel === AGUA ? ROCA : pincel === ROCA ? SEDIMENTO : null; $('medir').textContent = { [AGUA]: 'Pintando agua', [ROCA]: 'Pintando roca', [SEDIMENTO]: 'Pintando grava' }[pincel] || 'Corregir'; if (pincel != null) decir('Pinta con el dedo lo que no reconoció. Toca el botón para cambiar de material.'); else recalcular(); };
  $('rumbo').onclick = () => { const a = Math.round(Math.atan2(flujo.y, flujo.x) / (Math.PI / 4)) * Math.PI / 4 + Math.PI / 4; flujo = { x: Math.cos(a), y: Math.sin(a) }; flujoDado = true; vel = null; recalcular(); pintar(); };
  const pintarDedo = e => { if (!ult || modo !== 'foto') return; const b = marco.getBoundingClientRect(), gx = (e.clientX - b.left) / b.width * N, gy = (e.clientY - b.top) / b.height * N, R = N * 18 / b.width, S = N * 18 / b.height; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (((x - gx) / R) ** 2 + ((y - gy) / S) ** 2 <= 1) ult.mat[y * N + x] = pincel; pintar(); };
  escena.addEventListener('pointerdown', e => { if (pincel == null || e.target.closest('button')) return; e.stopImmediatePropagation(); pintarDedo(e); const mv = q => pintarDedo(q), up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); recalcular(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up); });
  let p = null; addEventListener('pointercancel', () => p = null); escena.addEventListener('pointerdown', e => p = e.target.closest('button') ? null : [e.clientX, e.clientY]);
  addEventListener('pointerup', e => { if (!p || !modo) return; const x = e.clientX - p[0], y = e.clientY - p[1], l = Math.hypot(x, y); p = null; if (l < 40) return; flujo = { x: x / l, y: y / l }; flujoDado = true; vel = null; recalcular(); pintar(); });
  // Depuración y pruebas: window.usarFoto(blob)
  window.usarFoto = usarFoto;
}
