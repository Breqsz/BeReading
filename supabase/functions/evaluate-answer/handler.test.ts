// supabase/functions/evaluate-answer/handler.test.ts
// BER-49: cobertura de handler (IO, Supabase, chamada de IA, os dois caminhos —
// app e cron de reavaliação) que faltava — só o prompt/parsing tinha teste.
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { startFakeSupabase } from '../_shared/test-support/fakeSupabase.ts';
import { withFailingAIFetch, withMockedAIFetch } from '../_shared/test-support/mockAI.ts';

const SERVICE_KEY = 'service-role-key-teste';
const TOKEN = 'jwt-leitor';
const USER_ID = 'user-1';

function withEnv(url: string) {
  Deno.env.set('SUPABASE_URL', url);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
  Deno.env.set('AI_PROVIDER', 'openai');
  Deno.env.set('AI_API_KEY', 'fake-ai-key');
  Deno.env.delete('FREE_MONTHLY_QUIZ_CHAPTERS');
}

function request(body: unknown, authorization: string | null): Request {
  return new Request('http://localhost/evaluate-answer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_EVALUATION = JSON.stringify({ score: 88, feedback: 'Boa leitura do trecho, faltou aprofundar.' });

Deno.test('evaluate-answer: campos obrigatórios ausentes devolvem 400', async () => {
  const fake = startFakeSupabase({ users: { [TOKEN]: { id: USER_ID } } });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: '  ' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 400);
  } finally {
    await fake.close();
  }
});

function readerFixture(overrides: { reading_sessions?: Record<string, unknown>[] } = {}) {
  return {
    users: { [TOKEN]: { id: USER_ID } },
    tables: {
      questions: [{
        id: 'q1',
        question_text: 'O que motivou a personagem?',
        type: 'comprehension',
        chapter_id: 'ch-1',
        chapters: { end_page: 50, book_id: 'book-1', book_contents: { content_text: 'conteúdo do capítulo' } },
      }] as Record<string, unknown>[],
      answers: [] as Record<string, unknown>[],
      reading_sessions: overrides.reading_sessions ?? [{ user_id: USER_ID, book_id: 'book-1', end_page: 50 }],
    },
  };
}

