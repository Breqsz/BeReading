// supabase/functions/_shared/entitlement.ts
// BER-58 / BER-61: o que este leitor pode fazer agora — plano, limites e uso.
//
// Uma única leitura do banco usada por todas as functions que aplicam limite
// (evaluate-answer, reading-list, register-reading-session) e pela que conta
// para o app (get-entitlement). O app nunca calcula isso sozinho.
import type { createServiceClient } from './supabase-client.ts';
import {
  isPremium,
  monthWindowInSaoPaulo,
  PREMIUM_PLAN,
  readFreeLimits,
  summarizeQuizUsage,
  type FreeLimits,
  type SubscriptionRow,
} from './plan-rules.ts';

type SupabaseClient = ReturnType<typeof createServiceClient>;

export interface Entitlement {
  premium: boolean;
  subscription: SubscriptionRow | null;
  /** Limites efetivos: `null` em tudo para Premium. */
  limits: FreeLimits;
  /** Limites do plano gratuito, mesmo para quem é Premium (tela de planos compara os dois). */
  freeLimits: FreeLimits;
  activeBookIds: string[];
  startedChapterIds: string[];
  chaptersThisMonth: string[];
  /** Quando a cota mensal de quizzes volta a zero. */
  usageResetsAt: string;
}

const SUBSCRIPTION_COLUMNS =
  'plan_id, status, provider, current_period_start, current_period_end, cancel_at_period_end';

export async function loadSubscription(
  supabase: SupabaseClient,
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('user_id', userId)
    .limit(1);
  return (data?.[0] as SubscriptionRow | undefined) ?? null;
}

export async function loadEntitlement(
  supabase: SupabaseClient,
  userId: string,
  nowMs: number = Date.now(),
): Promise<Entitlement> {
  const window = monthWindowInSaoPaulo(nowMs);

  const [subscription, booksResult, answersResult] = await Promise.all([
    loadSubscription(supabase, userId),
    supabase
      .from('student_books')
      .select('book_id')
      .eq('user_id', userId)
      .eq('status', 'reading'),
    supabase
      .from('answers')
      .select('answered_at, questions(chapter_id)')
      .eq('user_id', userId),
  ]);

  const premium = isPremium(subscription, nowMs);
  const freeLimits = readFreeLimits((key) => Deno.env.get(key));
  const usage = summarizeQuizUsage(
    (answersResult.data ?? []).map((row: Record<string, unknown>) => ({
      // Muitos-para-um (answers.question_id → questions): o PostgREST devolve objeto.
      chapter_id: (row.questions as { chapter_id?: string } | null)?.chapter_id ?? '',
      answered_at: (row.answered_at as string | null) ?? null,
    })),
    window.start,
    nowMs,
  );

  return {
    premium,
    subscription,
    limits: premium ? { maxActiveBooks: null, monthlyQuizChapters: null } : freeLimits,
    freeLimits,
    activeBookIds: (booksResult.data ?? []).map((row: { book_id: string }) => row.book_id),
    startedChapterIds: usage.startedChapterIds,
    chaptersThisMonth: usage.chaptersThisMonth,
    usageResetsAt: window.next,
  };
}

/** O formato que o app recebe (get-entitlement e billing-mock). */
export function toEntitlementView(entitlement: Entitlement) {
  return {
    plan: entitlement.premium ? 'premium' : 'free',
    premium_plan: PREMIUM_PLAN,
    subscription: entitlement.subscription
      ? {
        plan_id: entitlement.subscription.plan_id,
        status: entitlement.subscription.status,
        provider: entitlement.subscription.provider,
        current_period_end: entitlement.subscription.current_period_end,
        cancel_at_period_end: entitlement.subscription.cancel_at_period_end,
      }
      : null,
    limits: {
      max_active_books: entitlement.limits.maxActiveBooks,
      monthly_quiz_chapters: entitlement.limits.monthlyQuizChapters,
    },
    free_limits: {
      max_active_books: entitlement.freeLimits.maxActiveBooks,
      monthly_quiz_chapters: entitlement.freeLimits.monthlyQuizChapters,
    },
    usage: {
      active_books: entitlement.activeBookIds.length,
      quiz_chapters_this_month: entitlement.chaptersThisMonth.length,
    },
    usage_resets_at: entitlement.usageResetsAt,
    started_chapter_ids: entitlement.startedChapterIds,
  };
}
