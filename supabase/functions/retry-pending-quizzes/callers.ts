// supabase/functions/retry-pending-quizzes/callers.ts
// Quem pode chamar o retry (BER-69 / BER-33), isolado para o teste exercitar o
// código real (BER-35).
//
// Duas credenciais, porque são dois chamadores:
//   - SUPABASE_SERVICE_ROLE_KEY: outra function, ou alguém operando à mão;
//   - CRON_SECRET: o pg_cron, que lê o valor do Vault (runbooks/ber-33-cron-vault.sql).
//
// O CRON_SECRET vale SÓ aqui. generate-questions e award-badges continuam aceitando
// apenas a service_role: vazar o segredo do cron dá, no máximo, um retry a mais.

export type EnvGetter = (name: string) => string | undefined;

export function acceptedCallerKeys(getEnv: EnvGetter): (string | undefined)[] {
  return [getEnv('SUPABASE_SERVICE_ROLE_KEY'), getEnv('CRON_SECRET')];
}
