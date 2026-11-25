// Análisis de un tramo de río desde el mapa. OSM dibuja los ríos aguas abajo.
const R = 6371000, rad = Math.PI / 180;
export const dist = (a, b) => {
  const dx = (b[1] - a[1]) * rad * Math.cos((a[0] + b[0]) / 2 * rad), dy = (b[0] - a[0]) * rad;
  return R * Math.hypot(dx, dy);
};
export function remuestrear(pts, paso = 25) {
  if (pts.length < 2) return pts.slice();
  const out = [pts[0]]; let falta = paso;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1], d = dist(a, pts[i]);
    while (d >= falta && d > 0) {
      const t = falta / d; a = [a[0] + (pts[i][0] - a[0]) * t, a[1] + (pts[i][1] - a[1]) * t];
      out.push(a); d = dist(a, pts[i]); falta = paso;
    }
    falta -= d;
  }
  return out;
}
/** Devuelve puntos candidatos {lat,lon,tipo,puntaje}. cota(lat,lon)->m o null */
export function candidatos(rios, cota = () => null, paso = 25) {
  const out = [];
  const nombreDe = r => r.nombre || 'Sin nombre';
  const lineas = rios.map(r => ({ ...r, p: remuestrear(r.puntos, paso) }));
  for (const r of lineas) {
    const V = 4, p = r.p, giro = new Array(p.length).fill(0);
    const k = Math.cos((p[0]?.[0] ?? 0) * rad);
    for (let i = V; i < p.length - V; i++) {
      const ax = (p[i][1] - p[i - V][1]) * k, ay = p[i][0] - p[i - V][0], bx = (p[i + V][1] - p[i][1]) * k, by = p[i + V][0] - p[i][0];
      giro[i] = Math.atan2(ax * by - ay * bx, ax * bx + ay * by); // + = gira a la izquierda
    }
    for (let i = V; i < p.length - V; i++) {
      const g = Math.abs(giro[i]);
      if (g < .6 || giro.slice(Math.max(0, i - 6), i + 7).some(v => Math.abs(v) > g)) continue;
      const tx = (p[i + 1][1] - p[i - 1][1]) * k, ty = p[i + 1][0] - p[i - 1][0], L = Math.hypot(tx, ty) || 1, s = Math.sign(giro[i]);
      const off = 12 / 111320; // 12 m hacia dentro de la curva
      out.push({ lat: p[i][0] + s * tx / L * off, lon: p[i][1] - s * ty / L * off / k, tipo: 'curva', rio: nombreDe(r), puntaje: Math.min(1, .5 + (g - .6) * .35) });
    }
    if (p.length > 34) for (let i = 16; i < p.length - 16; i += 8) {
      const a = cota(...p[i - 16]), b = cota(...p[i]), c = cota(...p[i + 16]);
      if (a == null || b == null || c == null) continue;
      const s1 = (a - b) / (16 * paso), s2 = (b - c) / (16 * paso);
      if (s1 > .015 && s2 >= -.005 && s2 < s1 * .45) out.push({ lat: p[i][0], lon: p[i][1], tipo: 'pendiente', rio: nombreDe(r), puntaje: Math.min(.95, .5 + (s1 - s2) * 8) });
    }
  }
  for (const r of rios) {
    const fin = r.puntos[r.puntos.length - 1];
    for (const o of rios) if (o !== r && o.nombre !== r.nombre && o.puntos.slice(1, -1).some(q => dist(q, fin) < 3))
      out.push({ lat: fin[0], lon: fin[1], tipo: 'confluencia', rio: `${nombreDe(r)} con ${nombreDe(o)}`, puntaje: .7 });
  }
  out.sort((a, b) => b.puntaje - a.puntaje);
  const fin = [];
  for (const c of out) if (!fin.some(q => dist([q.lat, q.lon], [c.lat, c.lon]) < 150)) fin.push(c);
  return fin.slice(0, 40);
}
/** Ley aproximada: mg de oro, nº de bateas y litros por batea -> g/m³ */
export function ley(mg, bateas, litros) {
  const m3 = bateas * litros / 1000;
  return m3 > 0 && mg >= 0 ? mg / 1000 / m3 : null;
}
