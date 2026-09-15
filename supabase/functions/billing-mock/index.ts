// supabase/functions/billing-mock/index.ts
// BER-61: cobrança SIMULADA — assina, cancela e retoma o Premium sem cobrar nada.
//
// Existe para o fluxo completo (planos → confirmação → Premium → gerenciar)
// funcionar de ponta a ponta enquanto a compra in-app real não é integrada. Grava
// em `subscriptions` exatamente o que a integração real vai gravar, só que com
// `provider = 'mock'` — o resto do sistema (limites, app) não distingue os dois.
//
// Só liga com `BILLING_MODE=mock`; sem o secret ou com outro valor, recusa tudo (BER-85:
// ausência de configuração nunca pode significar cobrança simulada ligada).
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { loadEntitlement, loadSubscription, toEntitlementView } from '../_shared/entitlement.ts';
import { addOneMonth, isPremium, PREMIUM_PLAN } from '../_shared/plan-rules.ts';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (Deno.env.get('BILLING_MODE') !== 'mock') {
    return json({ error: 'Mock billing disabled' }, 403);
  }

  let payload: { action?: unknown; plan_id?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const supabase = createServiceClient();

  let user_id: string;
  try {
    user_id = await resolveUserId(
      req.headers.get('Authorization'),
      undefined,
      (token) => supabase.auth.getUser(token),
    );
  } catch (err) {
    return authErrorResponse(err);
  }

  const { action, plan_id } = payload;
  if (action !== 'subscribe' && action !== 'cancel' && action !== 'resume') {
    return json({ error: 'action (subscribe|cancel|resume) required' }, 400);
  }
  if (plan_id !== undefined && plan_id !== PREMIUM_PLAN.id) {
    return json({ error: 'Unknown plan' }, 400);
  }

  const now = Date.now();
  const current = await loadSubscription(supabase, user_id);
  const active = isPremium(current, now);

  if (action === 'subscribe' && !active) {
    const { error } = await supabase.from('subscriptions').upsert({
      user_id,
      plan_id: PREMIUM_PLAN.id,
      status: 'active',
      provider: 'mock',
      provider_transaction_id: `mock_${crypto.randomUUID()}`,
      current_period_start: new Date(now).toISOString(),
      current_period_end: addOneMonth(now),
      cancel_at_period_end: false,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return json({ error: 'Failed to save subscription' }, 500);
  } else if (action === 'cancel' || action === 'resume' || current?.cancel_at_period_end) {
    // `subscribe` de quem já é Premium mas tinha cancelado = retomar.
    if (!active) return json({ error: 'No active subscription' }, 409);
    const { error } = await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: action === 'cancel', updated_at: new Date(now).toISOString() })
      .eq('user_id', user_id);
    if (error) return json({ error: 'Failed to save subscription' }, 500);
  }

  const entitlement = await loadEntitlement(supabase, user_id, now);
  return json({ data: toEntitlementView(entitlement), error: null });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
