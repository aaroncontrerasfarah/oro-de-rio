# Oro de río

Web instalable que marca sobre la cámara dónde un río tiende a depositar oro. Carpeta publicable: `app/`.

- Probar en este Mac: `npm start` y abrir http://localhost:5199. Tests: `npm test`.
- En el móvil: la cámara exige https. Publica `app/` en cualquier alojamiento estático (Netlify, Cloudflare Pages, GitHub Pages), abre el enlace y usa «Añadir a pantalla de inicio». Ábrela una vez con señal (baja unos 16 MB) y espera un minuto antes de ir al río.
- Al cambiar archivos de `app/`, sube el número `oro-v1` en `app/sw.js`.

Piezas: `js/trampas.js` (reglas hidráulicas y corriente), `js/vision.js` (SegFormer en el dispositivo), `js/tramo.js` y `js/teselas.js` (mapa), `js/diario.js`, `js/textos.js`.

## Licencias
ONNX Runtime Web (MIT), Leaflet (BSD-2), pbf (BSD-3), Familjen Grotesk (OFL). **SegFormer-B0 (NVIDIA) solo permite uso no comercial**: cambia el modelo antes de vender la app.
Datos: OpenStreetMap/OpenFreeMap, OpenTopoMap, Esri, Terrarium (AWS), Macrostrat, Open-Meteo (gratis para uso no comercial).

## Límites
Es una ayuda para elegir dónde muestrear; no detecta oro. Los pesos de prioridad son criterio de prospección, no están calibrados con hallazgos chilenos. Las zonas del mapa son aproximadas y no hay capa de concesiones.

## Publicar
`gh auth login` una vez y después `./publicar.sh`. El repositorio y la web son públicos.
