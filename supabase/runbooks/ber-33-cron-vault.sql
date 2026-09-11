-- supabase/runbooks/ber-33-cron-vault.sql
-- BER-33 / BER-69 — o pg_cron do retry passa a ler a credencial do Vault.
--
-- Por que existia: o job `retry-pending-quizzes` levava o JWT service_role legado
-- em texto puro no `cron.job.command` (vai junto em todo backup), e a trava nova
-- do retry nem aceita esse JWT — a SUPABASE_SERVICE_ROLE_KEY injetada nas
-- functions é outra chave. Resultado: publicar o retry do main fazia o cron
-- receber 401.
--
-- NÃO é migration (BER-31): cron.job e Vault são configuração do banco que o
-- histórico de migrations da nuvem não acompanha — a própria
-- migrations/…0004_pg_cron.sql descreve um job com GUC que nunca foi o que rodou. Rodar à mão, uma vez, no SQL Editor ou via
-- `supabase db query --linked --project-ref <ref>`, NESTA ORDEM.
--
-- Antes do SQL (fora do banco):
--   1. Gerar o segredo:                    openssl rand -hex 32
--   2. Gravar nas functions:               supabase secrets set CRON_SECRET=<valor> --project-ref <ref>
--   3. Publicar o retry com a trava nova:  supabase functions deploy retry-pending-quizzes \
--                                            --project-ref <ref> --use-api --no-verify-jwt
-- O mesmo <valor> vai no passo A. Nunca commitar o valor nem colar em issue.

-- A. Segredos no Vault (trocar os placeholders).
select vault.create_secret('<CRON_SECRET>', 'cron_secret',
  'Credencial do pg_cron para retry-pending-quizzes (BER-33)');
select vault.create_secret('https://<project-ref>.supabase.co', 'project_url',
  'URL base das Edge Functions');

-- B. Reescrever o job: nenhuma chave no comando; timeout de 60 s, porque com fila
--    a function leva ~50 s e o padrão de 5 s do pg_net registrava timeout mesmo
--    com o retry funcionando (observado em 10/09/2026).
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'retry-pending-quizzes'),
  command := $cmd$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/retry-pending-quizzes',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                       where name = 'cron_secret'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $cmd$
);

-- C. Conferir que o comando não carrega mais chave nenhuma (esperado: false).
select jobname, schedule, active, command ~ 'eyJ|sb_secret_' as ainda_tem_chave
from cron.job
where jobname = 'retry-pending-quizzes';

-- D. Validar sem esperar a hora cheia: rodar o mesmo POST do passo B uma vez
--    (devolve um request_id) e ler a resposta:
--      select status_code, left(content, 120) from net._http_response where id = <request_id>;
--    Esperado: 200 {"data":{"retried":N,"reevaluated":M}}.
--    401 = o CRON_SECRET do Vault não é o mesmo das functions.

-- Rotação do CRON_SECRET:
--   gerar novo → `supabase secrets set CRON_SECRET=<novo>` →
--   select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), '<novo>');
--   → passo D. Entre os dois passos o cron recebe 401, no máximo por uma rodada.
