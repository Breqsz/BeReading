-- BER-84: o agendamento do retry-pending-quizzes passa a ter a mesma definição no
-- repositório e em produção.
--
-- Por que existe: a BER-33 trocou o comando do job direto em produção
-- (runbooks/ber-33-cron-vault.sql) para parar de mandar o JWT service_role legado e
-- ler do Vault a URL (`project_url`) e o CRON_SECRET (`cron_secret`). A baseline
-- (20260910210000) é anterior a essa troca e ainda agenda o job lendo o segredo
-- antigo `cron_service_role_key`. Todo ambiente criado a partir das migrations
-- (`supabase db reset`, projeto novo, restauração) ficava com o retry recebendo 401.
--
-- Por que migration, se o runbook da BER-33 dizia "NÃO é migration": os SEGREDOS
-- continuam fora de migration (nunca em arquivo). O AGENDAMENTO já estava na
-- baseline desde a BER-31; o que faltava era atualizá-lo. Tirar o job das
-- migrations exigiria outra migration desagendando, o que apagaria o cron em
-- produção.
--
-- Efeito em produção (pg_cron 1.6.4, job de `postgres`, 15/09/2026): o job já existe
-- com este comando, então `cron.alter_job` só regrava a mesma definição, preservando
-- jobid e histórico em cron.job_run_details. Sem mudança de comportamento.
--
-- Pré-requisito fora desta migration (ambiente novo): criar os segredos no Vault,
-- como no passo A do runbook da BER-33 — sem eles, o job roda e o POST sai sem URL
-- nem credencial. Timeout de 60 s: com fila, a function leva ~50 s (BER-33).

do $do$
declare
  retry_command constant text := $cmd$
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
  $cmd$;
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'retry-pending-quizzes';

  if existing_job_id is not null then
    perform cron.alter_job(
      job_id   := existing_job_id,
      schedule := '0 * * * *',
      command  := retry_command,
      active   := true
    );
  else
    perform cron.schedule('retry-pending-quizzes', '0 * * * *', retry_command);
  end if;
end
$do$;