Deno.test('evaluate-answer: caminho do app — avalia, salva a nota e o feedback', async () => {
  const fake = startFakeSupabase(readerFixture());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.score, 88);
    assertEquals(json.data.feedback, 'Boa leitura do trecho, faltou aprofundar.');

    assertEquals(fake.tables.answers.length, 1);
    assertEquals(fake.tables.answers[0].comprehension_score, 88);
    assertEquals(fake.tables.answers[0].evaluation_status, 'completed');
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: falha da IA marca a resposta como failed (BER-36) e não fica em silêncio (BER-39)', async () => {
  const fake = startFakeSupabase(readerFixture());
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withFailingAIFetch(
      500,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    const json = await res.json();

    // A resposta fica salva (pending -> failed); o retry cobre depois.
    assertEquals(res.status, 200);
    assertEquals(json.data.score, null);
    assertEquals(fake.tables.answers.length, 1);
    assertEquals(fake.tables.answers[0].evaluation_status, 'failed');
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: capítulo não lido até o fim devolve 403 e não salva resposta (BER-48)', async () => {
  // Leu só até a página 30; o capítulo termina na 50.
  const fake = startFakeSupabase(readerFixture({
    reading_sessions: [{ user_id: USER_ID, book_id: 'book-1', end_page: 30 }],
  }));
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`));
    const json = await res.json();

    assertEquals(res.status, 403);
    assertEquals(json.error, 'Chapter not completed');
    assertEquals(fake.tables.answers.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: responder de novo devolve 409 com a avaliação que já existe, sem sobrescrever (BER-48)', async () => {
  const fixture = readerFixture();
  fixture.tables.answers = [{
    question_id: 'q1',
    user_id: USER_ID,
    answer_text: 'primeira resposta',
    evaluation_status: 'completed',
    comprehension_score: 75,
    ai_feedback: 'Boa primeira tentativa.',
  }];
  const fake = startFakeSupabase(fixture);
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'tentando de novo' }, `Bearer ${TOKEN}`));
    const json = await res.json();

    assertEquals(res.status, 409);
    assertEquals(json.data, { score: 75, feedback: 'Boa primeira tentativa.' });
    // não sobrescreveu a resposta original
    assertEquals(fake.tables.answers.length, 1);
    assertEquals(fake.tables.answers[0].answer_text, 'primeira resposta');
  } finally {
    await fake.close();
  }
});

/** Leitor que já começou o quiz de `chapters` capítulos neste mês (fora o ch-1 do fixture). */
function readerWithStartedChapters(chapters: string[]) {
  const fixture = readerFixture();
  const now = new Date().toISOString();
  for (const ch of chapters) {
    fixture.tables.questions.push({ id: `q-${ch}`, chapter_id: ch, question_text: 'P?', type: 'comprehension' });
    fixture.tables.answers.push({
      id: `a-${ch}`,
      question_id: `q-${ch}`,
      user_id: USER_ID,
      answer_text: 'resposta antiga',
      answered_at: now,
      evaluation_status: 'completed',
    });
  }
  return fixture;
}

const PREMIUM_SUBSCRIPTION = {
  user_id: USER_ID,
  plan_id: 'premium_monthly',
  status: 'active',
  provider: 'mock',
  current_period_start: new Date(Date.now() - 86400000).toISOString(),
  current_period_end: new Date(Date.now() + 29 * 86400000).toISOString(),
  cancel_at_period_end: false,
};

Deno.test('evaluate-answer: gratuito com 4 quizzes começados no mês não abre o quinto — 402 sem gastar IA (BER-58)', async () => {
  const fake = startFakeSupabase(readerWithStartedChapters(['ch-a', 'ch-b', 'ch-c', 'ch-d']));
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withFailingAIFetch(
      500,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    const json = await res.json();

    assertEquals(res.status, 402);
    assertEquals(json.error, 'quota_exceeded');
    assertEquals(json.data.reason, 'quiz_chapters');
    assertEquals(json.data.limit, 4);
    assertEquals(json.data.used, 4);
    assertEquals(fake.tables.answers.length, 4); // nada salvo
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: o limite mensal vem da env FREE_MONTHLY_QUIZ_CHAPTERS (BER-58)', async () => {
  const fake = startFakeSupabase(readerWithStartedChapters(['ch-a', 'ch-b', 'ch-c', 'ch-d']));
  withEnv(fake.url);
  Deno.env.set('FREE_MONTHLY_QUIZ_CHAPTERS', '5');

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    assertEquals(res.status, 200);
    assertEquals(fake.tables.answers.length, 5);
  } finally {
    Deno.env.delete('FREE_MONTHLY_QUIZ_CHAPTERS');
    await fake.close();
  }
});

Deno.test('evaluate-answer: no limite, o capítulo que já foi começado continua respondível (BER-58)', async () => {
  const fixture = readerWithStartedChapters(['ch-a', 'ch-b', 'ch-c']);
  // 4º capítulo do mês é o próprio ch-1: uma pergunta dele já respondida.
  fixture.tables.questions.push({ id: 'q1-b', chapter_id: 'ch-1', question_text: 'P2?', type: 'reflection' });
  fixture.tables.answers.push({
    id: 'a-ch1', question_id: 'q1-b', user_id: USER_ID, answer_text: 'x',
    answered_at: new Date().toISOString(), evaluation_status: 'completed',
  });
  const fake = startFakeSupabase(fixture);
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    assertEquals(res.status, 200);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: Premium não tem limite de quizzes (BER-61)', async () => {
  const fixture = readerWithStartedChapters(['ch-a', 'ch-b', 'ch-c', 'ch-d']);
  const fake = startFakeSupabase({
    ...fixture,
    tables: { ...fixture.tables, subscriptions: [PREMIUM_SUBSCRIPTION] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ question_id: 'q1', user_id: USER_ID, answer_text: 'minha resposta' }, `Bearer ${TOKEN}`)),
    );
    assertEquals(res.status, 200);
    assertEquals(fake.tables.answers.length, 5);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: pergunta inexistente devolve 404 e não cria resposta', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { questions: [], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q-inexistente', user_id: USER_ID, answer_text: 'resposta' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 404);
    assertEquals(fake.tables.answers.length, 0);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: user_id do corpo diferente do JWT devolve 403 (BER-30)', async () => {
  const fake = startFakeSupabase({
    users: { [TOKEN]: { id: USER_ID } },
    tables: { questions: [{ id: 'q1', question_text: 'P?', type: 'comprehension', chapters: {} }], answers: [] },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ question_id: 'q1', user_id: 'outro-usuario', answer_text: 'resposta' }, `Bearer ${TOKEN}`));
    assertEquals(res.status, 403);
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: caminho do cron (service_role) — reavalia uma resposta pendente (BER-36)', async () => {
  const fake = startFakeSupabase({
    tables: {
      answers: [{
        id: 'a1',
        answer_text: 'minha resposta',
        evaluation_status: 'pending',
        questions: {
          question_text: 'O que motivou a personagem?',
          type: 'comprehension',
          chapters: { book_contents: { content_text: 'conteúdo do capítulo' } },
        },
      }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await withMockedAIFetch(
      VALID_EVALUATION,
      () => handler(request({ answer_id: 'a1' }, `Bearer ${SERVICE_KEY}`)),
    );
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.status, 'evaluated');
    assertEquals(fake.tables.answers[0].comprehension_score, 88);
    assertEquals(fake.tables.answers[0].evaluation_status, 'completed');
  } finally {
    await fake.close();
  }
});

Deno.test('evaluate-answer: cron não reavalia o que já está completed (corrida com o app)', async () => {
  const fake = startFakeSupabase({
    tables: {
      answers: [{ id: 'a1', answer_text: 'x', evaluation_status: 'completed', comprehension_score: 70, questions: {} }],
    },
  });
  withEnv(fake.url);

  try {
    const { handler } = await import('./index.ts');
    const res = await handler(request({ answer_id: 'a1' }, `Bearer ${SERVICE_KEY}`));
    const json = await res.json();

    assertEquals(res.status, 200);
    assertEquals(json.data.status, 'already-evaluated');
    assertEquals(fake.tables.answers[0].comprehension_score, 70); // não sobrescreveu
  } finally {
    await fake.close();
  }
});
