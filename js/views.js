/* Renderização das guias. Recebe dados já analisados (model.js). */
(function () {
  "use strict";
  const { hbars, pairedBars, scatter, esc } = window.CHARTS;

  const fmtInt = v => v == null ? "—" : Math.round(v).toLocaleString("pt-BR");
  const fmt1 = v => v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = v => v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = v => v == null ? "—" : `${Math.round(v)}%`;
  const sgn = v => v == null ? "—" : (v > 0 ? "+" : "") + fmt1(v);

  function chip(tr) {
    if (!tr || tr.status === "sem-dado") return `<span class="chip muted">—</span>`;
    const cls = { melhora: "up", piora: "down", "fraco-melhora": "weak-up", "fraco-piora": "weak-down", estavel: "flat", "n-baixo": "muted", "so-recente": "muted" }[tr.status] || "muted";
    const arrow = tr.delta == null ? "" : tr.delta > 0 ? "▲ " : tr.delta < 0 ? "▼ " : "";
    const tip = tr.delta == null ? tr.label : `Δ ${sgn(tr.delta)} p.p. · EP ${fmt1(tr.ep)} · antes ${fmt1(tr.pPre)}% (n ${tr.nPre})`;
    return `<span class="chip ${cls}" title="${esc(tip)}">${arrow}${esc(tr.label)}${tr.delta != null && tr.status !== "n-baixo" ? " " + sgn(tr.delta) : ""}</span>`;
  }

  /* Tabela ordenável: cols [{key, label, num, render, title}] */
  function sortableTable(id, rows, cols, state) {
    const st = state[id] || (state[id] = { key: null, dir: -1 });
    const data = rows.slice();
    if (st.key) {
      const c = cols.find(c => c.key === st.key);
      const get = c.sortVal || (r => r[c.key]);
      data.sort((a, b) => {
        const va = get(a), vb = get(b);
        if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
        return (typeof va === "string" ? va.localeCompare(vb, "pt-BR") : va - vb) * st.dir;
      });
    }
    let h = `<div class="tbl-wrap"><table class="tbl" data-table="${id}"><thead><tr>`;
    cols.forEach(c => {
      const on = st.key === c.key ? (st.dir > 0 ? " ▲" : " ▼") : "";
      h += `<th class="${c.num ? "num" : ""}" data-sort="${c.key}" title="${esc(c.title || "Ordenar")}">${esc(c.label)}${on}</th>`;
    });
    h += `</tr></thead><tbody>`;
    data.forEach((r, i) => {
      h += "<tr>" + cols.map(c => `<td class="${c.num ? "num" : ""}">${c.render ? c.render(r, i) : esc(r[c.key] ?? "—")}</td>`).join("") + "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  /* ================= Visão geral ================= */
  function overview(perf, ov, state) {
    const t2 = perf.totals.a2 || {}, t9 = perf.totals.d90 || {};
    let h = `<section class="hero">
      <div class="kpi big"><div class="k-lbl">Acerto geral · 2 anos</div><div class="k-val">${pct(t2.pct)}</div>
        <div class="k-sub">${fmtInt(t2.corretas)} corretas de ${fmtInt(t2.total)} · ${fmtInt(t2.erradas)} erradas</div></div>
      <div class="kpi"><div class="k-lbl">Questões resolvidas · 2 anos</div><div class="k-val">${fmtInt(t2.total)}</div><div class="k-sub">${esc(t2.periodo || "")}</div></div>
      <div class="kpi"><div class="k-lbl">Últimos 90 dias</div><div class="k-val">${pct(t9.pct)}</div>
        <div class="k-sub">${fmtInt(t9.corretas)} / ${fmtInt(t9.total)} questões</div></div>
      <div class="kpi"><div class="k-lbl">Antes dos 90 dias (derivado)</div><div class="k-val">${ov.geral ? fmt1(ov.geral.pPre) + "%" : "—"}</div>
        <div class="k-sub">${ov.geral ? fmtInt(ov.geral.cPre) + " / " + fmtInt(ov.geral.nPre) + " · " : ""}${ov.geral ? chip(ov.geral) : ""}</div></div>
    </section>`;

    h += `<h2>Acerto por grande área</h2><section class="area-grid">`;
    ov.areas.forEach(a => {
      h += `<div class="area-card"><div class="a-name">${esc(a.nome)}</div>
        <div class="a-val">${pct(a.p2)}</div>
        <div class="a-sub">${fmtInt(a.n2)} questões · 2 anos</div>
        <div class="a-90">90 dias: <b>${pct(a.p90)}</b> (${fmtInt(a.n90)}) ${chip(a.tr)}</div></div>`;
    });
    h += `</section>`;

    h += `<div class="card"><div class="card-h"><h3>2 anos × últimos 90 dias</h3>
      <div class="legend"><span class="sw s1"></span>2 anos <span class="sw s2"></span>90 dias</div></div>
      ${pairedBars(ov.areas.map(a => ({ label: a.nome, values: [a.p2, a.p90] })), [{ name: "2 anos", cls: "s1" }, { name: "90 dias", cls: "s2" }])}</div>`;

    h += `<h2>Por tema</h2>
      <div class="toolbar"><label>Área <select data-filter="ov-area"><option value="">Todas</option>${ov.areas.map(a => `<option ${state.ovArea === a.nome ? "selected" : ""}>${esc(a.nome)}</option>`).join("")}</select></label>
      <span class="hint">Clique no cabeçalho para ordenar. Tendência = 90 dias vs. período anterior (derivado), com erro-padrão.</span></div>`;
    const rows = ov.temas.filter(t => !state.ovArea || t.area === state.ovArea);
    h += sortableTable("ov-temas", rows, [
      { key: "area", label: "Área" },
      { key: "nome", label: "Tema" },
      { key: "n2", label: "Questões 2a", num: true, render: r => fmtInt(r.n2) },
      { key: "p2", label: "% 2a", num: true, render: r => `<span class="${(r.n2 || 0) < 20 ? "lowconf" : ""}">${pct(r.p2)}</span>` },
      { key: "n90", label: "Questões 90d", num: true, render: r => fmtInt(r.n90) },
      { key: "p90", label: "% 90d", num: true, render: r => pct(r.p90) },
      { key: "pre", label: "% antes", num: true, sortVal: r => r.tr.pPre, render: r => r.tr.pPre == null ? "—" : fmt1(r.tr.pPre) },
      { key: "delta", label: "Tendência", sortVal: r => r.tr.delta, render: r => chip(r.tr) }
    ], state);
    return h;
  }

  /* ================= Planejador (página própria, multi-prova) ================= */
  const SLIDERS = [
    { k: "lambda", lbl: "Peso do ciclo recente na incidência", min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + "%", help: "0% = só histórico · 100% = só anos recentes. Sem ajuste, cada prova usa o seu próprio valor (N recente ÷ (N recente + K))." },
    { k: "alpha", lbl: "Peso da incidência na prova", min: 0, max: 2, step: 0.05, fmt: v => fmt2(v), help: "Expoente da incidência. 0 = ignora quanto o tema cai; 2 = concentra nos temas mais cobrados." },
    { k: "beta", lbl: "Peso do seu erro", min: 0, max: 2, step: 0.05, fmt: v => fmt2(v), help: "Expoente de (1 − acerto). 0 = ignora seu desempenho; 2 = concentra onde você mais erra." },
    { k: "z", lbl: "Bônus de incerteza (temas com pouca amostra)", min: 0, max: 3, step: 0.1, fmt: v => fmt1(v) + " EP", help: "Soma z erros-padrão ao erro estimado: favorece temas pouco testados." },
    { k: "priorMax", lbl: "Peso do histórico 2 anos × semana", min: 0, max: 300, step: 5, fmt: v => v + " q", help: "O histórico vale no máximo como N questões. Menor = a última semana manda mais." },
    { k: "gamma", lbl: "Peso da tendência dos 90 dias", min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + "%", help: "Acerto usado = acerto − γ·Δ(90d − antes). Só temas com n ≥ 20 nos 90 dias." },
    { k: "delta", lbl: "Correção de sub/sobre-treino recente", min: 0, max: 1, step: 0.05, fmt: v => fmt2(v), help: "Multiplica por (1 ÷ volume90d/incidência)^δ, limitado a ×0,5–×2." },
    { k: "cobertura", lbl: "Cobertura da prioridade por dia", min: 0.5, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + "%", help: "Inclui subtemas até cobrir esta fração da prioridade do bloco." },
    { k: "maxSub", lbl: "Máximo de subtemas por lista", min: 2, max: 8, step: 1, fmt: v => String(v), help: "" },
    { k: "minQ", lbl: "Mínimo de questões por subtema", min: 4, max: 20, step: 1, fmt: v => String(v), help: "" }
  ];
  const pctI = v => Math.round(100 * v) + "%";
  const markPos = pos => `left:calc(${pos}% + ${(8 - pos * 0.16).toFixed(1)}px)`;

  function plannerTop(ctx) {
    const sel = ctx.exams.filter(e => e.selected);
    let h = `<div class="card ctrl" id="plan-top"><div class="card-h"><h3>Provas no plano</h3>
      <div class="plan-actions"><span class="hint" id="w-state">${ctx.wManual ? "pesos ajustados à mão" : "pesos sugeridos pelas datas"}</span>
      <button class="btn" data-plan="pesos">Usar peso sugerido pelas datas</button></div></div>
      <div class="exam-chips">`;
    ctx.exams.forEach(e => {
      const quando = e.dias == null ? "sem data em config.js" : e.dias < 0 ? `prova em ${e.dataFmt} (já realizada)` : e.dias === 0 ? `prova hoje (${e.dataFmt})` : `${e.dataFmt} · faltam ${e.dias} dias`;
      h += `<label class="exam-chip ${e.selected ? "on" : ""} ${e.dias != null && e.dias < 0 ? "past" : ""}">
        <input type="checkbox" data-sel="${e.slug}" ${e.selected ? "checked" : ""}>
        <span class="ec-main"><span class="ec-name">${e.selected ? `<span class="sw px${e.idx}"></span>` : ""}${esc(e.nome)}</span>
          <span class="tiny">${esc(quando)}</span>
          <span class="tiny">projeção ${e.pontos == null ? "—" : fmt1(e.pontos)} de ${e.Q} (${e.accPond == null ? "—" : fmt1(e.accPond) + "%"})</span></span>
        <span class="ec-w" id="wl-${e.slug}">${e.selected ? pctI(e.w) : "fora"}</span></label>`;
    });
    h += `</div>`;
    if (sel.length === 2) {
      const [a, b] = sel, v = Math.round(100 * b.w), rec = 100 * b.wSug;
      h += `<div class="balance"><div class="bal-lbls"><span><span class="sw px0"></span><b>${esc(a.nome)}</b></span><span class="hint">arraste para dividir o peso entre as duas provas</span><span><b>${esc(b.nome)}</b><span class="sw px1"></span></span></div>
        <div class="sl-track"><input type="range" min="0" max="100" step="1" value="${v}" data-w="balance" data-a="${a.slug}" data-b="${b.slug}" aria-label="Peso entre ${esc(a.nome)} e ${esc(b.nome)}">
        <span class="sl-rec" style="${markPos(rec)}" title="sugerido pelas datas: ${pctI(a.wSug)} / ${pctI(b.wSug)}">▲</span></div>
        <div class="tiny">▲ sugerido pelas datas: ${esc(a.nome)} ${pctI(a.wSug)} · ${esc(b.nome)} ${pctI(b.wSug)} (peso ∝ 1 ÷ (dias até a prova + 7))</div></div>`;
    } else if (sel.length > 2) {
      h += `<div class="sliders">` + sel.map(e => `<div class="sl"><div class="sl-top"><span class="sl-lbl"><span class="sw px${e.idx}"></span>${esc(e.nome)}</span></div>
        <div class="sl-track"><input type="range" min="0" max="100" step="1" value="${Math.round(100 * e.w)}" data-w="${e.slug}" aria-label="Peso de ${esc(e.nome)}"></div>
        <div class="tiny">sugerido ${pctI(e.wSug)} · os pesos são normalizados para somar 100%</div></div>`).join("") + `</div>`;
    } else if (sel.length === 0) {
      h += `<p class="warn">Selecione ao menos uma prova para gerar o plano.</p>`;
    }
    return h + `</div>`;
  }

  function plannerAdvanced(X, R, nChanged) {
    let h = `<details class="notes adv" id="plan-adv"><summary>Ajustes avançados da prioridade <span class="hint" id="ctrl-state">${nChanged ? nChanged + " ajuste(s) fora do recomendado" : "configuração recomendada"}</span></summary>
      <div class="adv-h"><p class="hint">A marca ▲ na trilha é o valor recomendado. Tudo recalcula na hora.</p><button class="btn" data-plan="reset">Restaurar recomendado</button></div>
      <div class="sliders">`;
    SLIDERS.forEach(s => {
      const pos = 100 * (R[s.k] - s.min) / (s.max - s.min);
      const changed = Math.abs(X[s.k] - R[s.k]) > s.step / 2;
      h += `<div class="sl ${changed ? "changed" : ""}" data-sl="${s.k}">
        <div class="sl-top"><span class="sl-lbl">${esc(s.lbl)}</span><span class="sl-val" id="v-${s.k}">${s.fmt(X[s.k])}</span></div>
        <div class="sl-track"><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${X[s.k]}" data-param="${s.k}" aria-label="${esc(s.lbl)}">
          <span class="sl-rec" style="${markPos(pos)}" title="recomendado: ${s.fmt(R[s.k])}">▲</span></div>
        <div class="sl-help tiny">${esc(s.help)}${s.help ? " · " : ""}recomendado ${s.fmt(R[s.k])}</div></div>`;
    });
    return h + `</div></details>`;
  }

  function plannerBody(ctx) {
    const pl = ctx.pl, sel = ctx.exams.filter(e => e.selected), sem = pl.semana;
    if (!sel.length) return "";
    const recRank = new Map(ctx.recPl.ranking.map(t => [t.key, t.rank]));
    const multi = sel.length > 1;
    let h = `<div class="card plan-head">
        <div class="plan-src">${sem
          ? (sem.usada
              ? `Últimos 7 dias: ${fmtInt(sem.nTotal)} questões lançadas, combinadas com o histórico anterior.`
              : `<span class="warn">Semana não usada.</span>`)
          : `Sem lançamentos nos últimos 7 dias: plano baseado no histórico de 2 anos + incidência.`}
          ${sem && sem.naoCasados.length ? `<div class="warn tiny">Temas da semana sem correspondência na taxonomia: ${sem.naoCasados.map(esc).join(", ")}</div>` : ""}
        </div>
        <div class="plan-actions"><span class="hint">${pl.somaN} questões no ciclo${pl.auto ? " · divisão sugerida" : ""}</span><button class="btn" data-plan="copiar">Copiar plano</button>
          <button class="btn ghost" data-plan="sugerido" title="Redistribui o total do ciclo entre os dias pela prioridade de cada bloco">Usar divisão sugerida</button></div>
      </div><div class="plan-grid">`;

    pl.blocos.forEach((b, i) => {
      h += `<div class="plan-card">
        <div class="pc-h"><div><span class="pc-dia">Dia ${i + 1}</span> <b>${esc(b.nome)}</b></div>
          <label class="pc-n"><input type="number" min="10" max="200" step="5" value="${b.N}" data-plan="n" data-i="${i}"> questões</label></div>
        <div class="tiny">${Math.round(100 * b.pesoSugerido)}% da prioridade do ciclo → sugerido ${b.qSugerida} q · escolhidos cobrem ${Math.round(100 * b.cobertura)}%</div>
        <table class="plan-tbl"><tbody>`;
      b.escolhidos.forEach(t => {
        h += `<tr><td class="pq">${t.questoes}</td><td><b>${esc(t.nome)}</b>
          <div class="tiny">inc ${fmt2(t.inc)}%${multi ? " (" + sel.map((e, j) => esc(e.nome) + " " + fmt1(t.incs[j])).join(" · ") + ")" : ""} · acerto ${Math.round(100 * t.acc)}%${t.wN ? ` (semana ${t.wC}/${t.wN})` : ""}</div>
          <div>${t.motivos.map(m => `<span class="flag ${/baixo|mal|piora|sub/.test(m) ? "warn" : ""}">${esc(m)}</span>`).join(" ")}</div></td>
          <td class="pbar"><span style="width:${Math.round(100 * t.share)}%"></span></td></tr>`;
      });
      h += `</tbody></table>`;
      if (b.proximos.length) h += `<div class="tiny next">Próximos da fila: ${b.proximos.map(t => `${esc(t.nome)} (${fmt2(t.prio)})`).join(" · ")}</div>`;
      h += `</div>`;
    });
    h += `</div>`;

    // Ranking com a origem da prioridade por prova
    const top = pl.ranking.slice(0, 20), maxP = top.length ? top[0].prio : 1;
    h += `<div class="card"><div class="card-h"><h3>Prioridade por subtema · top 20</h3>
      <div class="legend">${multi ? sel.map(e => `<span class="sw px${e.idx}"></span>${esc(e.nome)}`).join(" ") + " · " : ""}↑↓ = posições vs. ajustes recomendados</div></div>
      ${multi ? `<p class="hint">A barra mostra de qual prova vem a incidência de cada subtema, já com os pesos aplicados.</p>` : ""}<div class="live">`;
    top.forEach(t => {
      const r0 = recRank.get(t.key), d = r0 ? r0 - t.rank : null;
      const mv = d == null ? `<span class="mv new">novo</span>` : d > 0 ? `<span class="mv up">↑${d}</span>` : d < 0 ? `<span class="mv down">↓${-d}</span>` : `<span class="mv">=</span>`;
      const segs = sel.map((e, j) => `<i class="px${e.idx}" style="width:${(100 * t.partes[j]).toFixed(1)}%" title="${esc(e.nome)}: ${pctI(t.partes[j])} da incidência combinada (incidência na prova ${fmt2(t.incs[j])}%)"></i>`).join("");
      h += `<div class="lv-row"><span class="lv-rk">${t.rank}</span><span class="lv-nm" title="${esc(t.area)}">${esc(t.nome)}</span>
        <span class="lv-bar"><span class="seg" style="width:${(100 * t.prio / maxP).toFixed(1)}%">${segs}</span></span>
        <span class="lv-v">${fmt2(t.prio)}</span>${mv}
        <span class="tiny lv-d">${multi ? sel.map((e, j) => esc(e.nome) + " " + pctI(t.partes[j])).join(" · ") + " · " : "inc " + fmt2(t.inc) + "% · "}acerto ${Math.round(100 * t.acc)}%</span></div>`;
    });
    h += `</div></div>`;
    return h;
  }

  function plannerPage(ctx) {
    const X = ctx.pl.X, R = ctx.recPl.X;
    const nChanged = SLIDERS.filter(s => Math.abs(X[s.k] - R[s.k]) > s.step / 2).length;
    return `<section class="exam-head"><h2 class="nomargin">Planejador do próximo ciclo</h2>
        <div class="muted">5 dias, uma grande área por dia. Escolha as provas, ajuste o peso entre elas e copie as listas.</div></section>
      ${plannerTop(ctx)}
      <div id="plan-root">${plannerBody(ctx)}</div>
      ${plannerAdvanced(X, R, nChanged)}
      <details class="notes"><summary>Como a prioridade é calculada</summary><ul>
        <li><b>Incidência combinada</b> = Σ peso da prova × incidência do subtema naquela prova. Usa a % da prova, não o número de questões, para que uma prova com mais questões não pese mais só por isso.</li>
        <li><b>Incidência em cada prova</b> = λ·%recente + (1−λ)·%histórico, com λ = N recente ÷ (N recente + K) (a coluna "% estimada" do .md).</li>
        <li><b>Acerto</b> = (m·acerto 2 anos + acertos da semana) ÷ (m + questões da semana), com m = mín(n 2 anos, peso do histórico).</li>
        <li><b>Prioridade</b> = 100 × (incidência)^α × (1 − acerto + z·EP)^β × fator de volume. Com os ajustes recomendados: pontos percentuais de nota perdidos no subtema, mais um bônus para temas com pouca amostra.</li>
        <li><b>Peso sugerido pelas datas</b> ∝ 1 ÷ (dias até a prova + 7). Prova com data passada sai do plano. Datas em <code>config.js → provas → data</code>.</li>
        <li><b>Listas</b>: maiores prioridades de cada dia até a cobertura escolhida (mín. ${ctx.P.minSubtemas}); questões proporcionais à prioridade. O total do ciclo é dividido entre os dias pela prioridade de cada bloco.</li>
        <li>Seleção, pesos e ajustes ficam salvos neste navegador.</li>
      </ul></details>`;
  }

  /* ================= Guia de prova ================= */
  function exam(A, state) {
    const r = A.resumo, ex = A.exam;
    let h = `<section class="exam-head"><div><h2 class="nomargin">${esc(A.cfg.titulo)}</h2>
      <div class="muted">${esc(ex.title)} · ${esc(ex.file)}</div></div></section>`;
    if (A.cfg.observacoes && A.cfg.observacoes.length)
      h += `<details class="notes"><summary>Observações sobre a prova e os dados (${A.cfg.observacoes.length})</summary><ul>${A.cfg.observacoes.map(o => `<li>${esc(o)}</li>`).join("")}</ul></details>`;

    h += `<section class="hero">
      <div class="kpi big"><div class="k-lbl">Acerto ponderado pela incidência</div><div class="k-val">${r.accPond == null ? "—" : fmt1(r.accPond) + "%"}</div>
        <div class="k-sub">Σ incidência × seu acerto (2 anos) · cobre ${r.cobertura == null ? "—" : Math.round(100 * r.cobertura) + "%"} da incidência</div></div>
      <div class="kpi"><div class="k-lbl">Ponderado · últimos 90 dias</div><div class="k-val">${r.accPond90 == null ? "—" : fmt1(r.accPond90) + "%"}</div>
        <div class="k-sub">só temas com n ≥ 20 nos 90 dias</div></div>
      <div class="kpi"><div class="k-lbl">Questões na prova</div><div class="k-val">${A.Q}</div>
        <div class="k-sub">≈ ${r.pontosEsperados == null ? "—" : fmt1(r.pontosEsperados)} acertos esperados (projeção)</div></div>
      <div class="kpi"><div class="k-lbl">Banco da prova</div><div class="k-val">${fmtInt(ex.N.rec)}</div>
        <div class="k-sub">questões recentes · ${fmtInt(ex.N.hist)} no histórico · ${r.nTemasComInc} temas com incidência recente</div></div>
    </section>`;

    h += `<div class="card plan-head"><div>As listas de questões saem do planejador, que pode combinar esta prova com outras.</div><div class="plan-actions"><button class="btn" data-goplan="${A.slug}">Abrir no planejador</button></div></div>`;

    // Áreas
    h += `<h2>Peso por grande área × seu desempenho</h2>`;
    h += sortableTable("ex-areas", A.areas, [
      { key: "nome", label: "Área" },
      { key: "pr", label: "% recente", num: true, render: a => fmt2(a.pr) },
      { key: "ph", label: "% histórico", num: true, render: a => fmt2(a.ph) },
      { key: "nr", label: "n recente", num: true, render: a => fmtInt(a.nr) },
      { key: "p2", label: "Seu % 2a", num: true, render: a => pct(a.p2) },
      { key: "p90", label: "Seu % 90d", num: true, render: a => pct(a.p90) },
      { key: "tr", label: "Tendência", sortVal: a => a.tr.delta, render: a => chip(a.tr) }
    ], state);

    // Gráficos
    const top = A.temas.filter(t => t.perda != null).sort((a, b) => b.perda - a.perda).slice(0, 15);
    h += `<div class="grid2">
      <div class="card"><div class="card-h"><h3>Perda esperada (questões em ${A.Q})</h3></div>
        <p class="hint">incidência estimada × (1 − acerto 2 anos) × ${A.Q}</p>
        ${hbars(top.map(t => ({ label: t.nome, value: t.perda, sub: `inc ${fmt2(t.inc)}% · acerto ${pct(t.acc)}`, cls: t.tr.status.includes("piora") ? "neg" : "" })), { fmt: v => v.toFixed(2).replace(".", ",") })}
      </div>
      <div class="card"><div class="card-h"><h3>Incidência × acerto</h3></div>
        <p class="hint">bolha = questões resolvidas (2 anos) · linha = seu acerto ponderado</p>
        ${scatter(A.temas.filter(t => t.inc != null && t.acc != null && t.inc > 0).map(t => ({
          x: t.inc, y: t.acc, n: t.nAcc, label: t.nome,
          cls: t.perda >= 0.8 ? "hot" : "", showLabel: t.inc >= 3 || t.perda >= 0.8
        })), { xLabel: "incidência estimada na prova", yLabel: "seu acerto (2 anos)", yRef: r.accPond })}
      </div></div>`;

    // Ranking
    h += `<h2>Ranking por tema</h2>
      <div class="toolbar"><label>Área <select data-filter="ex-area"><option value="">Todas</option>${A.areas.map(a => `<option ${state.exArea === a.nome ? "selected" : ""}>${esc(a.nome)}</option>`).join("")}</select></label>
      <label class="chk"><input type="checkbox" data-filter="ex-zero" ${state.exHideZero ? "checked" : ""}> ocultar temas sem incidência</label>
      <span class="hint">Padrão: ordenado por perda esperada.</span></div>`;
    if (!state["ex-rank"]) state["ex-rank"] = { key: "perda", dir: -1 };
    const rows = A.temas.filter(t => (!state.exArea || t.area === state.exArea) && (!state.exHideZero || (t.inc || 0) > 0));
    h += sortableTable("ex-rank", rows, [
      { key: "nome", label: "Tema", render: t => `<b>${esc(t.nome)}</b><div class="tiny">${esc(t.area)}</div>` },
      { key: "nr", label: "n rec.", num: true, title: "questões da prova no ciclo recente", render: t => fmtInt(t.nr) },
      { key: "nh", label: "n hist.", num: true, render: t => fmtInt(t.nh) },
      { key: "inc", label: "Incid. est.", num: true, title: "% estimada (fonte .md)", render: t => fmt2(t.inc) + "%" },
      { key: "acc", label: "Acerto 2a", num: true, render: t => `<span class="${(t.nAcc || 0) < 20 ? "lowconf" : ""}">${pct(t.acc)}</span> <span class="tiny">(${fmtInt(t.nAcc)})</span>` },
      { key: "p90", label: "Acerto 90d", num: true, render: t => `${pct(t.p90)} <span class="tiny">(${fmtInt(t.n90)})</span>` },
      { key: "tr", label: "Tendência", sortVal: t => t.tr.delta, render: t => chip(t.tr) },
      { key: "perda", label: `Perda/${A.Q}`, num: true, render: t => t.perda == null ? "—" : `<b>${fmt2(t.perda)}</b>` },
      { key: "volRatio", label: "Vol. 90d ÷ incid.", num: true, title: "fatia das suas questões nos 90 dias ÷ fatia da incidência (1 = proporcional)", render: t => t.volRatio == null ? "—" : fmt2(t.volRatio) },
      { key: "flags", label: "Alertas", sortVal: t => t.flags.length, render: t => t.flags.map(f => `<span class="flag ${/sub-treino|sumiu/.test(f) ? "warn" : ""}">${esc(f)}</span>`).join(" ") }
    ], state);

    // Anos
    if (ex.anos.length) {
      h += `<div class="card"><div class="card-h"><h3>Questões da prova no banco, por ano</h3></div>
        ${hbars(ex.anos.map(a => ({ label: a.ano, value: a.n || 0, cls: /^20(2|3)/.test(a.ano) ? "s2" : "s1" })), { fmt: v => String(v), labelW: 90, rowH: 20, width: 1100 })}</div>`;
    }
    return h;
  }

  window.VIEWS = { overview, exam, plannerPage, plannerBody, SLIDERS, chip, sortableTable, fmtInt, fmt1, fmt2, pct };
})();
