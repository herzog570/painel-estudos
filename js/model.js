/* Adaptadores (md -> dados) e regras de análise. Sem dependência de UI. */
(function () {
  "use strict";
  const { parseMarkdown, parseNum, norm, col } = window.MD;

  const RX_PERF = /^desempenho_(.+?)_(\d{4}-\d{2}-\d{2})\.md$/i;
  const RX_INC = /^incidencia_([a-z0-9-]+)_(.+?)_(\d{4}-\d{2}-\d{2})\.md$/i;

  /* ---------- Desempenho ---------- */
  function parsePerformance(name, text) {
    const doc = parseMarkdown(text);
    const out = { file: name, title: doc.title, meta: doc.meta, totals: {}, areas: [], temas: [] };
    for (const t of doc.tables) {
      const H = t.headers;
      if (/totais/i.test(t.h2)) {
        const iP = col(H, /per[ií]odo/i), iT = col(H, /^total/i), iC = col(H, /corretas/i),
              iE = col(H, /erradas/i), iPct = col(H, /%/);
        t.rows.forEach((r, k) => {
          const row = { periodo: r[iP], total: parseNum(r[iT]), corretas: parseNum(r[iC]),
                        erradas: parseNum(r[iE]), pct: parseNum(r[iPct]) };
          if (/90/.test(r[iP])) out.totals.d90 = row; else if (!out.totals.a2) out.totals.a2 = row;
        });
        continue;
      }
      const iN2 = col(H, /quest/i, /2 anos/i), iP2 = col(H, /%/, /2 anos/i),
            iN9 = col(H, /quest/i, /90/), iP9 = col(H, /%/, /90/);
      if (iN2 < 0) continue;
      const mk = (r, area) => ({
        area, nome: r[0], key: norm(r[0]),
        n2: parseNum(r[iN2]), p2: parseNum(r[iP2]), n90: parseNum(r[iN9]), p90: parseNum(r[iP9])
      });
      if (/grande [aá]rea/i.test(t.h2)) t.rows.forEach(r => out.areas.push(mk(r, r[0])));
      else if (/tema/i.test(t.h2)) t.rows.forEach(r => out.temas.push(mk(r, t.h3)));
    }
    return out;
  }

  /* ---------- Incidência por prova ---------- */
  function parseIncidence(name, text) {
    const doc = parseMarkdown(text);
    const out = { file: name, title: doc.title, meta: doc.meta, anos: [], areas: [], temas: [], N: {} };
    const metaTxt = Object.values(doc.meta).join(" ");
    const mH = metaTxt.match(/Hist[oó]rico[^N]*N\s*=\s*(\d+)/i), mR = metaTxt.match(/Recente[^N]*N\s*=\s*(\d+)/i);
    if (mH) out.N.hist = +mH[1];
    if (mR) out.N.rec = +mR[1];
    const mK = metaTxt.match(/K\s*=\s*(\d+)/); if (mK) out.K = +mK[1];
    for (const t of doc.tables) {
      const H = t.headers;
      if (/ano/i.test(t.h2)) { t.rows.forEach(r => out.anos.push({ ano: r[0], n: parseNum(r[1]) })); continue; }
      const iNH = col(H, /^n/i, /hist/i), iPH = col(H, /%/, /hist/i),
            iNR = col(H, /^n/i, /recente/i), iPR = col(H, /%/, /recente/i), iPE = col(H, /estimad/i);
      const mk = (r, area) => ({
        area, nome: r[0], key: norm(r[0]),
        nh: parseNum(r[iNH]), ph: parseNum(r[iPH]), nr: parseNum(r[iNR]), pr: parseNum(r[iPR]),
        pe: iPE >= 0 ? parseNum(r[iPE]) : null
      });
      if (/grande [aá]rea/i.test(t.h2)) t.rows.forEach(r => out.areas.push(mk(r, r[0])));
      else if (/tema/i.test(t.h2)) t.rows.forEach(r => out.temas.push(mk(r, t.h3)));
    }
    return out;
  }

  /* ---------- Semana (5 dias de listas) ---------- */
  const RX_WEEK = /^semana_(\d{4}-\d{2}-\d{2})\.md$/i;
  function parseWeek(name, date, text) {
    const doc = parseMarkdown(text);
    const out = { file: name, date, meta: doc.meta, temas: [] };
    for (const t of doc.tables) {
      const H = t.headers;
      const iT = col(H, /tema/i), iN = col(H, /quest/i), iC = col(H, /^acert/i) >= 0 ? col(H, /^acert/i) : col(H, /acert/i), iA = col(H, /[aá]rea/i);
      if (iT < 0 || iN < 0 || iC < 0) continue;
      t.rows.forEach(r => {
        const n = parseNum(r[iN]), c = parseNum(r[iC]);
        if (!r[iT] || n == null || c == null) return;
        out.temas.push({ area: iA >= 0 ? r[iA] : t.h3, nome: r[iT], key: norm(r[iT]), n, c });
      });
    }
    return out;
  }

  /* ---------- Carga das fontes: {nomeArquivo: conteúdo} ---------- */
  function loadSources(files) {
    const perfs = [], incs = {};
    let semana = null;
    for (const [name, text] of Object.entries(files)) {
      let m;
      if ((m = name.match(RX_WEEK))) { if (!semana || semana.date < m[1]) semana = parseWeek(name, m[1], text); continue; }
      if ((m = name.match(RX_PERF))) perfs.push({ date: m[2], data: parsePerformance(name, text) });
      else if ((m = name.match(RX_INC))) {
        const slug = m[1].toLowerCase();
        if (!incs[slug] || incs[slug].date < m[3]) incs[slug] = { date: m[3], data: parseIncidence(name, text) };
      }
    }
    perfs.sort((a, b) => (a.date < b.date ? 1 : -1));
    return {
      desempenho: perfs[0] ? { date: perfs[0].date, ...perfs[0].data } : null,
      provas: incs,
      semana,
      arquivos: Object.keys(files).sort()
    };
  }

  /* ---------- Regras estatísticas ---------- */
  // Acerto "antes dos 90 dias" derivado: (n2·p2 − n90·p90) / (n2 − n90)
  function trend(n2, p2, n90, p90, R) {
    const res = { nPre: null, pPre: null, delta: null, ep: null, status: "sem-dado", label: "—" };
    if (n90 == null || p90 == null) return res;
    if (n2 == null || p2 == null || n2 <= n90) { res.status = "so-recente"; res.label = "só 90 dias"; return res; }
    res.nPre = n2 - n90;
    res.pPre = (n2 * p2 - n90 * p90) / res.nPre;
    res.delta = p90 - res.pPre;
    const a = res.pPre / 100, b = p90 / 100;
    res.ep = 100 * Math.sqrt(Math.max(a * (1 - a), 0.0025) / res.nPre + Math.max(b * (1 - b), 0.0025) / n90);
    if (n90 < R.nMinTendencia) { res.status = "n-baixo"; res.label = "n baixo"; return res; }
    const z = Math.abs(res.delta) / res.ep;
    if (z > R.zSinal) { res.status = res.delta > 0 ? "melhora" : "piora"; res.label = res.delta > 0 ? "melhora" : "piora"; }
    else if (z > R.zFraco) { res.status = res.delta > 0 ? "fraco-melhora" : "fraco-piora"; res.label = "sinal fraco"; }
    else { res.status = "estavel"; res.label = "estável"; }
    return res;
  }

  function analyzeExam(slug, exam, perf, cfg) {
    const R = cfg.regras;
    const pc = Object.assign({ nome: slug.toUpperCase(), titulo: slug.toUpperCase() }, cfg.provaPadrao, cfg.provas[slug] || {});
    const Q = pc.questoes;
    const pIdx = new Map((perf ? perf.temas : []).map(t => [t.key, t]));
    const aIdx = new Map((perf ? perf.areas : []).map(a => [norm(a.nome), a]));
    const total90 = perf && perf.totals.d90 ? perf.totals.d90.total
      : (perf ? perf.temas.reduce((s, t) => s + (t.n90 || 0), 0) : 0);

    const temas = exam.temas.map(t => {
      const p = pIdx.get(t.key) || {};
      const inc = t.pe != null ? t.pe : t.pr;
      const acc = p.p2 != null ? p.p2 : p.p90;
      const nAcc = p.p2 != null ? p.n2 : p.n90;
      const tr = trend(p.n2, p.p2, p.n90, p.p90, R);
      const perda = inc != null && acc != null ? (inc / 100) * (1 - acc / 100) * Q : null;
      const flags = [];
      if (acc == null) flags.push("sem desempenho");
      else if ((nAcc || 0) < R.nMinDesempenho) flags.push("acerto n<" + R.nMinDesempenho);
      if (t.nr != null && t.nr < R.nMinIncidenciaRecente && t.nr > 0) flags.push("incidência instável");
      if (t.nr === 0 && (t.nh || 0) > 0) flags.push("sumiu 2021+");
      return {
        area: t.area, nome: t.nome, key: t.key, nh: t.nh, nr: t.nr, ph: t.ph, pr: t.pr, inc,
        n2: p.n2, p2: p.p2, n90: p.n90, p90: p.p90, acc, nAcc, tr, perda, flags, volRatio: null
      };
    });

    const sumInc = temas.reduce((s, t) => s + (t.inc || 0), 0);
    temas.forEach(t => {
      if (t.inc != null && t.inc >= R.pMinVolume && total90 > 0 && sumInc > 0) {
        t.volRatio = ((t.n90 || 0) / total90) / (t.inc / sumInc);
        if (t.volRatio < R.subTreino) t.flags.push("sub-treino 90d");
        else if (t.volRatio > R.sobreTreino) t.flags.push("sobre-treino 90d");
      }
    });

    const comAcc = temas.filter(t => t.inc != null && t.acc != null);
    const incCoberta = comAcc.reduce((s, t) => s + t.inc, 0);
    const accPond = incCoberta ? comAcc.reduce((s, t) => s + t.inc * t.acc, 0) / incCoberta : null;
    const comAcc90 = temas.filter(t => t.inc != null && t.p90 != null && (t.n90 || 0) >= R.nMinTendencia);
    const inc90 = comAcc90.reduce((s, t) => s + t.inc, 0);
    const accPond90 = inc90 ? comAcc90.reduce((s, t) => s + t.inc * t.p90, 0) / inc90 : null;

    const areas = exam.areas.map(a => {
      const pa = aIdx.get(norm(a.nome)) || {};
      return { nome: a.nome, nh: a.nh, ph: a.ph, nr: a.nr, pr: a.pr, n2: pa.n2, p2: pa.p2, n90: pa.n90, p90: pa.p90,
               tr: trend(pa.n2, pa.p2, pa.n90, pa.p90, R) };
    });

    return {
      slug, cfg: pc, Q, exam, temas, areas, sumInc, total90,
      resumo: {
        accPond, accPond90, pontosEsperados: accPond != null ? Q * accPond / 100 : null,
        perdaTotal: temas.reduce((s, t) => s + (t.perda || 0), 0),
        cobertura: sumInc ? incCoberta / sumInc : null,
        nTemas: temas.length, nTemasComInc: temas.filter(t => (t.nr || 0) > 0).length
      }
    };
  }

  function analyzeOverview(perf, cfg) {
    const R = cfg.regras;
    const areas = perf.areas.map(a => ({ ...a, tr: trend(a.n2, a.p2, a.n90, a.p90, R) }));
    const temas = perf.temas.map(t => ({ ...t, tr: trend(t.n2, t.p2, t.n90, t.p90, R) }));
    const t2 = perf.totals.a2, t9 = perf.totals.d90;
    let geral = null;
    if (t2 && t9) {
      const nPre = t2.total - t9.total, cPre = t2.corretas - t9.corretas;
      geral = { nPre, cPre, pPre: 100 * cPre / nPre, ...trend(t2.total, 100 * t2.corretas / t2.total, t9.total, 100 * t9.corretas / t9.total, R) };
    }
    return { areas, temas, geral };
  }

  window.MODEL = { loadSources, analyzeExam, analyzeOverview, trend };
})();
