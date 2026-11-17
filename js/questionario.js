/* Questionário do aluno: perguntas, regras de repetição, meta → planejador e telas (aluno e mestre). */
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const FAIXAS = ["Menos de 100", "100 a 199", "200 a 349", "350 a 500", "Mais de 500"];

  /* muda: true = volta a ser perguntada a cada INTERVALO dias. multi: true = múltipla escolha (max = limite). */
  const PERGUNTAS = [
    { id: "bancos", grupo: "Ponto de partida", t: "Quais bancos de questões ou cursos você usa hoje?", multi: true,
      op: ["Estratégia MED", "Medway", "Medcurso / Medcel", "MedCof", "Qbank"] },
    { id: "objetivo", grupo: "Ponto de partida", t: "Qual é o seu próximo objetivo?",
      op: ["Residência de acesso direto neste ciclo", "Residência de acesso direto no próximo ciclo", "R+ / área com pré-requisito", "Revalida", "USMLE"] },
    { id: "provas", grupo: "Ponto de partida", t: "Quais provas você pretende fazer?", multi: true, outroMulti: true, muda: true,
      op: ["ENAMED / ENARE", "SUS-SP", "SUS-BA", "USP-SP", "USP-RP", "UNIFESP", "UNICAMP", "Santa Casa SP", "IAMSPE", "HCPA", "AMRIGS", "UERJ", "UFRJ", "PSU-MG", "SES-DF", "SURCE (CE)"] },
    { id: "especialidade", grupo: "Ponto de partida", t: "Qual especialidade você pretende?",
      op: ["Clínica Médica e subespecialidades", "Áreas cirúrgicas", "Pediatria", "Ginecologia e Obstetrícia", "Medicina de Família / Preventiva", "Ainda não sei"] },
    { id: "semana", grupo: "Volume e tempo", t: "Quantas questões você faz por semana hoje?", op: FAIXAS, numero: true, muda: true },
    { id: "meta", grupo: "Volume e tempo", t: "Qual seria a sua meta ideal de questões por semana?", op: FAIXAS, numero: true, muda: true,
      nota: "Esta resposta define o total de questões do ciclo no Planejador." },
    { id: "horas", grupo: "Volume e tempo", t: "Quantas horas por dia você consegue estudar, em média?",
      op: ["Menos de 1 h", "1 a 2 h", "2 a 4 h", "4 a 6 h", "Mais de 6 h"], muda: true },
    { id: "trabalho", grupo: "Volume e tempo", t: "Quanto você trabalha hoje?",
      op: ["Não trabalho", "Até 20 h por semana", "20 a 40 h por semana", "Mais de 40 h ou plantões frequentes"], muda: true },
    { id: "videoaulas", grupo: "Método", t: "Você assiste videoaulas?",
      op: ["Não", "Só em temas em que vou mal", "Revisões aceleradas", "Sim, o curso completo"] },
    { id: "metodos", grupo: "Método", t: "Que outros métodos você usa?", multi: true,
      op: ["Flashcards (Anki ou similar)", "Mapas mentais", "Resumos próprios", "Caderno de erros", "Simulados ou provas na íntegra", "Nenhum outro"] },
    { id: "organizacao", grupo: "Método", t: "Como você organiza o estudo?",
      op: ["Cronograma do cursinho", "Cronograma próprio", "Planejador deste painel", "Sem plano fixo"] },
    { id: "dificuldade", grupo: "Motivação", t: "Qual é a sua maior dificuldade hoje?", multi: true, max: 2, muda: true,
      op: ["Falta de tempo", "Constância", "Saber o que priorizar", "Reter o conteúdo", "Ansiedade na prova"] },
    { id: "motivacao", grupo: "Motivação", t: "Como está a sua motivação nas últimas semanas?",
      op: ["Alta e estável", "Boa, mas oscila", "Baixa", "Perto do esgotamento"], muda: true }
  ];
  const INTERVALO = 56;                                // 8 semanas
  const ALERTA = { motivacao: ["Perto do esgotamento"] };
  const META_Q = { "Menos de 100": 75, "100 a 199": 150, "200 a 349": 275, "350 a 500": 425, "Mais de 500": 550 };

  const dia = s => new Date(String(s).slice(0, 10) + "T12:00:00");
  const br = s => String(s).slice(0, 10).split("-").reverse().join("/");
  const ordem = (a, b) => (a.respondido_em < b.respondido_em ? -1 : a.respondido_em > b.respondido_em ? 1 : (a.id || 0) - (b.id || 0));
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  /* Respostas atuais = a mais recente de cada pergunta, juntando todos os envios (do mais antigo ao mais novo). */
  function atual(lista) {
    const out = {}, quando = {};
    (lista || []).slice().sort(ordem).forEach(r => {
      Object.entries(r.respostas || {}).forEach(([k, v]) => { out[k] = v; quando[k] = r.respondido_em; });
    });
    return { respostas: out, quando };
  }

  /* O que falta: "inicial" (nunca respondeu tudo), "retorno" (8 semanas desde a última atualização das que mudam) ou null. */
  function pendencia(lista, hoje) {
    const { respostas, quando } = atual(lista);
    const faltam = PERGUNTAS.filter(q => !(q.id in respostas));
    if (faltam.length) return { tipo: "inicial", perguntas: faltam };
    const mudam = PERGUNTAS.filter(q => q.muda);
    const ult = mudam.map(q => quando[q.id]).sort()[0];
    const dias = Math.floor(((hoje ? dia(hoje) : dia(hojeISO())) - dia(ult)) / 86400000);
    if (dias >= INTERVALO) return { tipo: "retorno", perguntas: mudam, desde: ult };
    return null;
  }
  function proximaRevisao(lista) {
    const { quando } = atual(lista);
    const ult = PERGUNTAS.filter(q => q.muda).map(q => quando[q.id]).filter(Boolean).sort()[0];
    if (!ult) return null;
    const d = dia(ult); d.setDate(d.getDate() + INTERVALO);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* Texto de uma resposta: "A, B · Outro: xyz" */
  function texto(v) {
    if (!v) return "—";
    const vs = (v.v || []).filter(x => x !== "Outro");
    const outros = Array.isArray(v.outro) ? v.outro : v.outro ? [v.outro] : [];
    if (outros.length) vs.push("Outro: " + outros.join(", "));
    return vs.length ? vs.join(", ") : "—";
  }

  /* Meta semanal em questões (número) a partir da pergunta 5; null se não respondida ou ilegível. */
  function metaSemanal(lista) {
    const v = atual(lista).respostas.meta;
    if (!v) return null;
    if (v.outro) { const m = String(v.outro).replace(/\./g, "").match(/\d+/); if (m) return Math.max(25, Math.min(1000, +m[0])); }
    const f = (v.v || []).find(x => META_Q[x]);
    return f ? META_Q[f] : null;
  }
  /* Ajusta o planejador à meta: total do ciclo = meta; limites por dia mantêm a proporção do config (40/60/110). */
  function cfgComMeta(cfg, meta) {
    if (!meta) return cfg;
    const P = cfg.planejador, n = P.blocos.length, base = P.questoesPadrao;
    const padrao = meta / n;
    return Object.assign({}, cfg, { planejador: Object.assign({}, P, {
      questoesPadrao: padrao,
      minQuestoesDia: Math.max(5, Math.round(padrao * P.minQuestoesDia / base)),
      maxQuestoesDia: Math.round(padrao * P.maxQuestoesDia / base),
      minQuestoesSubtema: Math.max(4, Math.min(P.minQuestoesSubtema || 8, Math.round(padrao / 4)))
    }) });
  }

  /* Lê o formulário; devolve { respostas } ou { erro }. */
  function ler(form, perguntas) {
    const out = {};
    for (const q of perguntas) {
      const marcadas = [...form.querySelectorAll(`input[name="q-${q.id}"]:checked`)].map(i => i.value);
      const caixas = [...form.querySelectorAll(`input[name="qo-${q.id}"]`)].map(i => i.value.trim().slice(0, 200)).filter(Boolean);
      const outroTxt = caixas.join(", ");
      const temOutro = marcadas.includes("Outro");
      if (!marcadas.length) return { erro: `Responda: "${q.t}"`, id: q.id };
      if (q.max && marcadas.length > q.max) return { erro: `Marque no máximo ${q.max} opções em "${q.t}"`, id: q.id };
      if (temOutro && !outroTxt.trim()) return { erro: `Escreva a sua resposta em "Outro" na pergunta "${q.t}"`, id: q.id };
      if (temOutro && q.numero && !/\d/.test(outroTxt)) return { erro: `Em "${q.t}", escreva um número em "Outro"`, id: q.id };
      out[q.id] = { v: marcadas, outro: !temOutro ? null : q.outroMulti ? [...new Set(caixas)].slice(0, 8) : caixas[0] };
    }
    return { respostas: out };
  }

  /* "Outro" com várias caixas de texto (uma por item) e botão para acrescentar mais */
  const MAX_CAIXAS = 8;
  const caixa = (id, v, n) => `<input type="text" name="qo-${id}" maxlength="200" placeholder="nome da prova" value="${esc(v || "")}" aria-label="Outra prova ${n}">`;
  function outroMulti(q, prev, tipo, sel) {
    const vals = Array.isArray(prev.outro) ? prev.outro : prev.outro ? [prev.outro] : [];
    const lista = vals.length ? vals : [""];
    return `<div class="qz-op qz-outro qz-outro-multi"><label class="qz-outro-lbl"><input type="${tipo}" name="q-${q.id}" value="Outro" ${sel.has("Outro") ? "checked" : ""}><span>Outras provas</span></label>
      <div class="qz-caixas" data-caixas="${q.id}">${lista.map((v, i) => caixa(q.id, v, i + 1)).join("")}</div>
      <button class="link" type="button" data-act="qz-mais" data-q="${q.id}">+ Adicionar outra prova</button></div>`;
  }
  function maisCaixa(id) {
    const box = document.querySelector(`[data-caixas="${id}"]`);
    if (!box) return;
    const n = box.querySelectorAll("input").length;
    if (n >= MAX_CAIXAS) return;
    box.insertAdjacentHTML("beforeend", caixa(id, "", n + 1));
    box.lastElementChild.focus();
    if (n + 1 >= MAX_CAIXAS) { const b = document.querySelector(`[data-act="qz-mais"][data-q="${id}"]`); if (b) b.hidden = true; }
  }

  /* ---------- Aluno ---------- */
  function form(perguntas, previas, opts) {
    let g = "", h = `<form data-form="questionario" class="qz" data-tipo="${opts.tipo}" novalidate>`;
    perguntas.forEach((q, i) => {
      if (q.grupo !== g) { g = q.grupo; h += `<h3 class="qz-grupo">${esc(g)}</h3>`; }
      const prev = previas[q.id] || { v: [], outro: null }, sel = new Set(prev.v || []), tipo = q.multi ? "checkbox" : "radio";
      const dica = q.multi ? (q.max ? `até ${q.max} opções` : "marque todas que se aplicam") : "";
      h += `<fieldset class="qz-q" id="qz-${q.id}" data-q="${q.id}"${q.max ? ` data-max="${q.max}"` : ""}>
        <legend><span class="qz-n">${PERGUNTAS.indexOf(q) + 1}</span>${esc(q.t)}${dica ? ` <span class="tiny">${dica}</span>` : ""}</legend>
        ${q.nota ? `<p class="tiny">${esc(q.nota)}</p>` : ""}
        <div class="qz-ops">${q.op.map(o => `<label class="qz-op"><input type="${tipo}" name="q-${q.id}" value="${esc(o)}" ${sel.has(o) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}
          ${q.outroMulti ? outroMulti(q, prev, tipo, sel) : `<label class="qz-op qz-outro"><input type="${tipo}" name="q-${q.id}" value="Outro" ${sel.has("Outro") ? "checked" : ""}><span>Outro</span>
            <input type="text" name="qo-${q.id}" maxlength="200" placeholder="${q.numero ? "ex.: 250" : "escreva aqui"}" value="${esc(prev.outro || "")}" aria-label="Outro: ${esc(q.t)}" ${q.numero ? 'inputmode="numeric"' : ""}></label>`}</div>
      </fieldset>`;
    });
    h += `<div class="qz-acoes"><button class="btn primary" type="submit">Enviar respostas</button>
      ${opts.adiar ? `<button class="link" type="button" data-act="qz-adiar">Responder depois</button>` : ""}
      ${opts.cancelar ? `<button class="link" type="button" data-act="qz-cancelar">Cancelar</button>` : ""}</div></form>`;
    return h;
  }

  function telaAluno(lista, ui, aviso) {
    const pend = pendencia(lista), { respostas, quando } = atual(lista), meta = metaSemanal(lista);
    let h = `<section class="exam-head"><h2 class="nomargin">Questionário</h2>
      <div class="muted">Objetivos, rotina e motivação. Só você e o responsável pelo painel veem as respostas.</div></section>${aviso || ""}`;
    if (pend && pend.tipo === "inicial" && !ui.editando) {
      h += `<div class="card"><p>${pend.perguntas.length === PERGUNTAS.length ? `São ${PERGUNTAS.length} perguntas rápidas, todas de marcar. Leva uns 3 minutos.` : `Faltam ${pend.perguntas.length} perguntas para completar o questionário.`}</p>
        <p class="tiny">A cada 8 semanas voltamos a perguntar só o que muda com o tempo: provas, volume, meta, horas, trabalho, dificuldade e motivação.</p></div>`;
      return h + form(pend.perguntas, respostas, { tipo: "inicial", adiar: true });
    }
    if (pend && pend.tipo === "retorno" && !ui.editando) {
      h += `<div class="card"><p><b>Hora da revisão de 8 semanas.</b> Confira as ${pend.perguntas.length} perguntas que costumam mudar; já vêm marcadas com a sua última resposta, de ${br(pend.desde)}.</p></div>`;
      return h + form(pend.perguntas, respostas, { tipo: "retorno", adiar: true });
    }
    if (ui.editando) return h + form(PERGUNTAS, respostas, { tipo: "edicao", cancelar: true });

    const prox = proximaRevisao(lista);
    h += `<div class="card qz-status"><div><b>Respostas em dia.</b> ${prox ? `Próxima revisão em ${br(prox)}.` : ""}
        ${meta ? `<div class="tiny">Meta de ${meta} questões por semana: é o total do ciclo no Planejador.</div>` : ""}</div>
      <button class="btn" data-act="qz-editar">Atualizar respostas</button></div>`;
    h += `<div class="tbl-wrap"><table class="tbl qz-tbl"><tbody>` + PERGUNTAS.map((q, i) =>
      `<tr><td class="qz-n">${i + 1}</td><td>${esc(q.t)}</td><td><b>${esc(texto(respostas[q.id]))}</b><div class="tiny">${quando[q.id] ? "respondida em " + br(quando[q.id]) : ""}</div></td></tr>`).join("") + `</tbody></table></div>`;
    return h;
  }

  /* ---------- Mestre ---------- */
  function alertas(lista) {
    const r = atual(lista).respostas, out = [];
    Object.entries(ALERTA).forEach(([id, vals]) => { const v = r[id]; if (v && (v.v || []).some(x => vals.includes(x))) out.push(texto(v)); });
    return out;
  }
  function resumoMestre(lista) {
    if (!(lista || []).length) return { status: "nunca", motivacao: null, alerta: false, meta: null };
    const p = pendencia(lista), r = atual(lista).respostas;
    return { status: p ? (p.tipo === "inicial" ? "incompleto" : "revisao") : "em dia", motivacao: r.motivacao ? texto(r.motivacao) : null,
             alerta: alertas(lista).length > 0, meta: metaSemanal(lista), ultimo: lista.map(x => x.respondido_em).sort().pop() };
  }

  /* Bloco no detalhe do aluno: respostas atuais, relato × lançado e evolução das que mudam. */
  function blocoMestre(lista, mediaSemanalReal) {
    if (!(lista || []).length) return `<h2>Questionário</h2><p class="muted">Ainda não respondeu.</p>`;
    const { respostas, quando } = atual(lista), envios = lista.slice().sort(ordem);
    const al = alertas(lista);
    let h = `<h2>Questionário</h2>`;
    if (al.length) h += `<p class="msg erro">Atenção: motivação marcada como "${esc(al.join(", "))}".</p>`;
    const sem = respostas.semana ? texto(respostas.semana) : null;
    if (sem && mediaSemanalReal != null) h += `<p class="hint">Diz fazer <b>${esc(sem)}</b> questões por semana; lançou em média <b>${Math.round(mediaSemanalReal)}</b> nas últimas 4 semanas.</p>`;
    h += `<div class="tbl-wrap"><table class="tbl qz-tbl"><thead><tr><th></th><th>Pergunta</th><th>Resposta atual</th></tr></thead><tbody>` + PERGUNTAS.map((q, i) =>
      `<tr><td class="qz-n">${i + 1}</td><td>${esc(q.t)}</td><td><b>${esc(texto(respostas[q.id]))}</b><div class="tiny">${quando[q.id] ? br(quando[q.id]) : ""}</div></td></tr>`).join("") + `</tbody></table></div>`;
    const comHist = PERGUNTAS.filter(q => q.muda && envios.filter(e => q.id in (e.respostas || {})).length > 1);
    if (comHist.length) {
      h += `<div class="card"><div class="card-h"><h3>Evolução</h3><span class="hint">respostas a cada revisão</span></div><div class="tbl-wrap flat"><table class="tbl"><thead><tr><th>Pergunta</th>` +
        envios.map(e => `<th>${br(e.respondido_em)}</th>`).join("") + `</tr></thead><tbody>` +
        comHist.map(q => `<tr><td>${esc(q.t)}</td>${envios.map(e => `<td>${q.id in (e.respostas || {}) ? esc(texto(e.respostas[q.id])) : ""}</td>`).join("")}</tr>`).join("") + `</tbody></table></div></div>`;
    }
    return h;
  }

  window.QUEST = { PERGUNTAS, INTERVALO, maisCaixa, atual, pendencia, proximaRevisao, texto, metaSemanal, cfgComMeta, ler, telaAluno, resumoMestre, blocoMestre };
})();
