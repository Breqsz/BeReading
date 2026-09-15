// supabase/functions/retry-pending-quizzes/callers.test.ts
// Testa o módulo REAL (import de ./callers.ts), não uma cópia — ver BER-35.
import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { acceptedCallerKeys } from './callers.ts';
import { assertInternalCaller, AuthError } from '../_shared/auth.ts';
import { internalCallerKeys } from '../_shared/keys.ts';

const envFrom = (vars: Record<string, string>) => (name: string) => vars[name];
const bearer = (token: string) => new Headers({ Authorization: `Bearer ${token}` });

const ENV = envFrom({
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_nova' }),
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  CRON_SECRET: 'cron-secret',
});

Deno.test('acceptedCallerKeys: secret key nova, service_role legada e CRON_SECRET', () => {
  assertEquals(acceptedCallerKeys(ENV), ['sb_secret_nova', 'service-key', 'cron-secret']);
});

Deno.test('retry aceita o CRON_SECRET que o pg_cron manda (BER-69)', () => {
  assertInternalCaller(bearer('cron-secret'), acceptedCallerKeys(ENV));
});

Deno.test('retry segue aceitando a service_role legada (chamada de outra function na transição)', () => {
  assertInternalCaller(bearer('service-key'), acceptedCallerKeys(ENV));
});

Deno.test('retry aceita a secret key nova no header apikey (BER-76)', () => {
  assertInternalCaller(new Headers({ apikey: 'sb_secret_nova' }), acceptedCallerKeys(ENV));
});

Deno.test('sem CRON_SECRET nem secret key no deploy, o retry aceita só a service_role', () => {
  const soLegada = envFrom({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' });
  assertInternalCaller(bearer('service-key'), acceptedCallerKeys(soLegada));
  assertThrows(() => assertInternalCaller(bearer('cron-secret'), acceptedCallerKeys(soLegada)), AuthError);
});

Deno.test('um JWT qualquer que não seja uma das chaves configuradas não passa', () => {
  assertThrows(
    () => assertInternalCaller(bearer('eyJ.outro.jwt'), acceptedCallerKeys(ENV)),
    AuthError,
  );
});

Deno.test('o CRON_SECRET não abre as outras funções internas', () => {
  // generate-questions e award-badges usam só as chaves de servidor.
  assertThrows(() => assertInternalCaller(bearer('cron-secret'), internalCallerKeys(ENV)), AuthError);
});
