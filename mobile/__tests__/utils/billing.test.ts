import {
  formatDateBR,
  formatPrice,
  isQuotaExceededError,
  parseQuotaExceeded,
  paywallCopy,
  planFeatures,
  planSummary,
  quizQuotaFor,
  QuotaExceededError,
  type Entitlement,
} from '../../src/utils/billing';

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    plan: 'free',
    premium_plan: { id: 'premium_monthly', name: 'Premium', price_cents: 2490, currency: 'BRL', interval: 'month' },
    subscription: null,
    limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    free_limits: { max_active_books: 2, monthly_quiz_chapters: 4 },
    usage: { active_books: 1, quiz_chapters_this_month: 3 },
    usage_resets_at: '2026-10-01T03:00:00.000Z',
    started_chapter_ids: ['ch-1', 'ch-2', 'ch-3'],
    ...overrides,
  };
}

const PREMIUM: Partial<Entitlement> = {
  plan: 'premium',
  limits: { max_active_books: null, monthly_quiz_chapters: null },
  subscription: {
    plan_id: 'premium_monthly',
    status: 'active',
    provider: 'mock',
    current_period_end: '2026-10-15T15:00:00.000Z',
    cancel_at_period_end: false,
  },
};

describe('parseQuotaExceeded (BER-58)', () => {
  it('lê o 402 quota_exceeded', () => {
    expect(parseQuotaExceeded(402, {
      error: 'quota_exceeded',
      data: { reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z' },
    })).toEqual({ reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z' });
  });

  it('ignora outros status e corpos que não são de cota', () => {
    expect(parseQuotaExceeded(403, { error: 'quota_exceeded', data: { reason: 'quiz_chapters' } })).toBeNull();
    expect(parseQuotaExceeded(402, { error: 'Payment required' })).toBeNull();
    expect(parseQuotaExceeded(402, { error: 'quota_exceeded', data: { reason: 'outro' } })).toBeNull();
    expect(parseQuotaExceeded(undefined, null)).toBeNull();
  });
});

describe('QuotaExceededError', () => {
  it('é reconhecido pelo guard e carrega o limite', () => {
    const err = new QuotaExceededError({ reason: 'active_books', limit: 2, used: 2, resets_at: null });
    expect(isQuotaExceededError(err)).toBe(true);
    expect(err.quota.limit).toBe(2);
    expect(err.message).toBe('Você já está lendo 2 livros');
  });

  it('erro comum não passa no guard', () => {
    expect(isQuotaExceededError(new Error('x'))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });
});

describe('formatação', () => {
  it('preço em reais', () => {
    expect(formatPrice(2490)).toBe('R$ 24,90');
    expect(formatPrice(1000)).toBe('R$ 10,00');
    expect(formatPrice(5)).toBe('R$ 0,05');
  });

  it('data no fuso de São Paulo', () => {
    // 03:00 UTC do dia 1 é meia-noite em São Paulo — ainda dia 1.
    expect(formatDateBR('2026-10-01T03:00:00.000Z')).toBe('01/10/2026');
    // 02:00 UTC do dia 1 ainda é dia 30 em São Paulo.
    expect(formatDateBR('2026-10-01T02:00:00.000Z')).toBe('30/09/2026');
  });
});

describe('quizQuotaFor (BER-58)', () => {
  it('gratuito abaixo do limite abre o quiz', () => {
    expect(quizQuotaFor(entitlement(), 'ch-novo')).toBeNull();
  });

  it('gratuito no limite não abre capítulo novo', () => {
    const e = entitlement({ usage: { active_books: 1, quiz_chapters_this_month: 4 } });
    expect(quizQuotaFor(e, 'ch-novo')).toEqual({
      reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z',
    });
  });

  it('capítulo já começado continua aberto mesmo no limite', () => {
    const e = entitlement({ usage: { active_books: 1, quiz_chapters_this_month: 4 } });
    expect(quizQuotaFor(e, 'ch-2')).toBeNull();
  });

  it('Premium e limite nulo nunca bloqueiam', () => {
    expect(quizQuotaFor(entitlement({ ...PREMIUM, usage: { active_books: 9, quiz_chapters_this_month: 99 } }), 'x')).toBeNull();
    expect(quizQuotaFor(entitlement({
      limits: { max_active_books: 2, monthly_quiz_chapters: null },
      usage: { active_books: 1, quiz_chapters_this_month: 99 },
    }), 'x')).toBeNull();
  });
});

describe('paywallCopy', () => {
  it('limite de livros sugere trocar de livro', () => {
    const copy = paywallCopy({ reason: 'active_books', limit: 2, used: 2, resets_at: null });
    expect(copy.title).toBe('Você já está lendo 2 livros');
    expect(copy.description).toContain('2 livros ao mesmo tempo');
    expect(copy.hint).toContain('Tire um livro da leitura');
  });

  it('limite de quizzes diz quando a cota volta', () => {
    const copy = paywallCopy({ reason: 'quiz_chapters', limit: 4, used: 4, resets_at: '2026-10-01T03:00:00.000Z' });
    expect(copy.title).toBe('Você usou seus 4 quizzes do mês');
    expect(copy.hint).toBe('Seus quizzes voltam em 01/10/2026.');
  });

  it('singular quando o limite é 1', () => {
    expect(paywallCopy({ reason: 'active_books', limit: 1, used: 1, resets_at: null }).title)
      .toBe('Você já está lendo 1 livro');
    expect(paywallCopy({ reason: 'quiz_chapters', limit: 1, used: 1, resets_at: null }).title)
      .toBe('Você usou seu quiz do mês');
  });
});

describe('planSummary', () => {
  it('gratuito mostra o uso contra os limites', () => {
    expect(planSummary(entitlement())).toEqual({
      title: 'Plano gratuito',
      lines: ['1 de 2 livros em leitura', '3 de 4 quizzes este mês'],
    });
  });

  it('Premium mostra a renovação', () => {
    expect(planSummary(entitlement(PREMIUM))).toEqual({
      title: 'Premium',
      lines: ['Renova em 15/10/2026', 'Livros e quizzes sem limite'],
    });
  });

  it('Premium cancelado mostra até quando vale', () => {
    const canceled = entitlement({
      ...PREMIUM,
      subscription: { ...PREMIUM.subscription!, cancel_at_period_end: true },
    });
    expect(planSummary(canceled).lines[0]).toBe('Ativo até 15/10/2026, sem renovação');
  });
});

describe('planFeatures', () => {
  it('usa os limites reais do gratuito, mesmo para quem é Premium', () => {
    const features = planFeatures(entitlement({ ...PREMIUM, free_limits: { max_active_books: 3, monthly_quiz_chapters: 6 } }));
    expect(features.free[0]).toBe('Até 3 livros em leitura ao mesmo tempo');
    expect(features.free[1]).toBe('6 capítulos com quiz por mês');
  });
});
