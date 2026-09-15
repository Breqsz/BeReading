// supabase/functions/_shared/auth.ts
// Autorização das Edge Functions.
//
// Duas naturezas de função, dois guards:
//   - função de usuário (chamada pelo app): o dono da ação é o JWT, nunca o corpo.
//   - função interna (chamada por outra function ou pelo pg_cron): exige uma chave de
//     servidor (ver `_shared/keys.ts`) ou, só no retry, o `CRON_SECRET`.
//
// Ver BER-30. O corpo continua podendo trazer `user_id` (o app manda), mas ele é
// tratado como afirmação do cliente: se divergir do JWT, a requisição é recusada.

export interface AuthUser {
  id: string;
}

export type GetUserFn = (
  token: string,
) => Promise<{ data: { user: AuthUser | null }; error: unknown }>;

export class AuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/** Extrai o token de um header `Authorization: Bearer <token>`. */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Resolve o dono da ação a partir do JWT.
 *
 * @param bodyUserId `user_id` que veio no corpo — aceito por compatibilidade com o app,
 *                   mas nunca confiado: serve só para detectar divergência.
 * @throws AuthError 401 sem token ou com token inválido; 403 se o corpo apontar outro usuário.
 */
export async function resolveUserId(
  authHeader: string | null | undefined,
  bodyUserId: string | null | undefined,
  getUser: GetUserFn,
): Promise<string> {
  const token = extractBearer(authHeader);
  if (!token) {
    throw new AuthError(401, 'Authentication required');
  }

  const { data, error } = await getUser(token);
  if (error || !data?.user?.id) {
    throw new AuthError(401, 'Invalid or expired session');
  }

  const authenticatedId = data.user.id;
  if (bodyUserId && bodyUserId !== authenticatedId) {
    // Tentativa de agir em nome de outro usuário (o IDOR do BER-30).
    throw new AuthError(403, 'Forbidden');
  }

  return authenticatedId;
}

/** Comparação de tempo constante — não vaza o prefixo correto da chave. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * A requisição vem de um chamador interno?
 *
 * BER-76: a credencial pode chegar em dois headers. A service_role legada (JWT) vem
 * em `Authorization: Bearer`; a secret key nova (`sb_secret_…`) só pode vir em
 * `apikey`, porque a plataforma recusa com "Invalid JWT" chave nova no `Authorization`
 * de uma Edge Function. Durante a migração, os dois valem.
 *
 * O app nunca passa: ele manda a publishable key em `apikey` e o JWT do usuário no
 * `Authorization`, e nenhum dos dois é chave de servidor.
 *
 * Falha fechada — chave vazia ou ausente no ambiente nunca vale, e sem nenhuma
 * configurada ninguém é interno. BER-36: use direto quando a chamada interna é um
 * caminho alternativo (o cron re-avalia respostas na `evaluate-answer`).
 */
export function isInternalCaller(
  headers: Headers,
  acceptedKeys: ReadonlyArray<string | null | undefined>,
): boolean {
  const keys = acceptedKeys.filter((key): key is string => typeof key === 'string' && key.length > 0);
  if (keys.length === 0) return false;

  const presented = [headers.get('apikey')?.trim(), extractBearer(headers.get('Authorization'))]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return presented.some((credential) => keys.some((key) => safeEqual(credential, key)));
}

/**
 * Guard das funções internas: só passa quem apresenta uma das chaves aceitas.
 *
 * O retry aceita também o `CRON_SECRET` que o pg_cron lê do Vault (BER-69/BER-33);
 * `generate-questions` e `award-badges` aceitam só as chaves de servidor. Na BER-69
 * se confirmou que a `SUPABASE_SERVICE_ROLE_KEY` injetada nas functions é o mesmo
 * JWT legado que estava no cron — é essa chave que a BER-76 aposenta.
 *
 * @throws AuthError 401
 */
export function assertInternalCaller(
  headers: Headers,
  acceptedKeys: ReadonlyArray<string | null | undefined>,
): void {
  if (!isInternalCaller(headers, acceptedKeys)) {
    throw new AuthError(401, 'Service role required');
  }
}

/** Resposta padrão para um AuthError (ou 500 se o erro não for de auth). */
export function authErrorResponse(err: unknown): Response {
  const status = err instanceof AuthError ? err.status : 500;
  const message = err instanceof AuthError ? err.message : 'Internal error';
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
