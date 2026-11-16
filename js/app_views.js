/* Telas da conta: login, cadastro, lançamentos, minha conta e painel do mestre. */
(function () {
  "use strict";
  const { esc, hbars } = window.CHARTS;
  const V = window.VIEWS, P = window.PERFIL;
  const { fmtInt, fmt1, pct, chip, sortableTable } = V;

  const aviso = m => (m ? `<p class="msg ${m.tipo || ""}" role="${m.tipo === "erro" ? "alert" : "status"}">${esc(m.texto)}</p>` : "");
  const campo = (id, label, type, extra) => `<label class="fld" for="${id}"><span>${label}</span><input id="${id}" name="${id}" type="${type}" ${extra || ""}></label>`;

  /* ---------- Entrada ---------- */
  function auth(APP) {
    const s = APP.screen;
    let corpo = "";
    if (s === "carregando") corpo = `<p class="muted">Carregando…</p>`;
    else if (s === "erro") corpo = `<h1>Painel indisponível</h1>${aviso(APP.msg)}<button class="btn primary" data-act="recarregar">Tentar de novo</button>`;
    else if (s === "login") corpo = `<h1>Entrar</h1>${aviso(APP.msg)}
      <form data-form="login" novalidate>
        ${campo("email", "E-mail", "email", 'autocomplete="email" required')}
        ${campo("senha", "Senha", "password", 'autocomplete="current-password" required')}
        <button class="btn primary" type="submit">Entrar</button>
      </form>
      <p class="alt"><button class="link" data-act="ir" data-to="cadastro">Criar conta</button><button class="link" data-act="ir" data-to="recuperar">Esqueci a senha</button></p>`;
    else if (s === "cadastro") corpo = `<h1>Criar conta</h1>${aviso(APP.msg)}
      <form data-form="cadastro" novalidate>
        ${campo("nome", "Nome", "text", 'autocomplete="name" required maxlength="80"')}
        ${campo("email", "E-mail", "email", 'autocomplete="email" required')}
        ${campo("senha", "Senha (mínimo de 8 caracteres)", "password", 'autocomplete="new-password" required minlength="8"')}
        <p class="tiny">Guardamos seu nome, e-mail e os lançamentos de questões que você registrar. Só você e o responsável pelo painel veem esses dados. Para apagar sua conta, peça ao responsável.</p>
        <button class="btn primary" type="submit">Criar conta</button>
      </form>
      <p class="tiny">Depois de confirmar o e-mail, o acesso depende de aprovação do responsável.</p>
      <p class="alt"><button class="link" data-act="ir" data-to="login">Já tenho conta</button></p>`;
    else if (s === "recuperar") corpo = `<h1>Recuperar senha</h1>${aviso(APP.msg)}
      <form data-form="recuperar" novalidate>
        ${campo("email", "E-mail", "email", 'autocomplete="email" required')}
        <button class="btn primary" type="submit">Enviar link</button>
      </form>
      <p class="alt"><button class="link" data-act="ir" data-to="login">Voltar para Entrar</button></p>`;
    else if (s === "novasenha") corpo = `<h1>Nova senha</h1>${aviso(APP.msg)}
      <form data-form="novasenha" novalidate>
        ${campo("senha", "Nova senha (mínimo de 8 caracteres)", "password", 'autocomplete="new-password" required minlength="8"')}
        <button class="btn primary" type="submit">Salvar senha</button>
      </form>`;
    else if (s === "aguardando") {
      const bloq = APP.profile && APP.profile.status === "bloqueado";
      corpo = `<h1>${bloq ? "Acesso bloqueado" : "Aguardando aprovação"}</h1>
        <p>${bloq ? "Sua conta foi bloqueada pelo responsável pelo painel." : "Sua conta foi criada. O responsável pelo painel precisa aprovar seu acesso."}</p>
        <p class="tiny">${esc((APP.profile && APP.profile.email) || "")}</p>
        <p class="alt"><button class="btn" data-act="recarregar">Verificar de novo</button><button class="link" data-act="sair">Sair</button></p>`;
    }
    return `<section class="auth"><div class="auth-brand"><span class="mark"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" stroke-width="1"/><text x="20" y="25" text-anchor="middle" font-family="EB Garamond, Georgia, serif" font-size="17" font-style="italic" fill="currentColor">LH</text></svg></span><span>Painel de Estudos</span></div>
      <div class="auth-card">${corpo}</div></section>`;
  }

  function vazio(texto) {
    return `<div class="empty"><h2>Nenhuma questão lançada</h2><p>${texto}</p><p><button class="btn primary" data-tab="lancar">Lançar questões</button></p></div>`;
  }

  /* ---------- Lançar questões ---------- */
  function lancar(APP, tax, state) {
    const area = state.lcArea && tax.find(t => t.area === state.lcArea) ? state.lcArea : (tax[0] || {}).area;
    const temas = (tax.find(t => t.area === area) || { temas: [] }).temas;
    const hoje = P.iso(new Date());
    let h = `<section class="exam-head"><h2 class="nomargin">Lançar questões</h2>
      <div class="muted">Registre cada lista que você fizer: o painel e o planejador são calculados a partir daqui.</div></section>
      ${aviso(APP.msg)}
      <div class="card"><form data-form="lancar" class="lc-form" novalidate>
        <label class="fld" for="lc-data"><span>Data</span><input id="lc-data" name="data" type="date" value="${esc(state.lcData || hoje)}" max="${hoje}" required></label>
        <label class="fld" for="lc-area"><span>Grande área</span><select id="lc-area" name="area" data-lc="area">${tax.map(t => `<option ${t.area === area ? "selected" : ""}>${esc(t.area)}</option>`).join("")}</select></label>
        <label class="fld grow" for="lc-tema"><span>Subtema</span><select id="lc-tema" name="tema">${temas.map(t => `<option>${esc(t)}</option>`).join("")}</select></label>
        <label class="fld num" for="lc-q"><span>Questões</span><input id="lc-q" name="questoes" type="number" min="1" max="5000" inputmode="numeric" required></label>
        <label class="fld num" for="lc-c"><span>Acertos</span><input id="lc-c" name="acertos" type="number" min="0" max="5000" inputmode="numeric" required></label>
        <button class="btn primary" type="submit">Salvar</button>
      </form></div>
      <details class="notes"><summary>Importar arquivo de semana (.md)</summary>
        <p class="hint">Aceita o arquivo <code>semana_AAAA-MM-DD.md</code> gerado pelo fechamento automático, com as colunas Área, Tema, Questões e Acertos. Cada linha vira um lançamento na data do arquivo.</p>
        <label class="btn">Escolher arquivo<input type="file" accept=".md,text/markdown,text/plain" data-lc="importar" hidden></label>
      </details>`;

    const rec = APP.rows.filter(r => r.origem !== "saldo_inicial").slice(0, 40);
    const ini = APP.rows.filter(r => r.origem === "saldo_inicial");
    h += `<h2>Lançamentos recentes</h2>`;
    if (!rec.length) h += `<p class="muted">Nada lançado ainda.</p>`;
    else h += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Subtema</th><th class="num">Questões</th><th class="num">Acertos</th><th class="num">%</th><th></th></tr></thead><tbody>` +
      rec.map(r => `<tr><td>${P.br(r.data)}</td><td><b>${esc(r.tema)}</b><div class="tiny">${esc(r.area)}${r.origem === "estrategia" ? " · importado" : ""}</div></td>
        <td class="num">${fmtInt(r.questoes)}</td><td class="num">${fmtInt(r.acertos)}</td><td class="num">${pct(100 * r.acertos / r.questoes)}</td>
        <td class="num"><button class="link danger" data-act="apagar" data-id="${r.id}" aria-label="Apagar lançamento de ${esc(r.tema)} em ${P.br(r.data)}">Apagar</button></td></tr>`).join("") + `</tbody></table></div>`;
    if (ini.length) h += `<p class="tiny">Histórico inicial importado: ${fmtInt(ini.reduce((s, r) => s + r.questoes, 0))} questões em ${ini.length} linhas (não aparecem na lista acima).</p>`;
    return h;
  }

  /* ---------- Minha conta ---------- */
  function conta(APP, provas, cfg) {
    const pf = APP.profile, sel = new Set(pf.provas || []);
    return `<section class="exam-head"><h2 class="nomargin">Minha conta</h2><div class="muted">${esc(pf.email)}</div></section>
      ${aviso(APP.msg)}
      <div class="card"><form data-form="conta" class="ct-form" novalidate>
        <label class="fld" for="ct-nome"><span>Nome</span><input id="ct-nome" name="nome" type="text" maxlength="80" value="${esc(pf.nome || "")}" required></label>
        <fieldset class="fld"><legend>Provas que vou prestar</legend>
          ${provas.map(s => `<label class="chk"><input type="checkbox" name="prova" value="${s}" ${sel.has(s) ? "checked" : ""}> ${esc((cfg.provas[s] || {}).titulo || s.toUpperCase())}</label>`).join("")}
        </fieldset>
        <button class="btn primary" type="submit">Salvar</button>
      </form></div>
      <p><button class="btn" data-act="sair">Sair</button></p>`;
  }

  /* ---------- Mestre: resumo de um aluno ---------- */
  function resumoAluno(pf, rows, DB, cfg) {
    const perf = P.perf(rows), t2 = perf.totals.a2, t9 = perf.totals.d90;
    const w = P.semanas(rows, 1)[0];
    const ult = rows.length ? rows.reduce((m, r) => (r.data > m ? r.data : m), "0") : null;
    const dias = ult ? Math.round((new Date(P.iso(new Date())) - new Date(ult)) / 86400000) : null;
    const nPre = t2.total - t9.total, cPre = t2.corretas - t9.corretas;
    const tr = (nPre > 0 && t9.total > 0) ? window.MODEL.trend(t2.total, t2.pct, t9.total, t9.pct, cfg.regras) : { status: "sem-dado" };
    const proj = {};
    Object.keys(DB.provas).sort().forEach(slug => {
      const A = window.MODEL.analyzeExam(slug, DB.provas[slug].data, perf, cfg);
      proj[slug] = { A, acc: A.resumo.accPond, pontos: A.resumo.pontosEsperados, Q: A.Q, cobertura: A.resumo.cobertura, nome: A.cfg.nome };
    });
    return { pf, rows, perf, n7: w.n, p7: w.pct, nTot: t2.total, pTot: t2.pct, ult, dias, tr, proj };
  }

  function mestre(APP, DB, cfg, state) {
    const R = APP.resumos, slugs = Object.keys(DB.provas).sort();
    const alunos = R.filter(r => r.pf.status === "aprovado"), pend = R.filter(r => r.pf.status === "pendente"), bloq = R.filter(r => r.pf.status === "bloqueado");
    const ativos = alunos.filter(r => r.n7 > 0).length, q7 = alunos.reduce((s, r) => s + r.n7, 0);
    let h = `<section class="exam-head"><h2 class="nomargin">Alunos</h2><div class="muted">Atividade e desempenho de todos os perfis. Clique em um aluno para ver o detalhe.</div></section>
      ${aviso(APP.msg)}
      <section class="hero">
        <div class="kpi big"><div class="k-lbl">Perfis aprovados</div><div class="k-val">${alunos.length}</div><div class="k-sub">${pend.length} aguardando aprovação · ${bloq.length} bloqueados</div></div>
        <div class="kpi"><div class="k-lbl">Ativos nos últimos 7 dias</div><div class="k-val">${ativos}</div><div class="k-sub">lançaram ao menos uma lista</div></div>
        <div class="kpi"><div class="k-lbl">Questões nos últimos 7 dias</div><div class="k-val">${fmtInt(q7)}</div><div class="k-sub">soma de todos os perfis</div></div>
        <div class="kpi"><div class="k-lbl">Sem lançar há mais de 7 dias</div><div class="k-val">${alunos.filter(r => r.dias == null || r.dias > 7).length}</div><div class="k-sub">inclui quem nunca lançou</div></div>
      </section>`;

    if (pend.length) h += `<h2>Aguardando aprovação</h2><div class="tbl-wrap"><table class="tbl"><tbody>` +
      pend.map(r => `<tr><td><b>${esc(r.pf.nome || "(sem nome)")}</b><div class="tiny">${esc(r.pf.email)}</div></td><td class="tiny">cadastro em ${P.br(String(r.pf.criado_em).slice(0, 10))}</td>
        <td class="num"><button class="btn primary" data-act="status" data-id="${r.pf.id}" data-st="aprovado">Aprovar</button> <button class="btn" data-act="status" data-id="${r.pf.id}" data-st="bloqueado">Recusar</button></td></tr>`).join("") + `</tbody></table></div>`;

    h += `<h2>Perfis</h2>`;
    if (!state["ms-alunos"]) state["ms-alunos"] = { key: "n7", dir: -1 };
    const cols = [
      { key: "nome", label: "Aluno", sortVal: r => (r.pf.nome || r.pf.email).toLowerCase(), render: r => `<button class="link strong" data-act="ver" data-id="${r.pf.id}">${esc(r.pf.nome || r.pf.email)}</button><div class="tiny">${esc(r.pf.email)}${r.pf.papel === "mestre" ? " · mestre" : ""}</div>` },
      { key: "n7", label: "Questões 7d", num: true, render: r => fmtInt(r.n7) },
      { key: "p7", label: "Acerto 7d", num: true, render: r => pct(r.p7) },
      { key: "nTot", label: "Questões 2a", num: true, render: r => fmtInt(r.nTot) },
      { key: "pTot", label: "Acerto 2a", num: true, render: r => pct(r.pTot) },
      { key: "dias", label: "Último lançamento", num: true, sortVal: r => (r.dias == null ? 99999 : r.dias), render: r => r.dias == null ? "nunca" : r.dias === 0 ? "hoje" : `há ${r.dias} d` },
      { key: "tr", label: "Tendência 90d", sortVal: r => r.tr.delta, render: r => chip(r.tr) }
    ].concat(slugs.map(s => ({ key: "pj-" + s, label: "Projeção " + ((cfg.provas[s] || {}).nome || s), num: true, title: "acerto ponderado pela incidência da prova", sortVal: r => r.proj[s].acc, render: r => r.proj[s].acc == null ? "—" : `<span class="${r.proj[s].cobertura < 0.5 ? "lowconf" : ""}" title="dados cobrem ${Math.round(100 * (r.proj[s].cobertura || 0))}% da incidência da prova">${fmt1(r.proj[s].acc)}%</span>` })));
    h += alunos.length ? sortableTable("ms-alunos", alunos, cols, state) : `<p class="muted">Nenhum perfil aprovado ainda.</p>`;

    if (bloq.length) h += `<details class="notes"><summary>Bloqueados (${bloq.length})</summary><div class="tbl-wrap"><table class="tbl"><tbody>` +
      bloq.map(r => `<tr><td>${esc(r.pf.nome || "")}<div class="tiny">${esc(r.pf.email)}</div></td><td class="num"><button class="btn" data-act="status" data-id="${r.pf.id}" data-st="aprovado">Reativar</button></td></tr>`).join("") + `</tbody></table></div></details>`;
    return h;
  }

  function mestreAluno(r, DB, cfg, state) {
    const sem = P.semanas(r.rows, 8), slugs = Object.keys(DB.provas).sort();
    let h = `<p><button class="link" data-act="voltar">‹ Todos os alunos</button></p>
      <section class="exam-head"><h2 class="nomargin">${esc(r.pf.nome || r.pf.email)}</h2>
        <div class="muted">${esc(r.pf.email)} · ${r.dias == null ? "nunca lançou" : r.dias === 0 ? "lançou hoje" : "último lançamento há " + r.dias + " dias"}${(r.pf.provas || []).length ? " · vai prestar " + r.pf.provas.map(s => esc((cfg.provas[s] || {}).nome || s)).join(", ") : ""}</div></section>
      ${r.pf.papel !== "mestre" ? `<p><button class="btn" data-act="status" data-id="${r.pf.id}" data-st="bloqueado">Bloquear acesso</button></p>` : ""}`;
    if (!r.nTot) return h + `<div class="empty"><h2>Nenhuma questão lançada</h2><p>Este perfil ainda não registrou questões.</p></div>`;

    h += `<div class="card"><div class="card-h"><h3>Atividade semanal</h3><span class="hint">questões lançadas por semana (8 semanas)</span></div>
      ${hbars(sem.map(s => ({ label: s.label, value: s.n, sub: s.pct == null ? "sem lançamentos" : "acerto " + Math.round(s.pct) + "%" })), { fmt: v => String(v), labelW: 110, rowH: 22, width: 900, max: Math.max(...sem.map(s => s.n), 10) })}
      <div class="tbl-wrap flat"><table class="tbl"><thead><tr><th>Semana</th>${sem.map(s => `<th class="num">${s.label}</th>`).join("")}</tr></thead><tbody>
        <tr><td>Acerto</td>${sem.map(s => `<td class="num">${pct(s.pct)}</td>`).join("")}</tr></tbody></table></div></div>`;

    h += `<h2>Análise de potencial</h2><p class="hint">Projeção = acerto de 2 anos ponderado pela incidência de cada prova. Perdas = incidência × erro, em questões da prova.</p><div class="grid2">`;
    slugs.forEach(s => {
      const pj = r.proj[s], top = pj.A.temas.filter(t => t.perda != null).sort((a, b) => b.perda - a.perda).slice(0, 6);
      h += `<div class="card"><div class="card-h"><h3>${esc(pj.nome)}</h3><span class="ec-w">${pj.acc == null ? "—" : fmt1(pj.acc) + "%"}</span></div>
        <p class="hint">≈ ${pj.pontos == null ? "—" : fmt1(pj.pontos)} de ${pj.Q} questões · dados cobrem ${pj.cobertura == null ? "—" : Math.round(100 * pj.cobertura) + "%"} da incidência</p>
        ${top.length ? `<table class="plan-tbl"><tbody>${top.map(t => `<tr><td class="pq">${t.perda.toFixed(1).replace(".", ",")}</td><td><b>${esc(t.nome)}</b><div class="tiny">incidência ${t.inc.toFixed(2).replace(".", ",")}% · acerto ${pct(t.acc)} (${fmtInt(t.nAcc)} q) ${chip(t.tr)}</div></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Sem dados nos temas desta prova.</p>`}</div>`;
    });
    h += `</div><h2>Desempenho</h2>` + V.overview(r.perf, window.MODEL.analyzeOverview(r.perf, cfg), state);
    return h;
  }

  window.AV = { auth, vazio, lancar, conta, mestre, mestreAluno, resumoAluno };
})();
