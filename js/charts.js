/* Gráficos SVG mínimos, sem bibliotecas. Cores vêm das variáveis CSS. */
(function () {
  "use strict";
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Barras horizontais. items: [{label, value, sub, cls}] */
  function hbars(items, { max, fmt = v => v.toFixed(1), labelW = 190, rowH = 26, width = 640 } = {}) {
    const m = max || Math.max(...items.map(i => i.value), 1);
    const plotW = width - labelW - 60;
    const h = items.length * rowH + 8;
    let s = `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img">`;
    items.forEach((it, k) => {
      const y = 4 + k * rowH, w = Math.max(1, (it.value / m) * plotW);
      s += `<text class="lbl" x="${labelW - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(it.label)}</text>`;
      s += `<rect class="bar ${it.cls || ""}" x="${labelW}" y="${y + 4}" width="${w}" height="${rowH - 10}" rx="3"><title>${esc(it.label)}: ${esc(fmt(it.value))}${it.sub ? " · " + esc(it.sub) : ""}</title></rect>`;
      s += `<text class="val" x="${labelW + w + 6}" y="${y + rowH / 2 + 4}">${esc(fmt(it.value))}</text>`;
    });
    return s + "</svg>";
  }

  /* Barras pareadas por categoria (ex.: 2 anos x 90 dias). series: [{name, cls}], rows: [{label, values:[...] }] */
  function pairedBars(rows, series, { min = 50, max = 90, labelW = 150, width = 1100, rowH = 34 } = {}) {
    const plotW = width - labelW - 50, h = rows.length * rowH + 30;
    const x = v => labelW + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * plotW;
    let s = `<svg class="chart" viewBox="0 0 ${width} ${h}" role="img">`;
    for (let t = min; t <= max; t += 10) {
      s += `<line class="grid" x1="${x(t)}" x2="${x(t)}" y1="0" y2="${h - 22}"/><text class="axis" x="${x(t)}" y="${h - 6}" text-anchor="middle">${t}%</text>`;
    }
    rows.forEach((r, k) => {
      const y = k * rowH + 4;
      s += `<text class="lbl" x="${labelW - 8}" y="${y + rowH / 2}" text-anchor="end">${esc(r.label)}</text>`;
      r.values.forEach((v, j) => {
        if (v == null) return;
        const bh = (rowH - 12) / series.length, yy = y + 2 + j * bh;
        s += `<rect class="bar ${series[j].cls}" x="${labelW}" y="${yy}" width="${Math.max(1, x(v) - labelW)}" height="${bh - 2}" rx="2"><title>${esc(r.label)} · ${esc(series[j].name)}: ${Math.round(v)}%</title></rect>`;
        s += `<text class="val small" x="${x(v) + 4}" y="${yy + bh - 4}">${Math.round(v)}%</text>`;
      });
    });
    return s + "</svg>";
  }

  /* Dispersão: x = incidência, y = acerto, r ~ sqrt(n). points: [{x, y, n, label, cls, showLabel}] */
  function scatter(points, { width = 640, height = 380, xLabel = "", yLabel = "", yMin = 40, yMax = 100, yRef = null } = {}) {
    const L = 46, B = 34, T = 10, Rm = 16;
    const xMax = Math.ceil(Math.max(...points.map(p => p.x), 1));
    const px = v => L + (v / xMax) * (width - L - Rm);
    const py = v => T + (1 - (Math.min(Math.max(v, yMin), yMax) - yMin) / (yMax - yMin)) * (height - T - B);
    const nMax = Math.max(...points.map(p => p.n || 1), 1);
    let s = `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">`;
    for (let t = yMin; t <= yMax; t += 10) s += `<line class="grid" x1="${L}" x2="${width - Rm}" y1="${py(t)}" y2="${py(t)}"/><text class="axis" x="${L - 6}" y="${py(t) + 4}" text-anchor="end">${t}%</text>`;
    for (let t = 0; t <= xMax; t += 1) s += `<text class="axis" x="${px(t)}" y="${height - B + 16}" text-anchor="middle">${t}%</text>`;
    if (yRef != null) s += `<line class="ref" x1="${L}" x2="${width - Rm}" y1="${py(yRef)}" y2="${py(yRef)}"/>`;
    s += `<text class="axis" x="${(L + width) / 2}" y="${height - 2}" text-anchor="middle">${esc(xLabel)}</text>`;
    s += `<text class="axis" transform="translate(12 ${height / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
    points.forEach(p => {
      const r = 3 + 11 * Math.sqrt((p.n || 1) / nMax);
      s += `<circle class="dot ${p.cls || ""}" cx="${px(p.x)}" cy="${py(p.y)}" r="${r}"><title>${esc(p.label)} — incidência ${p.x.toFixed(2)}% · acerto ${p.y}% · n ${p.n}</title></circle>`;
      if (p.showLabel) s += `<text class="pt" x="${px(p.x) + r + 3}" y="${py(p.y) + 4}">${esc(p.label)}</text>`;
    });
    return s + "</svg>";
  }

  window.CHARTS = { hbars, pairedBars, scatter, esc };
})();
