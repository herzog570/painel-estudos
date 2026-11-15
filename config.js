/*
 * Configuração do painel.
 * Fontes primárias: arquivos .md na pasta acima de /app.
 *   desempenho_<fonte>_<AAAA-MM-DD>.md    -> guia "Visão geral"
 *   incidencia_<prova>_<fonte>_<AAAA-MM-DD>.md -> uma guia por prova (ex.: incidencia_susba_...)
 * Para uma nova prova: salve um novo incidencia_<slug>_... .md no mesmo formato
 * e (opcional) adicione o slug abaixo com o número de questões e observações.
 */
window.DASH_CONFIG = {
  provas: {
    susba: {
      nome: "SUS-BA",
      titulo: "SUS Bahia (CEREM-BA)",
      data: "2026-11-29",     // data da prova (AAAA-MM-DD): usada no planejador
      questoes: 75,
      observacoes: [
        "Formato: 25 situações-problema × 3 questões (45 objetivas + 30 de resposta curta).",
        "O banco da Estratégia tem ~45 questões/ano em 2021–2026 (contra 75 na prova): hipótese de que as de resposta curta não estejam no banco — não confirmado.",
        "Casos clínicos em blocos de 3 questões: o n efetivo de casos é ~1/3 do n de questões.",
        "% de acertos da plataforma é arredondado para inteiro (erro de ~±0,5 p.p.).",
        "Medicina Legal tem 0 questões na taxonomia da Estratégia para esta banca (o guia IPM aponta 17 — classificação diferente)."
      ]
    },
    sussp: {
      nome: "SUS-SP",
      titulo: "SUS São Paulo (SES-SP · banca Vunesp)",
      data: "2026-12-13",
      questoes: 100,
      observacoes: [
        "Prova do SUS-SP 2027: 13/12/2026, objetiva, etapa única, banca Vunesp.",
        "Banco da Estratégia completo: 100 questões por ano de 2010 a 2026. Ciclo recente adotado: 2021–2026 (600 questões).",
        "A banca mudou no período (Vunesp em 2021, Quadrix em 2022); a marcação de banca no banco da Estratégia é incompleta, então não foi possível separar os anos por banca.",
        "A Estratégia classifica gastro e hepato cirúrgicas em Clínica Médica (Gastroenterologia/Hepatologia): por isso Clínica Médica aparece com ~36% e Cirurgia com ~14%.",
        "Guias Medway e MedCof usados só como validação: ver validacao_sussp_guias_2026-11-14.md."
      ]
    }
  },
  provaPadrao: { questoes: 100, observacoes: [] },

  // Regras definidas na conversa
  regras: {
    nMinDesempenho: 20,       // abaixo disso: acerto com baixa confiança
    nMinTendencia: 20,        // n mínimo nos 90 dias para avaliar tendência
    zSinal: 2,                // |Δ| > 2 EP  -> tendência significativa
    zFraco: 1,                // |Δ| > 1 EP  -> sinal fraco
    nMinIncidenciaRecente: 5, // n recente < 5 -> incidência instável
    subTreino: 0.5,           // volume 90d / incidência < 0,5 -> sub-treino
    sobreTreino: 2,           // > 2 -> sobre-treino
    pMinVolume: 1.5           // só avalia sub/sobre-treino se incidência estimada >= 1,5%
  },

  // Planejador do ciclo de 5 dias (1 bloco de grandes áreas por dia)
  planejador: {
    blocos: [
      { nome: "Clínica Médica", areas: ["Clínica Médica", "Outros"] },   // Outros = Psiquiatria, Ortopedia, ORL...
      { nome: "Cirurgia", areas: ["Cirurgia"] },
      { nome: "Pediatria", areas: ["Pediatria"] },
      { nome: "Preventiva", areas: ["Medicina Preventiva"] },
      { nome: "GO", areas: ["Ginecologia", "Obstetrícia"] }
    ],
    questoesPadrao: 60,   // média de questões/dia do ciclo (total = 5 × este valor; você ajusta cada dia na tela)
    minQuestoesDia: 40,   // limites da divisão sugerida entre os dias
    maxQuestoesDia: 110,
    pesoMaxPrior: 50,     // o histórico de 2 anos vale no máximo como 50 questões ao combinar com a semana
    zExploracao: 1,       // bônus de incerteza: 1 erro-padrão (temas com pouca amostra sobem)
    minSubtemas: 2,
    maxSubtemas: 5,
    coberturaAlvo: 0.8,   // inclui subtemas até cobrir 80% da prioridade do bloco
    minQuestoesSubtema: 8,
    incMinima: 0.3        // ignora temas com incidência estimada < 0,3%
  }
};
