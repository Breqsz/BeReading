// supabase/functions/_shared/plan-rules.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import {
  addOneMonth,
  canAnswerChapter,
  canStartBook,
  DEFAULT_FREE_LIMITS,
  isPremium,
  monthWindowInSaoPaulo,
  readFreeLimits,
  summarizeQuizUsage,
  type SubscriptionRow,
} from './plan-rules.ts';

const envOf = (vars: Record<string, string>) => (key: string) => vars[key];

Deno.test('readFreeLimits: sem env, usa os defaults (2 livros, 4 quizzes/mês)', () => {
  assertEquals(readFreeLimits(envOf({})), { maxActiveBooks: 2, monthlyQuizChapters: 4 });
});

Deno.test('readFreeLimits: env var sobrescreve o default', () => {
  assertEquals(
    readFreeLimits(envOf({ FREE_MAX_ACTIVE_BOOKS: '3', FREE_MONTHLY_QUIZ_CHAPTERS: ' 10 ' })),
    { maxActiveBooks: 3, monthlyQuizChapters: 10 },
  );
});

Deno.test('readFreeLimits: "unlimited" desliga o limite; zero é limite válido', () => {
  assertEquals(
    readFreeLimits(envOf({ FREE_MAX_ACTIVE_BOOKS: 'unlimited', FREE_MONTHLY_QUIZ_CHAPTERS: '0' })),
    { maxActiveBooks: null, monthlyQuizChapters: 0 },
  );
});

Deno.test('readFreeLimits: valor inválido cai no default em vez de abrir ou travar o plano', () => {
  assertEquals(
    readFreeLimits(envOf({ FREE_MAX_ACTIVE_BOOKS: '-1', FREE_MONTHLY_QUIZ_CHAPTERS: 'quatro' })),
    DEFAULT_FREE_LIMITS,
  );
});

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

function subscription(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    plan_id: 'premium_monthly',
    status: 'active',
    provider: 'mock',
    current_period_start: '2026-09-01T00:00:00.000Z',
    current_period_end: '2026-10-01T00:00:00.000Z',
    cancel_at_period_end: false,
    ...overrides,
  };
}

Deno.test('isPremium: sem assinatura é gratuito', () => {
  assertEquals(isPremium(null, NOW), false);
});

Deno.test('isPremium: ativa dentro do período é Premium', () => {
  assertEquals(isPremium(subscription(), NOW), true);
});

Deno.test('isPremium: cancelada continua Premium até o fim do período pago', () => {
  assertEquals(isPremium(subscription({ cancel_at_period_end: true }), NOW), true);
});

Deno.test('isPremium: período vencido ou status expired não é Premium', () => {
  assertEquals(isPremium(subscription({ current_period_end: '2026-09-15T11:59:59.000Z' }), NOW), false);
  assertEquals(isPremium(subscription({ status: 'expired' }), NOW), false);
});

Deno.test('addOneMonth: mesmo dia no mês seguinte, sem pular mês quando o dia não existe', () => {
  assertEquals(addOneMonth(Date.parse('2026-09-15T12:30:00.000Z')), '2026-10-15T12:30:00.000Z');
  assertEquals(addOneMonth(Date.parse('2026-01-31T10:00:00.000Z')), '2026-02-28T10:00:00.000Z');
  assertEquals(addOneMonth(Date.parse('2026-12-15T10:00:00.000Z')), '2027-01-15T10:00:00.000Z');
});

Deno.test('monthWindowInSaoPaulo: o mês vira à meia-noite de São Paulo (03:00 UTC)', () => {
  assertEquals(monthWindowInSaoPaulo(NOW), {
    start: '2026-09-01T03:00:00.000Z',
    next: '2026-10-01T03:00:00.000Z',
  });
  // 01/10 às 01:00 UTC ainda é 30/09 em São Paulo.
  assertEquals(monthWindowInSaoPaulo(Date.parse('2026-10-01T01:00:00.000Z')).start, '2026-09-01T03:00:00.000Z');
  // Dezembro vira para janeiro do ano seguinte.
  assertEquals(monthWindowInSaoPaulo(Date.parse('2026-12-20T12:00:00.000Z')).next, '2027-01-01T03:00:00.000Z');
});

