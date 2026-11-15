/* Planejador do próximo ciclo — combina uma ou mais provas (lógica pura, sem UI).
 *
 * Para cada prova p selecionada, com peso w_p (Σ w_p = 1):
 *   inc_p(tema) = λ·%recente + (1−λ)·%histórico      (λ próprio da prova = N_rec/(N_rec+K), salvo ajuste manual)
 * Incidência combinada:  inc(tema) = Σ w_p · inc_p(tema)      — em % da prova, não em nº de questões,
 *                        para que provas maiores não pesem mais só por terem mais questões.
 * Acerto:    (m·acerto 2 anos + acertos da semana) / (m + questões da semana), m = mín(n 2 anos, priorMax); − γ·Δ90d
 * Prioridade = 100 × (inc/100)^α × (1 − acerto + z·EP)^β × fatorVolume
 *              (com α = β = 1: pontos percentuais de nota ponderada perdidos + bônus de incerteza)
 * Listas: por bloco/dia, maiores prioridades até a cobertura (mín–máx subtemas); questões ∝ prioridade.
 */
(function () {
  "use strict";

  const DIA = 86400000;
  function diasAte(iso, hoje) {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    const h = hoje || new Date();
    return Math.round((new Date(y, m - 1, d) - new Date(h.getFullYear(), h.getMonth(), h.getDate())) / DIA);
  }
  /* Peso sugerido pelas datas: ∝ 1/(dias + 7). Sem data: como se faltassem 60 dias. */
  function pesosSugeridos(exams) {
    const raw = exams.map(e => 1 / ((e.dias == null ? 60 : Math.max(0, e.dias)) + 7));
    const S = raw.reduce((s, v) => s + v, 0) || 1;
    return exams.map((e, i) => raw[i] / S);
  }

  function lambdaDe(A) { const K = A.exam.K || 100, NR = A.exam.N.rec || 0; return NR ? NR / (NR + K) : 1; }

  function defaults(As, W, cfg) {
    const P = cfg.planejador;
    const lam = As.length ? As.reduce((s, A, i) => s + W[i] * lambdaDe(A), 0) : 1;
    return {
      lambda: lam, alpha: 1, beta: 1, z: P.zExploracao, priorMax: P.pesoMaxPrior,
      gamma: 0, delta: 0,
      cobertura: P.coberturaAlvo, maxSub: P.maxSubtemas, minQ: P.minQuestoesSubtema
    };
  }

  function weekIndex(week) {
    const idx = new Map();
    if (!week) return idx;
    week.temas.forEach(t => {
      const cur = idx.get(t.key) || { n: 0, c: 0 };
      cur.n += t.n || 0; cur.c += t.c || 0;
      idx.set(t.key, cur);
    });
    return idx;
  }

  function scoreTemas(As, W, week, useWeek, cfg, X, lambdaManual) {
    const P = cfg.planejador, R = cfg.regras;
    const wIdx = useWeek ? weekIndex(week) : new Map();
    const areaMean = {};
    As.forEach(A => A.areas.forEach(a => { if (areaMean[a.nome] == null) areaMean[a.nome] = a.p2 != null ? a.p2 / 100 : 0.65; }));
    // união dos temas, com a incidência de cada prova
    const U = new Map();
    As.forEach((A, i) => {
      const lam = lambdaManual ? X.lambda : lambdaDe(A);
      A.temas.forEach(t => {
        const incP = (t.pr != null && t.ph != null) ? lam * t.pr + (1 - lam) * t.ph : (t.inc || 0);
        let u = U.get(t.key);
        if (!u) { u = { base: t, incs: As.map(() => 0) }; U.set(t.key, u); }
        u.incs[i] = incP;
      });
    });
    const total90 = As.length ? As[0].total90 : 0;
    const itens = [...U.values()].map(u => ({ u, inc: u.incs.reduce((s, v, i) => s + W[i] * v, 0) }));
    const sumInc = itens.reduce((s, o) => s + o.inc, 0) || 1;
    return itens
      .filter(o => o.inc >= P.incMinima)
      .map(({ u, inc }) => {
        const t = u.base;
        const w = wIdx.get(t.key) || { n: 0, c: 0 };
        const p0 = t.p2 != null ? t.p2 / 100 : (t.p90 != null ? t.p90 / 100 : (areaMean[t.area] ?? 0.65));
        const n0 = t.p2 != null ? (t.n2 || 0) : (t.p90 != null ? (t.n90 || 0) : 0);
        const m = Math.min(n0, X.priorMax) || (t.p2 == null && t.p90 == null ? 10 : 0);
        const den = m + w.n;
        const accBase = den > 0 ? (m * p0 + w.c) / den : p0;
        const d90 = (t.tr && t.tr.delta != null && (t.n90 || 0) >= R.nMinTendencia) ? t.tr.delta / 100 : 0;
        const acc = Math.min(0.99, Math.max(0.01, accBase + X.gamma * d90));
        const ep = Math.sqrt(Math.max(acc * (1 - acc), 0.01) / Math.max(den, 1));
        const gap = Math.max(0.001, 1 - acc + X.z * ep);
        const volRatio = (inc >= R.pMinVolume && total90 > 0) ? ((t.n90 || 0) / total90) / (inc / sumInc) : null;
        let fVol = 1;
        if (X.delta > 0 && volRatio != null && volRatio > 0) fVol = Math.min(2, Math.max(0.5, Math.pow(1 / volRatio, X.delta)));
        const prio = 100 * Math.pow(inc / 100, X.alpha) * Math.pow(gap, X.beta) * fVol;
        const partes = u.incs.map((v, i) => (inc > 0 ? W[i] * v / inc : 0));   // fração da incidência combinada vinda de cada prova
        const semAcc = w.n ? w.c / w.n : null;
        const motivos = [];
        if (inc >= 4) motivos.push("alta incidência");
        if (As.length > 1 && u.incs.filter(v => v >= 2).length > 1) motivos.push("pesa em " + u.incs.filter(v => v >= 2).length + " provas");
        if (acc < 0.65) motivos.push("acerto baixo");
        if (den < 30) motivos.push("pouca amostra");
        if (semAcc != null && w.n >= 8 && semAcc < p0 - 0.1) motivos.push("foi mal na semana");
        if (semAcc != null && w.n >= 8 && semAcc > p0 + 0.1) motivos.push("foi bem na semana");
        if (t.tr && /piora/.test(t.tr.status)) motivos.push("piora 90d");
        if (volRatio != null && volRatio < R.subTreino) motivos.push("sub-treino 90d");
        return { area: t.area, nome: t.nome, key: t.key, n2: t.n2, p2: t.p2, n90: t.n90, p90: t.p90,
                 inc, incs: u.incs, partes, p0, n0, m, wN: w.n, wC: w.c, semAcc, acc, ep, fVol, volRatio, prio, motivos };
      });
  }

  function allocate(items, N, minQ) {
    if (!items.length || N <= 0) return [];
    const k = Math.min(items.length, Math.max(1, Math.floor(N / minQ)));
    const sel = items.slice(0, k);
    const S = sel.reduce((s, x) => s + x.prio, 0) || 1;
    const q = sel.map(x => Math.max(minQ, Math.round(N * x.prio / S)));
    let diff = N - q.reduce((s, v) => s + v, 0), guard = 400;
    while (diff !== 0 && guard--) {
      if (diff > 0) { q[0]++; diff--; }
      else {
        const i = q.map((v, j) => [v, j]).filter(([v]) => v > minQ).sort((a, b) => b[0] - a[0])[0];
        if (!i) break; q[i[1]]--; diff++;
      }
    }
    return sel.map((x, i) => ({ ...x, questoes: q[i], share: x.prio / S }));
  }

  /* Divide `total` questões entre os blocos ∝ peso, em múltiplos de 5, entre o mínimo e o máximo por dia, preservando o total. */
  function dividir(total, pesos, lo, hi) {
    const n = pesos.length;
    lo = Math.min(lo, 5 * Math.floor(total / n / 5)); hi = Math.max(hi, 5 * Math.ceil(total / n / 5));
    const S = pesos.reduce((s, v) => s + v, 0) || 1;
    const alvo = pesos.map(p => total * p / S);
    const q = alvo.map(v => Math.min(hi, Math.max(lo, 5 * Math.round(v / 5))));
    let diff = total - q.reduce((s, v) => s + v, 0), guard = 300;
    while (Math.abs(diff) >= 5 && guard--) {
      const ord = q.map((v, i) => [alvo[i] - v, i]).sort((a, b) => b[0] - a[0]);
      if (diff > 0) { const c = ord.find(([, i]) => q[i] < hi); if (!c) break; q[c[1]] += 5; diff -= 5; }
      else { const c = ord.reverse().find(([, i]) => q[i] > lo); if (!c) break; q[c[1]] -= 5; diff += 5; }
    }
    return q;
  }

  /* As: análises das provas selecionadas; W: pesos normalizados (mesma ordem); qPorBloco: array ou null (= divisão sugerida) */
  function plan(As, W, week, perfDate, cfg, qPorBloco, params) {
    const P = cfg.planejador;
    const X = Object.assign(defaults(As, W, cfg), params || {});
    const lambdaManual = !!(params && params.lambda != null);
    const useWeek = !!(week && (!perfDate || week.date > perfDate));
    const scored = As.length ? scoreTemas(As, W, week, useWeek, cfg, X, lambdaManual) : [];
    const ranking = scored.slice().sort((a, b) => b.prio - a.prio);
    ranking.forEach((t, i) => { t.rank = i + 1; });
    const grupos = P.blocos.map(b => {
      const its = scored.filter(t => b.areas.includes(t.area)).sort((x, y) => y.prio - x.prio);
      return { b, its, total: its.reduce((s, t) => s + t.prio, 0) };
    });
    const somaPrio = grupos.reduce((s, g) => s + g.total, 0) || 1;
    const auto = !Array.isArray(qPorBloco);
    const somaN = auto ? P.blocos.length * P.questoesPadrao : qPorBloco.reduce((s, v) => s + v, 0);
    const sug = dividir(somaN, grupos.map(g => g.total), P.minQuestoesDia || 40, P.maxQuestoesDia || 110);
    const blocos = grupos.map((g, i) => {
      let acc = 0, k = 0;
      for (const t of g.its) { if (k >= X.maxSub) break; acc += t.prio; k++; if (k >= P.minSubtemas && acc / (g.total || 1) >= X.cobertura) break; }
      k = Math.max(Math.min(P.minSubtemas, g.its.length), k);
      const N = auto ? sug[i] : qPorBloco[i];
      const escolhidos = allocate(g.its.slice(0, k), N, X.minQ);
      return { nome: g.b.nome, areas: g.b.areas, N, total: g.total, pesoSugerido: g.total / somaPrio, qSugerida: sug[i],
               cobertura: g.total ? escolhidos.reduce((s, t) => s + t.prio, 0) / g.total : 0,
               escolhidos, proximos: g.its.slice(escolhidos.length, escolhidos.length + 4) };
    });
    const todas = new Set(); As.forEach(A => A.temas.forEach(t => todas.add(t.key)));
    return {
      X, W, blocos, ranking, somaN, auto,
      semana: week ? { file: week.file, date: week.date, usada: useWeek, nTotal: week.temas.reduce((s, t) => s + (t.n || 0), 0),
        naoCasados: As.length ? week.temas.filter(w => !todas.has(w.key)).map(w => w.nome) : [] } : null
    };
  }

  function asText(pl, titulo) {
    const L = [`Plano do próximo ciclo — ${titulo}`];
    pl.blocos.forEach((b, i) => {
      L.push(`Dia ${i + 1} — ${b.nome} (${b.N} questões): ` + b.escolhidos.map(t => `${t.nome} ${t.questoes}`).join(" · "));
    });
    return L.join("\n");
  }

  window.PLANNER = { plan, asText, defaults, diasAte, pesosSugeridos };
})();
