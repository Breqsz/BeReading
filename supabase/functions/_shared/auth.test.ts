// supabase/functions/_shared/auth.test.ts
// Testa o módulo REAL (import de ./auth.ts), não uma cópia da lógica — ver BER-35.
import {
  assertEquals,
  assertRejects,
  assertThrows,
} from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  assertInternalCaller,
  AuthError,
  extractBearer,
  type GetUserFn,
  isInternalCaller,
  resolveUserId,
} from './auth.ts';

const VALID_TOKEN = 'jwt-do-usuario';
const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

/** getUser falso: reconhece um único token e devolve um único usuário. */
const fakeGetUser: GetUserFn = (token) =>
  Promise.resolve(
    token === VALID_TOKEN
      ? { data: { user: { id: USER_ID } }, error: null }
      : { data: { user: null }, error: new Error('invalid token') },
  );

// --- extractBearer ---

Deno.test('extractBearer: extrai o token de um header Bearer', () => {
  assertEquals(extractBearer('Bearer abc.def.ghi'), 'abc.def.ghi');
});

Deno.test('extractBearer: aceita "bearer" minúsculo', () => {
  assertEquals(extractBearer('bearer abc'), 'abc');
});

Deno.test('extractBearer: devolve null para header ausente ou malformado', () => {
  assertEquals(extractBearer(null), null);
  assertEquals(extractBearer(''), null);
  assertEquals(extractBearer('abc.def.ghi'), null);
  assertEquals(extractBearer('Bearer '), null);
});

// --- resolveUserId (BER-30) ---

Deno.test('resolveUserId: deriva o user do JWT e IGNORA o user_id do corpo', async () => {
  // O app manda user_id no corpo; o servidor não pode confiar nele.
  const id = await resolveUserId(`Bearer ${VALID_TOKEN}`, USER_ID, fakeGetUser);
  assertEquals(id, USER_ID);
});

Deno.test('resolveUserId: funciona sem user_id no corpo', async () => {
  const id = await resolveUserId(`Bearer ${VALID_TOKEN}`, undefined, fakeGetUser);
  assertEquals(id, USER_ID);
});

Deno.test('resolveUserId: 403 quando o corpo aponta OUTRO usuário (o IDOR)', async () => {
  const err = await assertRejects(
    () => resolveUserId(`Bearer ${VALID_TOKEN}`, OTHER_USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 403);
});

Deno.test('resolveUserId: 401 sem header Authorization', async () => {
  const err = await assertRejects(
    () => resolveUserId(null, USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('resolveUserId: 401 com token inválido ou expirado', async () => {
  const err = await assertRejects(
    () => resolveUserId('Bearer token-podre', USER_ID, fakeGetUser),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('resolveUserId: 401 quando o getUser responde sem usuário', async () => {
  const semUsuario: GetUserFn = () =>
    Promise.resolve({ data: { user: null }, error: null });
  const err = await assertRejects(
    () => resolveUserId(`Bearer ${VALID_TOKEN}`, null, semUsuario),
    AuthError,
  );
  assertEquals(err.status, 401);
});

// --- Chamador interno: isInternalCaller / assertInternalCaller (BER-30, BER-69, BER-76) ---

/** Headers de uma requisição, sem precisar montar um Request inteiro. */
const headers = (values: Record<string, string>) => new Headers(values);

const LEGACY_KEY = 'eyJ.service-role.legado';
const SECRET_KEY = 'sb_secret_chave-nova';
const SERVER_KEYS = [SECRET_KEY, LEGACY_KEY];

Deno.test('isInternalCaller: aceita a service_role legada no Authorization Bearer', () => {
  assertEquals(isInternalCaller(headers({ Authorization: `Bearer ${LEGACY_KEY}` }), SERVER_KEYS), true);
});

Deno.test('isInternalCaller: aceita a secret key nova no header apikey (BER-76)', () => {
  assertEquals(isInternalCaller(headers({ apikey: SECRET_KEY }), SERVER_KEYS), true);
});

Deno.test('isInternalCaller: a requisição do app não passa (publishable no apikey, JWT do usuário no Bearer)', () => {
  const app = headers({ apikey: 'sb_publishable_do-app', Authorization: 'Bearer jwt.de.usuario' });
  assertEquals(isInternalCaller(app, SERVER_KEYS), false);
});

Deno.test('isInternalCaller: recusa chave errada e headers ausentes', () => {
  assertEquals(isInternalCaller(headers({ apikey: 'sb_secret_outra' }), SERVER_KEYS), false);
  assertEquals(isInternalCaller(headers({ Authorization: 'Bearer outra-chave' }), SERVER_KEYS), false);
  assertEquals(isInternalCaller(headers({}), SERVER_KEYS), false);
});

Deno.test('isInternalCaller: falha FECHADA — sem chave configurada, ninguém é interno', () => {
  // Se a env sumir do deploy, o caminho interno não pode virar porta aberta. Um
  // `apikey` vazio também não pode casar com um slot vazio da lista.
  assertEquals(isInternalCaller(headers({ Authorization: 'Bearer qualquer' }), [undefined, '']), false);
  assertEquals(isInternalCaller(headers({ apikey: '' }), ['', undefined]), false);
  assertEquals(isInternalCaller(headers({ apikey: 'qualquer' }), []), false);
});

Deno.test('assertInternalCaller: aceita qualquer uma das chaves configuradas, em qualquer dos dois headers', () => {
  const comCron = [...SERVER_KEYS, 'cron-secret'];
  assertInternalCaller(headers({ Authorization: `Bearer ${LEGACY_KEY}` }), comCron);
  assertInternalCaller(headers({ apikey: SECRET_KEY }), comCron);
  assertInternalCaller(headers({ Authorization: 'Bearer cron-secret' }), comCron);
});

Deno.test('assertInternalCaller: recusa com 401 chave fora da lista', () => {
  const err = assertThrows(
    () => assertInternalCaller(headers({ Authorization: 'Bearer anon-key' }), SERVER_KEYS),
    AuthError,
  );
  assertEquals(err.status, 401);
});

Deno.test('assertInternalCaller: falha FECHADA quando nenhuma chave está configurada', () => {
  // O CRON_SECRET é opcional no deploy, e a secret key nova pode ainda não existir:
  // um slot vazio nunca pode virar porta aberta.
  assertThrows(() => assertInternalCaller(headers({ Authorization: 'Bearer qualquer' }), [undefined, '']), AuthError);
  assertThrows(() => assertInternalCaller(headers({ Authorization: 'Bearer qualquer' }), [null]), AuthError);
  assertThrows(() => assertInternalCaller(headers({ Authorization: 'Bearer qualquer' }), []), AuthError);
});
