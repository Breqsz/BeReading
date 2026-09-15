// supabase/functions/_shared/plan-rules.ts
// BER-58 / BER-61: regras puras de plano — o que o gratuito pode, quem é Premium.
//
// Tudo aqui é sem IO, para ser testado de verdade (mesmo raciocínio da BER-35).
// Quem busca os dados no banco é `entitlement.ts`.

/** O único plano pago por enquanto. Preço exibido no app vem daqui, não do app. */
export const PREMIUM_PLAN = {
  id: 'premium_monthly',
  name: 'Premium',
  price_cents: 2490,
  currency: 'BRL',
  interval: 'month',
} as const;

export interface FreeLimits {
  /** Livros com status `reading` ao mesmo tempo. `null` = sem limite. */
  maxActiveBooks: number | null;
  /** Capítulos com quiz iniciados por mês (fuso de São Paulo). `null` = sem limite. */
  monthlyQuizChapters: number | null;
}

export const DEFAULT_FREE_LIMITS: FreeLimits = {
  maxActiveBooks: 2,
  monthlyQuizChapters: 4,
};

/**
 * Lê um limite de env var. Inteiro >= 0 vale como limite; `unlimited` desliga o
 * limite; vazio ou inválido cai no default — um typo no secret não pode abrir o
 * plano gratuito sem ninguém perceber, nem travar todo mundo em zero.
 */
function parseLimit(raw: string | undefined, fallback: number | null): number | null {
  if (raw === undefined) return fallback;
  const value = raw.trim().toLowerCase();
  if (value === 'unlimited') return null;
  if (!/^\d+$/.test(value)) return fallback;
  return Number(value);
}

/** Limites do gratuito a partir das env vars `FREE_MAX_ACTIVE_BOOKS` e `FREE_MONTHLY_QUIZ_CHAPTERS`. */
export function readFreeLimits(getEnv: (key: string) => string | undefined): FreeLimits {
  return {
    maxActiveBooks: parseLimit(getEnv('FREE_MAX_ACTIVE_BOOKS'), DEFAULT_FREE_LIMITS.maxActiveBooks),
    monthlyQuizChapters: parseLimit(
      getEnv('FREE_MONTHLY_QUIZ_CHAPTERS'),
      DEFAULT_FREE_LIMITS.monthlyQuizChapters,
    ),
  };
}

export interface SubscriptionRow {
  plan_id: string;
  status: string;
  provider: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

/**
 * A assinatura dá acesso Premium agora? Cancelada (`cancel_at_period_end`) ainda
 * vale até o fim do período já pago — o leitor não perde o que pagou.
 */
export function isPremium(subscription: SubscriptionRow | null | undefined, nowMs: number): boolean {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;
  return Date.parse(subscription.current_period_end) > nowMs;
}

/**
 * Fim de um período mensal: o mesmo dia no mês seguinte. Se o dia não existir
 * (31/01 → fevereiro), cai no último dia do mês — o período nunca pula um mês.
 */
export function addOneMonth(fromMs: number): string {
  const from = new Date(fromMs);
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    month,
    Math.min(from.getUTCDate(), lastDay),
    from.getUTCHours(),
    from.getUTCMinutes(),
    from.getUTCSeconds(),
    from.getUTCMilliseconds(),
  )).toISOString();
}

const SAOPAULO_OFFSET_HOURS = -3;

/**
 * Início do mês corrente e do próximo, em São Paulo, como instantes ISO (UTC).
 * A cota mensal "vira" à meia-noite do dia 1 no horário do leitor, não em UTC.
 */
export function monthWindowInSaoPaulo(nowMs: number): { start: string; next: string } {
  const sp = new Date(nowMs + SAOPAULO_OFFSET_HOURS * 3600000);
  const year = sp.getUTCFullYear();
  const month = sp.getUTCMonth();
  const offsetMs = -SAOPAULO_OFFSET_HOURS * 3600000;
  return {
    start: new Date(Date.UTC(year, month, 1) + offsetMs).toISOString(),
    next: new Date(Date.UTC(year, month + 1, 1) + offsetMs).toISOString(),
  };
}

export interface AnswerUsageRow {
  chapter_id: string;
  answered_at: string | null;
}

/**
 * Capítulos que o leitor já começou (qualquer data) e os que começou neste mês.
 *
 * "Começou" = primeira resposta dada naquele capítulo. É essa data que conta na
 * cota: um quiz iniciado no fim do mês passado e terminado hoje não gasta outra vaga.
 */
export function summarizeQuizUsage(
  answers: AnswerUsageRow[],
  monthStartIso: string,
  nowMs: number,
): { startedChapterIds: string[]; chaptersThisMonth: string[] } {
  const firstAnswerAt = new Map<string, number>();
  for (const answer of answers) {
    if (!answer.chapter_id) continue;
    // O banco sempre preenche answered_at (default now()); sem ele, conta como agora.
    const at = answer.answered_at ? Date.parse(answer.answered_at) : nowMs;
    const previous = firstAnswerAt.get(answer.chapter_id);
    if (previous === undefined || at < previous) firstAnswerAt.set(answer.chapter_id, at);
  }

  const monthStart = Date.parse(monthStartIso);
  const startedChapterIds = [...firstAnswerAt.keys()];
  const chaptersThisMonth = startedChapterIds.filter((id) => firstAnswerAt.get(id)! >= monthStart);
  return { startedChapterIds, chaptersThisMonth };
}

export interface QuotaCheck {
  allowed: boolean;
  limit: number | null;
  used: number;
}

/** O leitor pode responder (ou continuar respondendo) o quiz deste capítulo? */
export function canAnswerChapter(input: {
  premium: boolean;
  limits: FreeLimits;
  chapterId: string;
  startedChapterIds: string[];
  chaptersThisMonth: string[];
}): QuotaCheck {
  const limit = input.premium ? null : input.limits.monthlyQuizChapters;
  const used = input.chaptersThisMonth.length;
  // Capítulo já começado nunca trava no meio do quiz.
  if (limit === null || input.startedChapterIds.includes(input.chapterId)) {
    return { allowed: true, limit, used };
  }
  return { allowed: used < limit, limit, used };
}

/** O leitor pode colocar este livro em leitura agora? */
export function canStartBook(input: {
  premium: boolean;
  limits: FreeLimits;
  bookId: string;
  activeBookIds: string[];
}): QuotaCheck {
  const limit = input.premium ? null : input.limits.maxActiveBooks;
  const used = input.activeBookIds.length;
  if (limit === null || input.activeBookIds.includes(input.bookId)) {
    return { allowed: true, limit, used };
  }
  return { allowed: used < limit, limit, used };
}

/** Motivo do bloqueio, usado pelo app para escolher a mensagem do paywall. */
export type QuotaReason = 'active_books' | 'quiz_chapters';

/** Resposta padrão de limite atingido (402): o app trata como convite, não como erro. */
export function quotaExceededResponse(
  reason: QuotaReason,
  check: QuotaCheck,
  resetsAt: string | null,
): Response {
  return new Response(JSON.stringify({
    error: 'quota_exceeded',
    data: { reason, limit: check.limit, used: check.used, resets_at: resetsAt },
  }), {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  });
}
