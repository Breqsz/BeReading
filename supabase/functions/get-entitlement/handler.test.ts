// supabase/functions/get-entitlement/handler.test.ts
// BER-58 / BER-61: o que o app recebe sobre plano, limites e uso.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  Deno.env.delete('FREE_MAX_ACTIVE_BOOKS');
  Deno.env.delete('FREE_MONTHLY_QUIZ_CHAPTERS');
}

function request(token: string | null = TOKEN): Request {
  return new Request('http://localhost/get-entitlement', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function readerTables() {
  const now = new Date().toISOString();
  return {
    student_books: [
      { user_id: USER_ID, book_id: 'book-1', status: 'reading' },
      { user_id: USER_ID, book_id: 'book-2', status: 'finished' },
      { user_id: USER_ID, book_id: 'book-3', status: 'dropped' },
      { user_id: 'outro', book_id: 'book-4', status: 'reading' },
    ],
    questions: [
      { id: 'q1', chapter_id: 'ch-1' },
      { id: 'q2', chapter_id: 'ch-1' },
      { id: 'q3', chapter_id: 'ch-2' },
    ],
    answers: [
      { id: 'a1', user_id: USER_ID, question_id: 'q1', answered_at: now },
      { id: 'a2', user_id: USER_ID, question_id: 'q2', answered_at: now },
      { id: 'a3', user_id: USER_ID, question_id: 'q3', answered_at: now },
      { id: 'a4', user_id: 'outro', question_id: 'q3', answered_at: now },
    ],
    subscriptions: [] as Record<string, unknown>[],
  };
}

Deno.test('get-entitlement: leitor gratuito recebe limites e uso — só livros em leitura e capítulos dele contam', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: readerTables() });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request());
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.plan, 'free');
    assertEquals(json.data.subscription, null);
    assertEquals(json.data.limits, { max_active_books: 2, monthly_quiz_chapters: 4 });
    assertEquals(json.data.usage, { active_books: 1, quiz_chapters_this_month: 2 });
    assertEquals(json.data.started_chapter_ids.sort(), ['ch-1', 'ch-2']);
    assertEquals(json.data.premium_plan.price_cents, 2490);
  } finally {
    await fake.close();
  }
});

Deno.test('get-entitlement: limites refletem as env vars', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables: readerTables() });
  withEnv(fake.url);
  Deno.env.set('FREE_MAX_ACTIVE_BOOKS', '1');
  Deno.env.set('FREE_MONTHLY_QUIZ_CHAPTERS', 'unlimited');

  try {
    const { handler } = await import('./index.ts');
    const json = await (await handler(request())).json();
    assertEquals(json.data.limits, { max_active_books: 1, monthly_quiz_chapters: null });
  } finally {
    Deno.env.delete('FREE_MAX_ACTIVE_BOOKS');
    Deno.env.delete('FREE_MONTHLY_QUIZ_CHAPTERS');
    await fake.close();
  }
});

Deno.test('get-entitlement: Premium recebe limites nulos e os dados da assinatura', async () => {
  const tables = readerTables();
  const periodEnd = new Date(Date.now() + 10 * 86400000).toISOString();
  tables.subscriptions = [{
    user_id: USER_ID,
    plan_id: 'premium_monthly',
    status: 'active',
    provider: 'mock',
    current_period_start: new Date(Date.now() - 86400000).toISOString(),
    current_period_end: periodEnd,
    cancel_at_period_end: true,
  }];
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const json = await (await handler(request())).json();

    assertEquals(json.data.plan, 'premium');
    assertEquals(json.data.limits, { max_active_books: null, monthly_quiz_chapters: null });
    // A tela de planos compara com o gratuito mesmo para quem já é Premium.
    assertEquals(json.data.free_limits, { max_active_books: 2, monthly_quiz_chapters: 4 });
    assertEquals(json.data.subscription, {
      plan_id: 'premium_monthly',
      status: 'active',
      provider: 'mock',
      current_period_end: periodEnd,
      cancel_at_period_end: true,
    });
  } finally {
    await fake.close();
  }
});

Deno.test('get-entitlement: assinatura vencida volta a ser plano gratuito', async () => {
  const tables = readerTables();
  tables.subscriptions = [{
    user_id: USER_ID,
    plan_id: 'premium_monthly',
    status: 'active',
    provider: 'mock',
    current_period_start: new Date(Date.now() - 40 * 86400000).toISOString(),
    current_period_end: new Date(Date.now() - 86400000).toISOString(),
    cancel_at_period_end: false,
  }];
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } }, tables });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const json = await (await handler(request())).json();
    assertEquals(json.data.plan, 'free');
    assertEquals(json.data.limits.max_active_books, 2);
  } finally {
    await fake.close();
  }
});

Deno.test('get-entitlement: sem Authorization devolve 401', async () => {
  const fake = startFakeSupabase({ tables: readerTables() });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    assertEquals((await handler(request(null))).status, 401);
  } finally {
    await fake.close();
  }
});
