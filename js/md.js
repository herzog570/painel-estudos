/* Parser genérico de Markdown: título, metadados (lista antes do 1º ##) e tabelas por seção. */
(function () {
  "use strict";

  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function parseNum(s) {
    if (s == null) return null;
    const t = String(s).trim();
    if (!/^-?\d+([.,]\d+)?$/.test(t)) return null;
    return parseFloat(t.replace(",", "."));
  }

  function cells(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
  }

  function parseMarkdown(text) {
    const lines = String(text).replace(/\r/g, "").split("\n");
    const doc = { title: "", meta: {}, tables: [] };
    let h2 = "", h3 = "";
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (/^#\s/.test(line)) { doc.title = line.replace(/^#\s+/, ""); continue; }
      if (/^##\s/.test(line)) { h2 = line.replace(/^##\s+/, ""); h3 = ""; continue; }
      if (/^###\s/.test(line)) { h3 = line.replace(/^###\s+/, ""); continue; }
      if (!h2 && /^-\s/.test(line)) {
        const body = line.replace(/^-\s+/, "");
        const k = body.indexOf(":");
        if (k > 0) doc.meta[body.slice(0, k).trim()] = body.slice(k + 1).trim();
        else doc.meta["nota_" + Object.keys(doc.meta).length] = body;
        continue;
      }
      if (line.startsWith("|") && i + 1 < lines.length && /^\|\s*:?-{2,}/.test(lines[i + 1].trim())) {
        const headers = cells(line);
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(cells(lines[i])); i++; }
        i--;
        doc.tables.push({ h2, h3, headers, rows });
      }
    }
    return doc;
  }

  /* Índice da 1ª coluna cujo cabeçalho casa com todos os regex. */
  function col(headers, ...res) {
    return headers.findIndex(h => res.every(r => r.test(h)));
  }

  window.MD = { parseMarkdown, parseNum, norm, col };
})();
