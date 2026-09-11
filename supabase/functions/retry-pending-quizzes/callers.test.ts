// supabase/functions/retry-pending-quizzes/callers.test.ts
// Testa o módulo REAL (import de ./callers.ts), não uma cópia — ver BER-35.
import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { acceptedCallerKeys } from './callers.ts';
import { assertInternalCaller, assertServiceRole, AuthError } from '../_shared/auth.ts';

const envFrom = (vars: Record<string, string>) => (name: string) => vars[name];

const ENV = envFrom({
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  CRON_SECRET: 'cron-secret',
});

Deno.test('acceptedCallerKeys: service_role e CRON_SECRET', () => {
  assertEquals(acceptedCallerKeys(ENV), ['service-key', 'cron-secret']);
});

Deno.test('retry aceita o CRON_SECRET que o pg_cron manda (BER-69)', () => {
  assertInternalCaller('Bearer cron-secret', acceptedCallerKeys(ENV));
});

Deno.test('retry segue aceitando a service_role (chamada manual ou de outra function)', () => {
  assertInternalCaller('Bearer service-key', acceptedCallerKeys(ENV));
});

Deno.test('sem CRON_SECRET no deploy, o retry aceita só a service_role', () => {
  const semCron = envFrom({ SUPABASE_SERVICE_ROLE_KEY: 'service-key' });
  assertInternalCaller('Bearer service-key', acceptedCallerKeys(semCron));
  assertThrows(
    () => assertInternalCaller('Bearer cron-secret', acceptedCallerKeys(semCron)),
    AuthError,
  );
});

Deno.test('o JWT service_role legado que estava no cron não passa (BER-33)', () => {
  // Era o que o cron mandava em texto puro; a trava compara com as chaves do
  // ambiente, e ele não é nenhuma delas.
  assertThrows(
    () => assertInternalCaller('Bearer eyJ.legado.service-role', acceptedCallerKeys(ENV)),
    AuthError,
  );
});

Deno.test('o CRON_SECRET não abre as outras funções internas', () => {
  // generate-questions e award-badges usam assertServiceRole com a chave única.
  assertThrows(() => assertServiceRole('Bearer cron-secret', 'service-key'), AuthError);
});
