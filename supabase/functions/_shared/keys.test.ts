// supabase/functions/_shared/keys.test.ts
// Testa o módulo REAL (import de ./keys.ts), não uma cópia — ver BER-35.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { internalCallerKeys, readSecretKey, serviceKey } from './keys.ts';

const envFrom = (vars: Record<string, string>) => (name: string) => vars[name];

Deno.test('readSecretKey: lê a chave default do JSON de SUPABASE_SECRET_KEYS', () => {
  const env = envFrom({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_x', billing: 'sb_secret_y' }) });
  assertEquals(readSecretKey(env), 'sb_secret_x');
});

Deno.test('readSecretKey: ausente, JSON inválido, sem default ou default vazio viram undefined', () => {
  assertEquals(readSecretKey(envFrom({})), undefined);
  assertEquals(readSecretKey(envFrom({ SUPABASE_SECRET_KEYS: 'não é json' })), undefined);
  assertEquals(readSecretKey(envFrom({ SUPABASE_SECRET_KEYS: JSON.stringify({ billing: 'sb_secret_y' }) })), undefined);
  assertEquals(readSecretKey(envFrom({ SUPABASE_SECRET_KEYS: JSON.stringify({ default: '' }) })), undefined);
  assertEquals(readSecretKey(envFrom({ SUPABASE_SECRET_KEYS: 'null' })), undefined);
});

Deno.test('serviceKey: prefere a secret key nova à service_role legada (BER-76)', () => {
  const env = envFrom({
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_x' }),
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legado',
  });
  assertEquals(serviceKey(env), 'sb_secret_x');
});

Deno.test('serviceKey: sem a secret key, cai na service_role legada; sem nenhuma, undefined', () => {
  assertEquals(serviceKey(envFrom({ SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legado' })), 'eyJ.legado');
  assertEquals(serviceKey(envFrom({ SUPABASE_SERVICE_ROLE_KEY: '' })), undefined);
  assertEquals(serviceKey(envFrom({})), undefined);
});

Deno.test('internalCallerKeys: a secret key nova e a service_role legada, nessa ordem', () => {
  const env = envFrom({
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_x' }),
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ.legado',
  });
  assertEquals(internalCallerKeys(env), ['sb_secret_x', 'eyJ.legado']);
});
