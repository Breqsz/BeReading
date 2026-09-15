// supabase/functions/_shared/supabase-client.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serviceKey } from './keys.ts';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  // BER-76: secret key nova quando existe; a service_role legada só na transição.
  // O cliente do banco pode mandá-la no `Authorization` — a API REST aceita a
  // chave nova ali (verificado com a publishable em 15/09/2026); só o gateway das
  // Edge Functions recusa.
  const key = serviceKey((name) => Deno.env.get(name));
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or server key (SUPABASE_SECRET_KEYS / SUPABASE_SERVICE_ROLE_KEY) env vars');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
