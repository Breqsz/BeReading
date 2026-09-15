// supabase/functions/retry-pending-quizzes/callers.ts
// Quem pode chamar o retry (BER-69 / BER-33), isolado para o teste exercitar o
// código real (BER-35).
//
// Dois tipos de chamador:
//   - outra function, ou alguém operando à mão: uma chave de servidor — a secret key
//     nova (`SUPABASE_SECRET_KEYS`) ou, na transição, a service_role legada (BER-76);
//   - o pg_cron: o CRON_SECRET, que ele lê do Vault (runbooks/ber-33-cron-vault.sql).
//
// O CRON_SECRET vale SÓ aqui. generate-questions e award-badges continuam aceitando
// apenas as chaves de servidor: vazar o segredo do cron dá, no máximo, um retry a mais.
import { type EnvGetter, internalCallerKeys } from '../_shared/keys.ts';

export function acceptedCallerKeys(getEnv: EnvGetter): (string | undefined)[] {
  return [...internalCallerKeys(getEnv), getEnv('CRON_SECRET')];
}
