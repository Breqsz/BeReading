-- BER-61 / BER-58: assinatura do leitor e limites do plano gratuito.
--
-- O que este arquivo cria:
--   - `subscriptions`: uma linha por leitor com assinatura Premium. Sem linha, o
--     leitor está no plano gratuito — não existe linha "free" para ninguém.
--
-- O que ele NÃO cria, de propósito:
--   - tabela de planos/limites. Os limites do gratuito são env vars das Edge
--     Functions (`FREE_MAX_ACTIVE_BOOKS`, `FREE_MONTHLY_QUIZ_CHAPTERS` — ver
--     `_shared/plan-rules.ts`), para mudar sem migration e sem deploy de código.
--
-- Cobrança: por ora o único `provider` usado é `mock` (Edge Function
-- `billing-mock`). `app_store` / `play_store` já cabem no CHECK para a
-- integração real não precisar de outra migration.

create table public.subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  plan_id text not null check (plan_id in ('premium_monthly')),
  -- `active` com `cancel_at_period_end` = cancelada, mas vale até o fim do período.
  status text not null check (status in ('active', 'expired')),
  provider text not null check (provider in ('mock', 'app_store', 'play_store')),
  provider_transaction_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint valid_period check (current_period_end > current_period_start)
);

alter table public.subscriptions enable row level security;

-- O leitor só LÊ a própria assinatura. Quem escreve é só o servidor (service_role),
-- no mesmo padrão da BER-28: status de assinante gravado pelo cliente seria
-- "qualquer um se declara Premium".
create policy subscriptions_own_read on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

-- BER-58: começar e tirar livro da leitura passa a ser feito pela Edge Function
-- `reading-list`, que aplica o limite de livros simultâneos do plano gratuito.
-- As policies da BER-28 deixavam o app gravar direto em `student_books` — com
-- elas, o limite seria só visual. A leitura continua liberada (`student_books_read`).
drop policy if exists student_books_start_reading on public.student_books;
drop policy if exists student_books_start_reading_upsert on public.student_books;