Deno.test('summarizeQuizUsage: conta o capítulo pela PRIMEIRA resposta, uma vez só', () => {
  const monthStart = '2026-09-01T03:00:00.000Z';
  const usage = summarizeQuizUsage([
    // começou em agosto, terminou em setembro: não gasta vaga de setembro
    { chapter_id: 'ch-ago', answered_at: '2026-08-30T10:00:00.000Z' },
    { chapter_id: 'ch-ago', answered_at: '2026-09-02T10:00:00.000Z' },
    // duas respostas no mesmo capítulo em setembro: conta uma vez
    { chapter_id: 'ch-set', answered_at: '2026-09-03T10:00:00.000Z' },
    { chapter_id: 'ch-set', answered_at: '2026-09-03T10:05:00.000Z' },
  ], monthStart, NOW);

  assertEquals(usage.startedChapterIds.sort(), ['ch-ago', 'ch-set']);
  assertEquals(usage.chaptersThisMonth, ['ch-set']);
});

const LIMITS = { maxActiveBooks: 2, monthlyQuizChapters: 4 };

Deno.test('canAnswerChapter: gratuito abaixo do limite pode começar um capítulo novo', () => {
  assertEquals(
    canAnswerChapter({ premium: false, limits: LIMITS, chapterId: 'novo', startedChapterIds: ['a', 'b', 'c'], chaptersThisMonth: ['a', 'b', 'c'] }),
    { allowed: true, limit: 4, used: 3 },
  );
});

Deno.test('canAnswerChapter: gratuito no limite não começa capítulo novo', () => {
  assertEquals(
    canAnswerChapter({ premium: false, limits: LIMITS, chapterId: 'novo', startedChapterIds: ['a', 'b', 'c', 'd'], chaptersThisMonth: ['a', 'b', 'c', 'd'] }),
    { allowed: false, limit: 4, used: 4 },
  );
});

Deno.test('canAnswerChapter: capítulo já começado nunca trava no meio do quiz', () => {
  const check = canAnswerChapter({ premium: false, limits: LIMITS, chapterId: 'd', startedChapterIds: ['a', 'b', 'c', 'd'], chaptersThisMonth: ['a', 'b', 'c', 'd'] });
  assertEquals(check.allowed, true);
});

Deno.test('canAnswerChapter: Premium não tem limite', () => {
  assertEquals(
    canAnswerChapter({ premium: true, limits: LIMITS, chapterId: 'novo', startedChapterIds: [], chaptersThisMonth: ['a', 'b', 'c', 'd', 'e'] }),
    { allowed: true, limit: null, used: 5 },
  );
});

Deno.test('canStartBook: gratuito com 2 livros em leitura não começa o terceiro', () => {
  assertEquals(
    canStartBook({ premium: false, limits: LIMITS, bookId: 'b3', activeBookIds: ['b1', 'b2'] }),
    { allowed: false, limit: 2, used: 2 },
  );
});

Deno.test('canStartBook: livro que já está em leitura não conta de novo', () => {
  assertEquals(canStartBook({ premium: false, limits: LIMITS, bookId: 'b2', activeBookIds: ['b1', 'b2'] }).allowed, true);
});

Deno.test('canStartBook: com uma vaga livre, pode começar', () => {
  assertEquals(canStartBook({ premium: false, limits: LIMITS, bookId: 'b2', activeBookIds: ['b1'] }).allowed, true);
});

Deno.test('canStartBook: Premium e limite "unlimited" não travam', () => {
  assertEquals(canStartBook({ premium: true, limits: LIMITS, bookId: 'b9', activeBookIds: ['b1', 'b2', 'b3'] }).allowed, true);
  assertEquals(
    canStartBook({ premium: false, limits: { maxActiveBooks: null, monthlyQuizChapters: 4 }, bookId: 'b9', activeBookIds: ['b1', 'b2', 'b3'] }).allowed,
    true,
  );
});
