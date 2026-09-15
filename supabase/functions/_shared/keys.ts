// supabase/functions/_shared/keys.ts
// Qual chave de servidor as Edge Functions usam (BER-76).
//
// A `SUPABASE_SERVICE_ROLE_KEY` injetada é o JWT service_role legado que passou meses
// em texto puro no cron (BER-33) e continua válido até 2036. A troca é pela secret
// key nova (`sb_secret_…`), que a plataforma injeta em `SUPABASE_SECRET_KEYS` como
// JSON indexado pelo nome da chave (`default`). As chaves legadas param de funcionar
// no fim de 2026, então a migração é obrigatória.
//
// Durante a transição, as duas convivem: o cliente do banco e as chamadas entre
// functions preferem a nova, e as travas de chamada interna aceitam qualquer uma. O
// caminho legado sai quando as chaves legadas forem desativadas no painel (ver BER-76).

export type EnvGetter = (name: string) => string | undefined;

/** A secret key `default` de `SUPABASE_SECRET_KEYS`, ou `undefined` se ausente ou malformada. */
export function readSecretKey(getEnv: EnvGetter): string | undefined {
  const raw = getEnv('SUPABASE_SECRET_KEYS');
  if (!raw) return undefined;
  try {
    const key = (JSON.parse(raw) as Record<string, unknown> | null)?.default;
    return typeof key === 'string' && key.length > 0 ? key : undefined;
  } catch {
    return undefined;
  }
}

/** Chave do cliente do banco: a secret key nova; na falta dela, a service_role legada. */
export function serviceKey(getEnv: EnvGetter): string | undefined {
  return readSecretKey(getEnv) ?? (getEnv('SUPABASE_SERVICE_ROLE_KEY') || undefined);
}

/**
 * Headers de autenticação para uma Edge Function chamar outra. A secret key vai no
 * `apikey` porque o gateway das functions recusa `sb_secret_…` no `Authorization`
 * ("Invalid JWT") antes de o código rodar. Sem ela, a service_role legada no `Bearer`.
 */
export function internalCallHeaders(getEnv: EnvGetter): Record<string, string> {
  const secret = readSecretKey(getEnv);
  if (secret) return { apikey: secret };
  const legacy = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  return legacy ? { Authorization: `Bearer ${legacy}` } : {};
}

/** Chaves que identificam outra Edge Function como chamador interno. */
export function internalCallerKeys(getEnv: EnvGetter): (string | undefined)[] {
  return [readSecretKey(getEnv), getEnv('SUPABASE_SERVICE_ROLE_KEY')];
}
