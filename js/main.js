/* Orquestração: carrega fontes (.md), monta guias, trata eventos. */
(function () {
  "use strict";
  const cfg = window.DASH_CONFIG, PL = window.PLANNER;
  const state = { tab: /^#[a-z][a-z0-9-]*$/.test(location.hash) ? location.hash.slice(1) : "", exHideZero: true };
  let DB = null, ctx = null;
  const API = window.API, AV = window.AV, PF = window.PERFIL;
  const APP = { screen: "carregando", msg: null, session: null, profile: null, rows: [], resumos: [], vendo: null, offline: false };

  const $ = s => document.querySelector(s);

  /* ---------- Dados ---------- */
  const slugs = () => Object.keys(DB.provas).sort();
  const mestre = () => APP.profile && APP.profile.papel === "mestre";
  const uid = () => APP.session && APP.session.user.id;

  function recompute() {
    const hoje = new Date();
    DB.desempenho = PF.perf(APP.rows, hoje);
    DB.desempenhoPlan = PF.perf(APP.rows, hoje, PF.corte7(hoje));   // histórico sem os últimos 7 dias...
    DB.semana = PF.semana(APP.rows, hoje);                          // ...que entram no planejador como "semana"
  }
  function tabs() {
    if (mestre()) return [{ id: "alunos", label: "Alunos" }, { id: "conta", label: "Minha conta" }];   // mestre só monitora
    const t = [{ id: "geral", label: "Visão geral" }, { id: "lancar", label: "Lançar questões" }];
    if (slugs().length) t.push({ id: "planejador", label: "Planejador" });
    slugs().forEach(slug => t.push({ id: "prova-" + slug, label: (cfg.provas[slug] || {}).nome || slug.toUpperCase() }));
    t.push({ id: "conta", label: "Minha conta" });
    return t;
  }

  /* Cópia local do último carregamento, para abrir sem internet (só os dados do próprio usuário) */
  const CK = "painel.cache.v1";
  const guardar = () => { try { localStorage.setItem(CK, JSON.stringify({ uid: uid(), profile: APP.profile, rows: APP.rows })); } catch (_) { /* sem cache */ } };
  const lerCache = () => { try { const c = JSON.parse(localStorage.getItem(CK) || "null"); return c && c.uid === uid() ? c : null; } catch (_) { return null; } };
  const limparCache = () => { try { localStorage.removeItem(CK); } catch (_) { /* nada */ } };

  async function carregar() {
    const todos = mestre() ? await API.rows(null) : null;
    APP.rows = todos ? todos.filter(r => r.user_id === uid()) : await API.rows(uid());
    if (todos) {
      const perfis = await API.profiles(), por = new Map();
      todos.forEach(r => { if (!por.has(r.user_id)) por.set(r.user_id, []); por.get(r.user_id).push(r); });
      APP.resumos = perfis.filter(pf => pf.papel !== "mestre").map(pf => AV.resumoAluno(pf, por.get(pf.id) || [], DB, cfg));
    }
    APP.offline = false;
    recompute(); guardar();
  }

  async function entrar(session) {
    APP.session = session; APP.msg = null;
    try {
      APP.profile = await API.myProfile(uid());
      if (!APP.profile) { APP.screen = "erro"; APP.msg = { tipo: "erro", texto: "Sua conta existe, mas o perfil não foi encontrado no banco. Avise o responsável pelo painel." }; return render(); }
      if (APP.profile.status !== "aprovado") { APP.screen = "aguardando"; return render(); }
      await carregar();
    } catch (e) {
      const c = e.rede ? lerCache() : null;
      if (!c) { APP.screen = "erro"; APP.msg = { tipo: "erro", texto: e.message }; return render(); }
      APP.profile = c.profile; APP.rows = c.rows; APP.resumos = []; APP.offline = true; recompute();
    }
    APP.screen = "app";
    if (!state.tab) state.tab = mestre() && !APP.offline ? "alunos" : "geral";
    render();
  }
  function sair() { APP.session = null; APP.profile = null; APP.rows = []; APP.resumos = []; APP.vendo = null; APP.screen = "login"; state.tab = ""; limparCache(); render(); }

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
    const S = st(), P = cfg.planejador, perfDate = DB.desempenhoPlan && DB.desempenhoPlan.date;
    const exams = slugs().map(slug => {
      const A = window.MODEL.analyzeExam(slug, DB.provas[slug].data, DB.desempenhoPlan, cfg);
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
    const app = APP.screen === "app";
    document.body.classList.toggle("anon", !app);
    if (!app) { $("#tabs").innerHTML = ""; $("#userbox").innerHTML = ""; $("#fontes").innerHTML = ""; $("#view").innerHTML = AV.auth(APP); return; }

    const T = tabs();
    if (!T.find(t => t.id === state.tab)) state.tab = T[0].id;
    if (state.tab !== "alunos") APP.vendo = null;
    $("#tabs").innerHTML = T.map(t => t.sep ? `<div class="tab-sep">${t.sep}</div>` : `<button class="tab ${t.id === state.tab ? "on" : ""}" data-tab="${t.id}" ${t.id === state.tab ? 'aria-current="page"' : ""}>${t.label}</button>`).join("");
    $("#userbox").innerHTML = `<div class="ub-name">${window.CHARTS.esc(APP.profile.nome || APP.profile.email)}</div>
      <div class="ub-sub">${mestre() ? "mestre" : "aluno"}${APP.offline ? " · sem conexão" : ""}</div><button class="link" data-act="sair">Sair</button>`;

    let html = "";
    const temDados = DB.desempenho.totals.a2.total > 0;
    try {
      if (state.tab === "alunos") {
        const r = APP.vendo && APP.resumos.find(x => x.pf.id === APP.vendo);
        html = APP.offline ? `<div class="empty"><h2>Sem conexão</h2><p>A lista de alunos precisa de internet.</p></div>`
          : r ? AV.mestreAluno(r, DB, cfg, state) : AV.mestre(APP, DB, cfg, state);
      } else if (state.tab === "lancar") {
        html = AV.lancar(APP, PF.taxonomia(DB.provas), state);
      } else if (state.tab === "conta") {
        html = AV.conta(APP, slugs(), cfg);
      } else if (state.tab === "geral") {
        html = temDados ? window.VIEWS.overview(DB.desempenho, window.MODEL.analyzeOverview(DB.desempenho, cfg), state)
          : AV.vazio("Registre as listas que você fizer para ver seu desempenho por área e por tema.");
      } else if (state.tab === "planejador") {
        html = temDados ? window.VIEWS.plannerPage(buildCtx()) : AV.vazio("O planejador usa seus acertos por subtema. Lance suas primeiras listas para gerar o plano.");
      } else {
        const slug = state.tab.replace(/^prova-/, "");
        html = window.VIEWS.exam(window.MODEL.analyzeExam(slug, DB.provas[slug].data, DB.desempenho, cfg), state);
      }
    } catch (e) {
      console.error(e);
      html = `<div class="empty">Erro ao montar a guia: ${e.message}</div>`;
    }
    $("#view").innerHTML = (APP.offline ? `<p class="msg">Sem conexão: mostrando os dados salvos neste aparelho. Lançamentos novos precisam de internet.</p>` : "") + html;
    $("#fontes").innerHTML = `Incidência: ${DB.arquivos.map(a => `<code>${a}</code>`).join(" · ")}` + (window.MD_GERADO_EM ? ` · atualizado em ${window.MD_GERADO_EM}` : "");
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

  /* ---------- Conta, lançamentos e mestre ---------- */
  const ir = tab => { state.tab = tab; history.replaceState(null, "", "#" + tab); };
  async function tarefa(fn, okMsg) {
    try { await fn(); APP.msg = okMsg ? { tipo: "ok", texto: okMsg } : null; }
    catch (e) { APP.msg = { tipo: "erro", texto: e.message }; }
    render();
  }

  document.addEventListener("click", e => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const a = b.dataset.act;
    if (a === "ir") { APP.screen = b.dataset.to; APP.msg = null; render(); }
    else if (a === "sair") { API.signOut().catch(() => {}); sair(); }
    else if (a === "recarregar") { APP.screen = "carregando"; render(); iniciar(); }
    else if (a === "ver") { APP.vendo = b.dataset.id; APP.msg = null; render(); window.scrollTo(0, 0); }
    else if (a === "voltar") { APP.vendo = null; render(); window.scrollTo(0, 0); }
    else if (a === "apagar") {
      if (!confirm("Apagar este lançamento? Não dá para desfazer.")) return;
      tarefa(async () => { await API.delRow(+b.dataset.id); await carregar(); }, "Lançamento apagado.");
    } else if (a === "status") {
      const st = b.dataset.st, r = APP.resumos.find(x => x.pf.id === b.dataset.id), quem = r ? (r.pf.nome || r.pf.email) : "este perfil";
      if (st === "bloqueado" && !confirm(`Bloquear o acesso de ${quem}?`)) return;
      tarefa(async () => { await API.updateProfile(b.dataset.id, { status: st }); await carregar(); if (st === "bloqueado") APP.vendo = null; },
        st === "aprovado" ? `${quem}: acesso aprovado.` : `${quem}: acesso bloqueado.`);
    }
  });

  document.addEventListener("submit", e => {
    const f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f)), tipo = f.dataset.form;
    const falha = t => { APP.msg = { tipo: "erro", texto: t }; render(); };
    const email = (v.email || "").trim();
    if (tipo === "login") {
      if (!email || !v.senha) return falha("Informe e-mail e senha.");
      tarefa(async () => { const d = await API.signIn(email, v.senha); await entrar(d.session); });
    } else if (tipo === "cadastro") {
      if (!(v.nome || "").trim() || !email) return falha("Informe nome e e-mail.");
      if ((v.senha || "").length < 8) return falha("A senha precisa ter pelo menos 8 caracteres.");
      tarefa(async () => {
        const d = await API.signUp(v.nome.trim(), email, v.senha);
        if (d.session) return entrar(d.session);
        APP.screen = "login";
      }, "Conta criada. Abra o link de confirmação que enviamos para o seu e-mail e depois entre.");
    } else if (tipo === "recuperar") {
      if (!email) return falha("Informe o e-mail da conta.");
      tarefa(async () => { await API.recover(email); APP.screen = "login"; }, "Se o e-mail tiver conta, enviamos um link para criar uma nova senha.");
    } else if (tipo === "novasenha") {
      if ((v.senha || "").length < 8) return falha("A senha precisa ter pelo menos 8 caracteres.");
      tarefa(async () => { await API.setPassword(v.senha); await entrar(await API.session()); });
    } else if (tipo === "lancar") {
      const q = parseInt(v.questoes, 10), c = parseInt(v.acertos, 10);
      state.lcData = v.data; state.lcArea = v.area;
      if (!v.data || !v.tema) return falha("Escolha a data e o subtema.");
      if (!(q > 0)) return falha("Informe quantas questões você fez.");
      if (!(c >= 0) || c > q) return falha("Os acertos precisam estar entre 0 e o número de questões.");
      tarefa(async () => { await API.addRows([{ data: v.data, area: v.area, tema: v.tema, questoes: q, acertos: c, origem: "manual" }]); await carregar(); },
        `Salvo: ${v.tema}, ${c} de ${q}.`);
    } else if (tipo === "conta") {
      const provas = [...f.querySelectorAll('input[name="prova"]:checked')].map(i => i.value);
      if (!(v.nome || "").trim()) return falha("Informe seu nome.");
      tarefa(async () => { APP.profile = (await API.updateProfile(uid(), mestre() ? { nome: v.nome.trim() } : { nome: v.nome.trim(), provas })) || APP.profile; guardar(); }, "Dados salvos.");
    }
  });

  document.addEventListener("change", async e => {
    const d = e.target.dataset || {};
    if (d.lc === "area") { state.lcArea = e.target.value; const dt = document.getElementById("lc-data"); if (dt) state.lcData = dt.value; APP.msg = null; render(); }
    if (d.lc === "importar" && e.target.files[0]) {
      const file = e.target.files[0], m = file.name.match(/(\d{4}-\d{2}-\d{2})/);
      const txt = await file.text();
      const nome = "semana_" + (m ? m[1] : PF.iso(new Date())) + ".md";
      const sem = window.MODEL.loadSources({ [nome]: txt }).semana;
      const linhas = sem ? sem.temas.filter(t => t.n > 0 && t.c <= t.n && t.area) : [];
      if (!linhas.length) { APP.msg = { tipo: "erro", texto: "Não encontrei linhas válidas no arquivo (colunas Área, Tema, Questões, Acertos)." }; return render(); }
      if (!confirm(`Importar ${linhas.length} linhas (${linhas.reduce((s, t) => s + t.n, 0)} questões) com data ${PF.br(sem.date)}?`)) return render();
      tarefa(async () => { await API.addRows(linhas.map(t => ({ data: sem.date, area: t.area, tema: t.nome, questoes: t.n, acertos: t.c, origem: "estrategia" }))); await carregar(); },
        `${linhas.length} linhas importadas.`);
    }
  });

  /* ---------- Início ---------- */
  async function iniciar() {
    if (!API) { APP.screen = "erro"; APP.msg = { tipo: "erro", texto: "Não foi possível carregar o serviço de login. Verifique a internet e tente de novo." }; return render(); }
    try {
      const s = await API.session();
      if (s) return entrar(s);
      APP.screen = "login"; render();
    } catch (e) { APP.screen = "erro"; APP.msg = { tipo: "erro", texto: e.message }; render(); }
  }

  DB = window.MODEL.loadSources(window.MD_FONTES || {});
  DB.desempenho = null; DB.semana = null;
  render();
  if (API) API.onAuth((ev, s) => {
    if (ev === "PASSWORD_RECOVERY") { APP.session = s; APP.screen = "novasenha"; APP.msg = null; render(); }
    else if (ev === "SIGNED_OUT" && APP.session) sair();
  });
  iniciar();
})();
