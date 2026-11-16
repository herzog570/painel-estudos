/* Acesso ao Supabase (login + banco). Toda chamada lança Error com mensagem em português.
   A chave abaixo é a publicável: a proteção dos dados está nas regras (RLS) do banco. */
(function () {
  "use strict";
  if (window.API) return;                              // permite substituir em testes
  const B = (window.DASH_CONFIG || {}).backend || {};
  if (!window.supabase || !B.url || !B.key) { window.API = null; return; }
  const sb = window.supabase.createClient(B.url, B.key);
  const aqui = () => location.origin + location.pathname;

  const TRAD = [
    [/invalid login credentials/i, "E-mail ou senha incorretos."],
    [/email not confirmed/i, "Confirme seu e-mail pelo link que enviamos antes de entrar."],
    [/already registered|already been registered/i, "Este e-mail já tem conta. Use Entrar ou Esqueci a senha."],
    [/password should be at least/i, "A senha precisa ter pelo menos 8 caracteres."],
    [/rate limit|too many/i, "Muitas tentativas. Aguarde alguns minutos e tente de novo."],
    [/failed to fetch|networkerror|load failed/i, "Sem conexão com o servidor. Verifique a internet."],
    [/row-level security|permission denied/i, "Sua conta não tem permissão para isso."]
  ];
  function erro(e) {
    const m = (e && (e.message || e.error_description)) || String(e);
    const t = TRAD.find(([rx]) => rx.test(m));
    const out = new Error(t ? t[1] : m);
    out.rede = /failed to fetch|networkerror|load failed/i.test(m);
    return out;
  }
  async function ok(p) { let r; try { r = await p; } catch (e) { throw erro(e); } if (r.error) throw erro(r.error); return r.data; }

  window.API = {
    onAuth(cb) { sb.auth.onAuthStateChange((ev, s) => setTimeout(() => cb(ev, s), 0)); },
    async session() { return (await ok(sb.auth.getSession())).session; },
    signIn: (email, password) => ok(sb.auth.signInWithPassword({ email, password })),
    signUp: (nome, email, password) => ok(sb.auth.signUp({ email, password, options: { data: { nome }, emailRedirectTo: aqui() } })),
    signOut: () => ok(sb.auth.signOut()),
    recover: email => ok(sb.auth.resetPasswordForEmail(email, { redirectTo: aqui() })),
    setPassword: password => ok(sb.auth.updateUser({ password })),

    myProfile: uid => ok(sb.from("profiles").select("*").eq("id", uid).maybeSingle()),
    updateProfile: (id, patch) => ok(sb.from("profiles").update(patch).eq("id", id).select().maybeSingle()),
    profiles: () => ok(sb.from("profiles").select("*").order("criado_em", { ascending: true })),

    /* Lançamentos: de um usuário (uid) ou de todos (uid = null, só o mestre recebe). Paginado de 1000 em 1000. */
    async rows(uid) {
      const out = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from("lancamentos").select("id,user_id,data,area,tema,questoes,acertos,origem").order("data", { ascending: false }).order("id", { ascending: false }).range(from, from + 999);
        if (uid) q = q.eq("user_id", uid);
        const page = await ok(q);
        out.push(...page);
        if (page.length < 1000) break;
      }
      return out;
    },
    addRows: rows => ok(sb.from("lancamentos").insert(rows).select("id,user_id,data,area,tema,questoes,acertos,origem")),
    delRow: id => ok(sb.from("lancamentos").delete().eq("id", id))
  };
})();
