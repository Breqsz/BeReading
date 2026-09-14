// supabase/functions/billing-mock/handler.test.ts
// BER-61: cobrança simulada — assinar, cancelar, retomar, e desligar pelo BILLING_MODE.
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';

const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-teste');
  Deno.env.delete('BILLING_MODE');
}

function request(body: unknown, token: string | null = TOKEN): Request {
  return new Request('http://localhost/billing-mock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function activeSubscription(extra: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    plan_id: 'premium_monthly',
    status: 'active',
    provider: 'mock',
    current_period_start: new Date(Date.now() - 86400000).toISOString(),
    current_period_end: new Date(Date.now() + 29 * 86400000).toISOString(),
    cancel_at_period_end: false,
    ...extra,
  };
}

Deno.test('billing-mock: assinar cria assinatura mock ativa de um mês e o leitor vira Premium', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [], student_books: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const before = Date.now();
    const res = await handler(request({ action: 'subscribe', plan_id: 'premium_monthly' }));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.plan, 'premium');
    assertEquals(json.data.limits, { max_active_books: null, monthly_quiz_chapters: null });

    assertEquals(fake.tables.subscriptions.length, 1);
    const sub = fake.tables.subscriptions[0];
    assertEquals(sub.provider, 'mock');
    assertEquals(sub.status, 'active');
    assertEquals(sub.cancel_at_period_end, false);
    const days = (Date.parse(sub.current_period_end as string) - before) / 86400000;
    assert(days >= 28 && days <= 31.1, `período de ${days} dias`);
  } finally {
    await fake.close();
  }
});

Deno.test('billing-mock: assinar de novo quem já é Premium não cria outra assinatura', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [activeSubscription()], student_books: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const periodEnd = fake.tables.subscriptions[0].current_period_end;
    const res = await handler(request({ action: 'subscribe' }));

    assertEquals(res.status, 200);
    assertEquals(fake.tables.subscriptions.length, 1);
    assertEquals(fake.tables.subscriptions[0].current_period_end, periodEnd);
  } finally {
    await fake.close();
  }
});

Deno.test('billing-mock: cancelar mantém o Premium até o fim do período; retomar desfaz', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [activeSubscription()], student_books: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');

    const cancel = await handler(request({ action: 'cancel' }));
    const canceled = await cancel.json();
    assertEquals(cancel.status, 200);
    assertEquals(canceled.data.plan, 'premium');
    assertEquals(canceled.data.subscription.cancel_at_period_end, true);

    const resume = await handler(request({ action: 'resume' }));
    const resumed = await resume.json();
    assertEquals(resume.status, 200);
    assertEquals(resumed.data.subscription.cancel_at_period_end, false);
  } finally {
    await fake.close();
  }
});

Deno.test('billing-mock: cancelar sem assinatura ativa devolve 409', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [], student_books: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'cancel' }));
    assertEquals(res.status, 409);
  } finally {
    await fake.close();
  }
});

Deno.test('billing-mock: com BILLING_MODE diferente de mock, recusa tudo e não grava nada', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [] },
  });
  withEnv(fake.url);
  Deno.env.set('BILLING_MODE', 'live');

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ action: 'subscribe' }));
    assertEquals(res.status, 403);
    assertEquals(fake.tables.subscriptions.length, 0);
  } finally {
    Deno.env.delete('BILLING_MODE');
    await fake.close();
  }
});

Deno.test('billing-mock: sem Authorization devolve 401; plano desconhecido devolve 400', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { subscriptions: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    assertEquals((await handler(request({ action: 'subscribe' }, null))).status, 401);
    assertEquals((await handler(request({ action: 'subscribe', plan_id: 'vitalicio' }))).status, 400);
    assertEquals(fake.tables.subscriptions.length, 0);
  } finally {
    await fake.close();
  }
});
