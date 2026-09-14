// supabase/functions/get-entitlement/index.ts
// BER-58 / BER-61: o plano do leitor, os limites e quanto já usou.
//
// O app mostra o que vem daqui (card do plano, paywall, quiz bloqueado) e não
// calcula nada sozinho. A trava de verdade continua nas functions que agem
// (evaluate-answer, reading-list) — esta só conta.
import { createServiceClient } from '../_shared/supabase-client.ts';
import { authErrorResponse, resolveUserId } from '../_shared/auth.ts';
import { loadEntitlement, toEntitlementView } from '../_shared/entitlement.ts';

export async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
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

  const entitlement = await loadEntitlement(supabase, user_id);

  return new Response(JSON.stringify({ data: toEntitlementView(entitlement), error: null }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// BER-49: só sobe o listener quando este arquivo é o entrypoint (deploy real).
if (import.meta.main) Deno.serve(handler);
