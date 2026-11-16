/* Transforma lançamentos (linhas do banco) no formato de desempenho que o painel já usa. */
(function () {
  "use strict";
  const { norm } = window.MD;
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const mais = (d, n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; };
  const br = s => s.split("-").reverse().join("/");
  const p = (c, n) => (n > 0 ? 100 * c / n : null);

  /* perf(rows, hoje, ate): janelas de 2 anos e 90 dias terminando em `hoje`; `ate` (ISO) exclui lançamentos a partir dessa data. */
  function perf(rows, hoje, ate) {
    hoje = hoje || new Date();
    const t = iso(hoje), d2 = iso(mais(hoje, -730)), d90 = iso(mais(hoje, -90));
    const T = new Map(), A = new Map(), tot = { n2: 0, c2: 0, n90: 0, c90: 0 };
    rows.forEach(r => {
      if (r.data <= d2 || r.data > t || (ate && r.data >= ate)) return;
      const k = norm(r.tema);
      let o = T.get(k); if (!o) { o = { area: r.area, nome: r.tema, key: k, n2: 0, c2: 0, n90: 0, c90: 0 }; T.set(k, o); }
      let a = A.get(r.area); if (!a) { a = { area: r.area, nome: r.area, key: norm(r.area), n2: 0, c2: 0, n90: 0, c90: 0 }; A.set(r.area, a); }
      const rec = r.data > d90;
      [o, a, tot].forEach(x => { x.n2 += r.questoes; x.c2 += r.acertos; if (rec) { x.n90 += r.questoes; x.c90 += r.acertos; } });
    });
    const fin = o => ({ area: o.area, nome: o.nome, key: o.key, n2: o.n2, p2: p(o.c2, o.n2), n90: o.n90, p90: p(o.c90, o.n90) });
    const areas = [...A.values()].sort((x, y) => y.n2 - x.n2).map(fin);
    const ordem = new Map(areas.map((a, i) => [a.nome, i]));
    const temas = [...T.values()].sort((x, y) => (ordem.get(x.area) - ordem.get(y.area)) || (y.n2 - x.n2)).map(fin);
    const linha = (ini, n, c) => ({ periodo: br(ini) + " – " + br(t), total: n, corretas: c, erradas: n - c, pct: p(c, n) });
    return { date: "0000-00-00", file: "lançamentos", title: "Lançamentos", meta: {},
             totals: { a2: linha(iso(mais(hoje, -729)), tot.n2, tot.c2), d90: linha(iso(mais(hoje, -89)), tot.n90, tot.c90) }, areas, temas };
  }

  /* Últimos 7 dias, no formato "semana" do planejador. null se não houver lançamentos. */
  function semana(rows, hoje) {
    hoje = hoje || new Date();
    const t = iso(hoje), d7 = iso(mais(hoje, -7));
    const T = new Map();
    rows.forEach(r => {
      if (r.data <= d7 || r.data > t) return;
      const k = norm(r.tema);
      let o = T.get(k); if (!o) { o = { area: r.area, nome: r.tema, key: k, n: 0, c: 0 }; T.set(k, o); }
      o.n += r.questoes; o.c += r.acertos;
    });
    return T.size ? { file: "últimos 7 dias", date: t, meta: {}, temas: [...T.values()] } : null;
  }
  const corte7 = hoje => iso(mais(hoje || new Date(), -6));      // 1º dia da janela de 7 dias

  /* Atividade por semana: n blocos de 7 dias terminando hoje, do mais antigo ao mais recente. */
  function semanas(rows, n, hoje) {
    hoje = hoje || new Date(); n = n || 8;
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const fim = iso(mais(hoje, -7 * i)), ini = iso(mais(hoje, -7 * i - 6));
      let q = 0, c = 0;
      rows.forEach(r => { if (r.data >= ini && r.data <= fim) { q += r.questoes; c += r.acertos; } });
      out.push({ ini, fim, label: br(ini).slice(0, 5) + "–" + br(fim).slice(0, 5), n: q, c, pct: p(c, q) });
    }
    return out;
  }

  /* Taxonomia (área -> temas) a partir das tabelas de incidência, para o formulário de lançamento. */
  function taxonomia(provas) {
    const A = new Map();
    Object.values(provas).forEach(pv => pv.data.temas.forEach(t => {
      if (!A.has(t.area)) A.set(t.area, new Map());
      if (!A.get(t.area).has(t.key)) A.get(t.area).set(t.key, t.nome);
    }));
    return [...A.entries()].map(([area, m]) => ({ area, temas: [...m.values()].sort((a, b) => a.localeCompare(b, "pt-BR")) }))
      .sort((a, b) => a.area.localeCompare(b.area, "pt-BR"));
  }

  window.PERFIL = { perf, semana, semanas, taxonomia, corte7, iso, br };
})();
