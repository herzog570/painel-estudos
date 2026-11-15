/* Orquestração: carrega fontes (.md), monta guias, trata eventos. */
(function () {
  "use strict";
  const cfg = window.DASH_CONFIG, PL = window.PLANNER;
  const state = { tab: (location.hash || "#geral").slice(1), exHideZero: true };
  let DB = null, ctx = null;

  const $ = s => document.querySelector(s);

  function build(files, origem) {
    DB = window.MODEL.loadSources(files);
    DB.origem = origem;
    render();
  }

  const slugs = () => Object.keys(DB.provas).sort();
  function tabs() {
    const t = [{ id: "geral", label: "Visão geral" }];
    if (slugs().length) t.push({ id: "planejador", label: "Planejador" });
    slugs().forEach(slug => t.push({ id: "prova-" + slug, label: (cfg.provas[slug] || {}).nome || slug.toUpperCase() }));
    return t;
  }

  /* ---------- Estado do planejador (conveniência local; funciona sem storage) ---------- */
  const KEY = "painel.plan.v2";
  let ST = null;
  function st() {
    if (ST) return ST;
    let v = null;
    try { v = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { v = null; }
    ST = Object.assign({ sel: {}, w: null, q: null, params: {} }, v && typeof v === "object" ? v : {});
    return ST;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (_) { /* fica em memória */ } }

  /* Monta o contexto do planejador: provas, seleção, pesos e os dois planos (atual e recomendado) */
  function buildCtx() {
    const S = st(), P = cfg.planejador, perfDate = DB.desempenho && DB.desempenho.date;
    const exams = slugs().map(slug => {
      const A = window.MODEL.analyzeExam(slug, DB.provas[slug].data, DB.desempenho, cfg);
      const dias = PL.diasAte(A.cfg.data);
      const passada = dias != null && dias < 0;
      const selected = passada ? S.sel[slug] === "force" : S.sel[slug] !== false;
      return { slug, A, nome: A.cfg.nome, Q: A.Q, dias, dataFmt: A.cfg.data ? A.cfg.data.split("-").reverse().join("/") : null,
               selected, pontos: A.resumo.pontosEsperados, accPond: A.resumo.accPond, w: 0, wSug: 0, idx: -1 };
    });
    const sel = exams.filter(e => e.selected);
    const sug = PL.pesosSugeridos(sel);
    let raw = sel.map((e, i) => (S.w && S.w[e.slug] != null ? Math.max(0, S.w[e.slug]) : null));
    const wManual = !!S.w && raw.some(v => v != null);
    raw = raw.map((v, i) => (v != null ? v : (wManual ? 100 * sug[i] : sug[i])));
    let tot = raw.reduce((s, v) => s + v, 0);
    if (!(tot > 0)) { raw = sug.slice(); tot = raw.reduce((s, v) => s + v, 0) || 1; }
    sel.forEach((e, i) => { e.idx = i; e.w = raw[i] / tot; e.wSug = sug[i]; });
    const As = sel.map(e => e.A), W = sel.map(e => e.w);
    const q = Array.isArray(S.q) && S.q.length === P.blocos.length ? S.q : null;
    const recPl = PL.plan(As, W, DB.semana, perfDate, cfg, q, null);
    const pl = PL.plan(As, W, DB.semana, perfDate, cfg, q, S.params);
    ctx = { exams, pl, recPl, P, wManual };
    return ctx;
  }
  const tituloPlano = () => ctx.exams.filter(e => e.selected).map(e => e.nome + (ctx.exams.filter(x => x.selected).length > 1 ? " " + Math.round(100 * e.w) + "%" : "")).join(" + ");

  function render() {
    const T = tabs();
    if (!T.find(t => t.id === state.tab)) state.tab = "geral";
    $("#tabs").innerHTML = T.map(t => `<button class="tab ${t.id === state.tab ? "on" : ""}" data-tab="${t.id}">${t.label}</button>`).join("");

    let html = "";
    try {
      if (state.tab === "geral") {
        if (!DB.desempenho) html = `<div class="empty">Nenhum arquivo <code>desempenho_*.md</code> encontrado.</div>`;
        else html = window.VIEWS.overview(DB.desempenho, window.MODEL.analyzeOverview(DB.desempenho, cfg), state);
      } else if (state.tab === "planejador") {
        html = window.VIEWS.plannerPage(buildCtx());
      } else {
        const slug = state.tab.replace(/^prova-/, "");
        html = window.VIEWS.exam(window.MODEL.analyzeExam(slug, DB.provas[slug].data, DB.desempenho, cfg), state);
      }
    } catch (e) {
      console.error(e);
      html = `<div class="empty">Erro ao montar a guia: ${e.message}</div>`;
    }
    $("#view").innerHTML = html;

    const d = DB.desempenho;
    $("#fontes").innerHTML = `Fontes (${DB.origem}): ${DB.arquivos.map(a => `<code>${a}</code>`).join(" · ")}`
      + (window.MD_GERADO_EM && DB.origem === "dados.js" ? ` · atualizado em ${window.MD_GERADO_EM}` : "")
      + (d ? ` · desempenho de ${d.date.split("-").reverse().join("/")}` : "");
  }

  /* Atualização em tempo real: recalcula e troca só o corpo do plano e os rótulos (não toca nos sliders) */
  function live() {
    if (state.tab !== "planejador") return;
    buildCtx();
    const X = ctx.pl.X, R = ctx.recPl.X;
    let n = 0;
    window.VIEWS.SLIDERS.forEach(s => {
      const el = document.getElementById("v-" + s.k); if (el) el.textContent = s.fmt(X[s.k]);
      const box = document.querySelector('[data-sl="' + s.k + '"]');
      const ch = Math.abs(X[s.k] - R[s.k]) > s.step / 2; if (ch) n++;
      if (box) box.classList.toggle("changed", ch);
    });
    const cs = document.getElementById("ctrl-state");
    if (cs) cs.textContent = n ? n + " ajuste(s) fora do recomendado" : "configuração recomendada";
    ctx.exams.forEach(e => { const el = document.getElementById("wl-" + e.slug); if (el) el.textContent = e.selected ? Math.round(100 * e.w) + "%" : "fora"; });
    const ws = document.getElementById("w-state"); if (ws) ws.textContent = ctx.wManual ? "pesos ajustados à mão" : "pesos sugeridos pelas datas";
    const root = document.getElementById("plan-root");
    if (root) root.innerHTML = window.VIEWS.plannerBody(ctx);
  }

  function copyText(t) {
    const done = () => { const b = document.querySelector('[data-plan="copiar"]'); if (b) { b.textContent = "Copiado ✓"; setTimeout(() => { const x = document.querySelector('[data-plan="copiar"]'); if (x) x.textContent = "Copiar plano"; }, 1500); } };
    const fallback = () => { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (_) { prompt("Copie o plano:", t); } ta.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
  }

  /* ---------- Eventos ---------- */
  document.addEventListener("click", e => {
    const gp = e.target.closest("[data-goplan]");
    if (gp) {
      const S = st(), slug = gp.dataset.goplan, dias = PL.diasAte((cfg.provas[slug] || {}).data);
      if (dias != null && dias < 0) S.sel[slug] = "force"; else delete S.sel[slug];
      save(); state.tab = "planejador"; history.replaceState(null, "", "#planejador"); render(); window.scrollTo(0, 0); return;
    }
    const pb = e.target.closest("button[data-plan]");
    if (pb && ctx) {
      const S = st(), a = pb.dataset.plan;
      if (a === "copiar") copyText(PL.asText(ctx.pl, tituloPlano()));
      if (a === "reset") { S.params = {}; save(); const R = ctx.recPl.X; document.querySelectorAll("input[data-param]").forEach(i => { i.value = R[i.dataset.param]; }); live(); }
      if (a === "sugerido") { S.q = null; save(); live(); }
      if (a === "pesos") { S.w = null; save(); render(); }
      return;
    }
    const tb = e.target.closest("[data-tab]");
    if (tb) { state.tab = tb.dataset.tab; history.replaceState(null, "", "#" + state.tab); render(); window.scrollTo(0, 0); return; }
    const th = e.target.closest("th[data-sort]");
    if (th) {
      const id = th.closest("table").dataset.table, key = th.dataset.sort;
      const s = state[id] || (state[id] = { key: null, dir: -1 });
      if (s.key === key) s.dir *= -1; else { s.key = key; s.dir = -1; }
      render();
    }
  });

  document.addEventListener("input", e => {
    const d = e.target.dataset || {};
    if (d.param && ctx) {
      const S = st(), v = parseFloat(e.target.value), sd = window.VIEWS.SLIDERS.find(x => x.k === d.param);
      if (Math.abs(v - ctx.recPl.X[d.param]) <= (sd ? sd.step / 2 : 1e-9)) delete S.params[d.param]; else S.params[d.param] = v;
      save(); live();
    } else if (d.w && ctx) {
      const S = st(), v = parseFloat(e.target.value);
      if (!S.w) { S.w = {}; ctx.exams.filter(x => x.selected).forEach(x => { S.w[x.slug] = Math.round(100 * x.w); }); }
      if (d.w === "balance") { S.w[d.a] = 100 - v; S.w[d.b] = v; } else S.w[d.w] = v;
      save(); live();
    }
  });

  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.filter) {
      if (d.filter === "ov-area") state.ovArea = e.target.value;
      if (d.filter === "ex-area") state.exArea = e.target.value;
      if (d.filter === "ex-zero") state.exHideZero = e.target.checked;
      render(); return;
    }
    if (d.sel) {
      const S = st(), dias = PL.diasAte((cfg.provas[d.sel] || {}).data), passada = dias != null && dias < 0;
      if (e.target.checked) { if (passada) S.sel[d.sel] = "force"; else delete S.sel[d.sel]; } else S.sel[d.sel] = false;
      save(); render(); return;
    }
    if (d.plan === "n" && ctx) {
      const S = st(), P = cfg.planejador, n = parseInt(e.target.value, 10);
      const q = ctx.pl.blocos.map(b => b.N);
      q[+d.i] = isNaN(n) ? P.questoesPadrao : Math.min(200, Math.max(10, n));
      S.q = q; save(); live();
    }
  });

  /* Carregar pasta manualmente (alternativa ao .bat) */
  $("#pick").addEventListener("change", async e => {
    const files = {};
    for (const f of e.target.files) if (/\.md$/i.test(f.name) && !/[\\/]app[\\/]/.test(f.webkitRelativePath || "")) files[f.name] = await f.text();
    if (!Object.keys(files).length) { alert("Nenhum .md encontrado na pasta escolhida."); return; }
    build(files, "pasta selecionada");
  });

  if (window.MD_FONTES && Object.keys(window.MD_FONTES).length) build(window.MD_FONTES, "dados.js");
  else $("#view").innerHTML = `<div class="empty"><h2>Sem dados carregados</h2>
    <p>Rode <b>Abrir Painel.bat</b> (lê os .md da pasta e abre esta tela) ou use <b>Carregar pasta…</b> e escolha a pasta <i>dashboard estudos</i>.</p></div>`;
})();
