import * as camara from './camara.js'; import * as mapa from './mapa.js'; import * as diario from './diario.js'; import { GUIA } from './textos.js';
document.getElementById('guia').innerHTML = GUIA; diario.pintar(); camara.iniciar();
document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.vista').forEach(v => v.classList.toggle('activa', v.id === b.dataset.v));
  document.querySelectorAll('nav button').forEach(x => x === b ? x.setAttribute('aria-current', 'page') : x.removeAttribute('aria-current'));
  if (b.dataset.v === 'mapa') mapa.iniciar();
});
if ('serviceWorker' in navigator && !location.search.includes('dev')) navigator.serviceWorker.register('sw.js').catch(() => {});
