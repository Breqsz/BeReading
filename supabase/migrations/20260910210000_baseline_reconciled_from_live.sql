-- BER-31: baseline única, reconciliada a partir do schema vivo do Supabase (10/09/2026).
--
-- Por quê este arquivo existe: as 5 migrations antigas (20260323000001-5) descreviam um
-- banco que já não existe (`students`/`student_id`) e uma delas (`0005_book_contents_pilot`)
-- tinha apóstrofos não escapados que quebravam a aplicação (`O'Brien` em *1984*). O banco em
-- produção rodava `profiles`/`user_id`, trigger `handle_new_user`, policies e funções
-- (`get_teacher_id`, `is_classroom_book`) que não existiam em nenhum arquivo do repo —
-- aplicadas via 3 migrations remotas sem arquivo local correspondente (`book_contents_pilot`,
-- `profiles_refactor`, `profiles_fixes`). Ver BER-31 para o diagnóstico completo.
--
-- Este arquivo substitui os 5 antigos (movidos para docs/history/) como fonte única da
-- verdade do schema. Reconstruído por introspecção direta do banco vivo (pg_catalog,
-- information_schema, pg_policies) em 10/09/2026 — não por edição manual dos arquivos
-- antigos, como a BER-31 pede.
--
-- NÃO reexecutar contra o projeto atual: o schema já existe. Este arquivo é para (a) um
-- projeto novo partir de um estado idêntico ao de produção, e (b) documentação/disaster
-- recovery. A aplicação neste projeto foi feita via `supabase migration repair` (registro
-- de versão sem reexecução) — ver comentário da BER-31 para o comando exato.
--
-- Fora deste arquivo, propositalmente:
--   - segredo do Vault (`cron_service_role_key`, BER-73): nunca em texto plano em migration.
--   - dados de usuário reais (profiles, answers, reading_sessions, streaks, student_badges,
--     schools/classrooms/teachers reais): pertencem a backup/PITR (BER-31 item 1), não a uma
--     migration de schema.
--   - a seed de conteúdo do piloto (livros, capítulos, paráfrases, badges) ESTÁ incluída
--     abaixo: é dado de referência versionável, escrito à mão pelo time (não gerado por
--     usuário), e é justamente o dado que a `0005` original corrompia.

-- ============================================================================
-- EXTENSÕES
-- ============================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net with schema public;
create extension if not exists pg_cron;

-- ============================================================================
-- TABELAS
-- ============================================================================

create table public.schools (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null,
  city text not null,
  state text not null,
  invite_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table public.classrooms (
  id uuid primary key default extensions.uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  grade text not null,
  year int not null,
  class_code text unique not null default substring(md5(random()::text), 1, 8),
  created_at timestamptz default now()
);

create table public.teachers (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.classroom_teachers (
  id uuid primary key default extensions.uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  unique(classroom_id, teacher_id)
);

-- Substitui `students` (pivô B2C, nunca documentado em migration — BER-31). PK é user_id:
-- um perfil por usuário de auth. `classroom_id` fica nulo para leitor sem turma (B2C puro).
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  display_name text not null,
  created_at timestamptz default now()
);

create table public.books (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  author text not null,
  cover_url text,
  total_pages int not null check (total_pages > 0),
  genre text,
  created_at timestamptz default now()
);

create table public.chapters (
  id uuid primary key default extensions.uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  number int not null,
  title text,
  start_page int not null,
  end_page int not null,
  unique(book_id, number),
  constraint valid_pages check (end_page >= start_page and start_page >= 1)
);

create table public.book_contents (
  id uuid primary key default extensions.uuid_generate_v4(),
  chapter_id uuid not null unique references public.chapters(id) on delete cascade,
  content_text text not null,
  created_at timestamptz default now()
);

create table public.student_books (
  id uuid primary key default extensions.uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null default 'reading' check (status in ('reading', 'finished', 'dropped')),
  current_page int not null default 1,
  started_at timestamptz default now(),
  finished_at timestamptz,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  unique(user_id, book_id)
);

create table public.reading_sessions (
  id uuid primary key default extensions.uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  start_page int not null,
  end_page int not null,
  pages_read int not null generated always as (end_page - start_page + 1) stored,
  read_at timestamptz default now(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  constraint valid_session check (end_page >= start_page and start_page >= 1)
);

create table public.questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  type text not null check (type in ('comprehension', 'reflection')),
  question_text text not null,
  generated_at timestamptz default now()
);

create table public.chapter_quiz_status (
  id uuid primary key default extensions.uuid_generate_v4(),
  chapter_id uuid not null unique references public.chapters(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'generated', 'failed')),
  attempts int not null default 0,
  last_attempt_at timestamptz,
  error_message text
);

create table public.answers (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade,
  answer_text text not null,
  comprehension_score int check (comprehension_score between 0 and 100),
  ai_feedback text,
  answered_at timestamptz default now(),
  evaluation_status text not null default 'pending' check (evaluation_status in ('pending', 'completed', 'failed')),
  evaluated_at timestamptz,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  unique(question_id, user_id)
);

create table public.streaks (
  id uuid primary key default extensions.uuid_generate_v4(),
  current_streak int not null default 0,
  longest_streak int not null default 0,
  last_read_date date,
  user_id uuid not null unique references public.profiles(user_id) on delete cascade
);

create table public.badges (
  id uuid primary key default extensions.uuid_generate_v4(),
  name text not null unique,
  description text not null,
  icon_url text,
  criteria_type text not null check (criteria_type in ('streak_days', 'total_pages', 'books_finished', 'quiz_score', 'personal_book', 'quizzes_answered', 'reflection_score_80', 'avg_score_90_book', 'total_sessions')),
  criteria_value int not null
);

create table public.student_badges (
  id uuid primary key default extensions.uuid_generate_v4(),
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz default now(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  unique(user_id, badge_id)
);

create table public.classroom_books (
  id uuid primary key default extensions.uuid_generate_v4(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  assigned_by uuid references public.teachers(id) on delete set null,
  status text not null default 'required' check (status in ('required', 'recommended')),
  created_at timestamptz default now(),
  unique(classroom_id, book_id)
);

-- ============================================================================
-- ÍNDICES (além dos criados implicitamente por PK/UNIQUE acima)
-- ============================================================================

create index idx_chapter_quiz_status_failed on public.chapter_quiz_status(status) where status = 'failed';
create index idx_classroom_books_classroom on public.classroom_books(classroom_id);
create index idx_classroom_teachers_classroom on public.classroom_teachers(classroom_id);
create index idx_classroom_teachers_teacher on public.classroom_teachers(teacher_id);
create index profiles_classroom_id_idx on public.profiles(classroom_id);
create index idx_questions_chapter on public.questions(chapter_id);
create index idx_reading_sessions_book on public.reading_sessions(book_id);
create index reading_sessions_user_id_idx on public.reading_sessions(user_id);
create index reading_sessions_user_id_book_id_idx on public.reading_sessions(user_id, book_id);
create index answers_user_id_idx on public.answers(user_id);
create index student_badges_user_id_idx on public.student_badges(user_id);
create index student_books_user_id_idx on public.student_books(user_id);

-- ============================================================================
-- FUNÇÕES
-- ============================================================================

-- BER-70: helpers de RLS vivem em `private`, fora do schema exposto pelo PostgREST — não
-- são chamáveis via /rest/v1/rpc/..., só de dentro de policies (resolução por OID).
create schema if not exists private;

create or replace function private.get_teacher_id()
returns uuid
language sql stable security definer
set search_path to 'public'
as $function$
  select id from public.teachers where user_id = auth.uid()
$function$;

create or replace function private.is_classroom_book(p_book_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.classroom_books cb
    join public.profiles p on p.classroom_id = cb.classroom_id
    where cb.book_id = p_book_id and p.user_id = p_user_id
  )
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', 'Leitor')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

-- BER-73: handle_new_user só roda via trigger — nenhum role precisa chamá-la via RPC.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function private.get_teacher_id() from public, anon;
revoke execute on function private.is_classroom_book(uuid, uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.get_teacher_id() to authenticated;
grant execute on function private.is_classroom_book(uuid, uuid) to authenticated;

-- ============================================================================
-- TRIGGER
-- ============================================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.schools enable row level security;
alter table public.classrooms enable row level security;
alter table public.teachers enable row level security;
alter table public.classroom_teachers enable row level security;
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.book_contents enable row level security;
alter table public.student_books enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.questions enable row level security;
alter table public.chapter_quiz_status enable row level security;
alter table public.answers enable row level security;
alter table public.streaks enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;
alter table public.classroom_books enable row level security;

-- book_contents: RLS habilitado, sem nenhuma policy (nega tudo). É o estado real de
-- produção hoje — não uma omissão deste arquivo. Achado do advisor de segurança, ainda
-- sem issue própria no Linear em 10/09/2026.

create policy schools_user_read on public.schools for select to authenticated
  using (id = (select cl.school_id from public.classrooms cl join public.profiles p on p.classroom_id = cl.id where p.user_id = auth.uid()));
create policy schools_teacher_read on public.schools for select to authenticated
  using (id = (select teachers.school_id from public.teachers where teachers.user_id = auth.uid()));

create policy classrooms_user_read on public.classrooms for select to authenticated
  using (id = (select profiles.classroom_id from public.profiles where profiles.user_id = auth.uid()));
create policy classrooms_teacher_read on public.classrooms for select to authenticated
  using (id in (select ct.classroom_id from public.classroom_teachers ct where ct.teacher_id = private.get_teacher_id()));
create policy classrooms_teacher_insert on public.classrooms for insert to authenticated
  with check (school_id = (select teachers.school_id from public.teachers where teachers.user_id = auth.uid()));

create policy teachers_own on public.teachers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy classroom_teachers_teacher on public.classroom_teachers for all to authenticated
  using (teacher_id = private.get_teacher_id())
  with check (
    teacher_id = private.get_teacher_id()
    and exists (
      select 1 from public.classrooms cl join public.teachers t on t.school_id = cl.school_id
      where cl.id = classroom_teachers.classroom_id and t.id = private.get_teacher_id()
    )
  );

create policy profiles_own on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_teacher_read on public.profiles for select to authenticated
  using (classroom_id is not null and classroom_id in (select ct.classroom_id from public.classroom_teachers ct where ct.teacher_id = private.get_teacher_id()));

create policy books_public_read on public.books for select to authenticated using (true);
create policy chapters_public_read on public.chapters for select to authenticated using (true);
create policy questions_public_read on public.questions for select to authenticated using (true);
create policy chapter_quiz_status_public_read on public.chapter_quiz_status for select to authenticated using (true);
create policy badges_public_read on public.badges for select to authenticated using (true);

create policy student_books_own on public.student_books for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reading_sessions_own on public.reading_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reading_sessions_teacher_read on public.reading_sessions for select to authenticated
  using (
    user_id in (select p.user_id from public.profiles p join public.classroom_teachers ct on ct.classroom_id = p.classroom_id where ct.teacher_id = private.get_teacher_id())
    and private.is_classroom_book(book_id, user_id)
  );

create policy answers_own on public.answers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy answers_teacher_read on public.answers for select to authenticated
  using (
    user_id in (select p.user_id from public.profiles p join public.classroom_teachers ct on ct.classroom_id = p.classroom_id where ct.teacher_id = private.get_teacher_id())
    and private.is_classroom_book((select c.book_id from public.chapters c join public.questions q on q.chapter_id = c.id where q.id = answers.question_id), user_id)
  );

create policy streaks_own on public.streaks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy streaks_teacher_read on public.streaks for select to authenticated
  using (user_id in (select p.user_id from public.profiles p join public.classroom_teachers ct on ct.classroom_id = p.classroom_id where ct.teacher_id = private.get_teacher_id()));

create policy student_badges_own on public.student_badges for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy classroom_books_teacher on public.classroom_books for all to authenticated
  using (classroom_id in (select ct.classroom_id from public.classroom_teachers ct where ct.teacher_id = private.get_teacher_id()))
  with check (classroom_id in (select ct.classroom_id from public.classroom_teachers ct where ct.teacher_id = private.get_teacher_id()));
create policy classroom_books_user_read on public.classroom_books for select to authenticated
  using (classroom_id = (select profiles.classroom_id from public.profiles where profiles.user_id = auth.uid()));

-- ============================================================================
-- CRON (BER-73: lê o secret do Vault por nome — a chave em si é seedada fora desta
-- migration via `select vault.create_secret(...)`, nunca em texto plano num arquivo)
-- ============================================================================

select cron.unschedule('retry-pending-quizzes')
where exists (select 1 from cron.job where jobname = 'retry-pending-quizzes');

select cron.schedule(
  'retry-pending-quizzes',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://asfdkzejtuqcgqdcsnac.supabase.co/functions/v1/retry-pending-quizzes',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'cron_service_role_key'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- ============================================================================
-- SEED: catálogo do piloto (3 livros, 25 capítulos, paráfrases, badges)
--
-- Conteúdo de referência escrito à mão pelo time (não gerado por usuário) — ver BER-59.
-- Dollar-quoting em vez de aspas simples escapadas: é o texto que continha os apóstrofos
-- não escapados (`O'Brien`) que quebravam a migration `0005` original.
-- ============================================================================

insert into public.books (id, title, author, total_pages, genre) values
  ('00000000-0000-0000-0001-000000000001', 'O Guia do Mochileiro das Galáxias', 'Douglas Adams', 215, 'Ficção Científica'),
  ('00000000-0000-0000-0002-000000000002', '1984', 'George Orwell', 328, 'Distopia'),
  ('00000000-0000-0000-0003-000000000003', 'Coraline', 'Neil Gaiman', 162, 'Fantasia')
on conflict (id) do nothing;

insert into public.badges (id, name, description, criteria_type, criteria_value) values
  ('a55957f2-a995-4a03-910c-a0448eb178d8', 'Capítulo Completo', 'Completou e respondeu seu primeiro quiz de capítulo', 'quizzes_answered', 1),
  ('23e1368e-8c29-46fa-aa21-a32ba780ae04', 'Devorador de Páginas', 'Leu 500 páginas no total', 'total_pages', 500),
  ('48143527-025b-4bbd-851c-e151e0a3b758', 'Explorador', 'Está lendo um livro fora da grade escolar', 'personal_book', 1),
  ('e67e0495-6443-4704-84c2-d76498f345f2', 'Leitor de 30 dias', 'Manteve streak por 30 dias consecutivos', 'streak_days', 30),
  ('a9127fed-0091-4baf-84b4-acf8460a4961', 'Leitor de 7 dias', 'Manteve streak por 7 dias consecutivos', 'streak_days', 7),
  ('5778d7ac-ee87-424d-bf58-673fc9bf4004', 'Livro Finalizado', 'Finalizou um livro completo', 'books_finished', 1),
  ('e44d7d15-1372-43db-aa75-b87a2e302293', 'Mestre da Compreensão', 'Score médio acima de 90 em um livro completo', 'avg_score_90_book', 1),
  ('fdcc31d7-6ff6-4345-af4c-84ea22973214', 'Pensador Crítico', 'Obteve score de reflexão acima de 80 em 5 quizzes', 'reflection_score_80', 5),
  ('79eb3e54-835f-4abe-867b-7feb6ee40954', 'Primeira Página', 'Registrou sua primeira sessão de leitura', 'total_sessions', 1)
on conflict (id) do nothing;

-- Guia do Mochileiro das Galáxias (8 capítulos)
insert into public.chapters (id, book_id, number, title, start_page, end_page) values
  ('e04587f0-7c2e-4872-b94e-c7accccedd94', '00000000-0000-0000-0001-000000000001', 1, 'Capítulo 1', 1, 20),
  ('7ea95950-0e7e-459d-b205-a0ae4401de91', '00000000-0000-0000-0001-000000000001', 2, 'Capítulo 2', 21, 40),
  ('92bbdb59-f1c5-4937-b5b2-e6a6f7668bbc', '00000000-0000-0000-0001-000000000001', 3, 'Capítulo 3', 41, 60),
  ('cf53a133-da04-4736-a464-eff536c2cd7a', '00000000-0000-0000-0001-000000000001', 4, 'Capítulo 4', 61, 85),
  ('d78078ac-0566-4ff2-9c03-4278250d804b', '00000000-0000-0000-0001-000000000001', 5, 'Capítulo 5', 86, 110),
  ('23a66ebf-4c2e-44f6-82e0-3ea169e50c19', '00000000-0000-0000-0001-000000000001', 6, 'Capítulo 6', 111, 140),
  ('d775d2c6-fea8-47f8-98e7-f0e20809963d', '00000000-0000-0000-0001-000000000001', 7, 'Capítulo 7', 141, 170),
  ('e8aa61a9-9b41-4a7d-ab9b-e15d304dd06f', '00000000-0000-0000-0001-000000000001', 8, 'Capítulo 8', 171, 215)
on conflict (id) do nothing;

-- 1984 (9 capítulos)
insert into public.chapters (id, book_id, number, title, start_page, end_page) values
  ('fe50987e-cd5b-4fd7-9243-547b57317899', '00000000-0000-0000-0002-000000000002', 1, 'Parte 1 - Capítulo 1', 1, 30),
  ('be9143ed-61a8-4f51-ac8a-12eab853dcb1', '00000000-0000-0000-0002-000000000002', 2, 'Parte 1 - Capítulo 2', 31, 60),
  ('d89ceadf-d504-4960-8e45-1539cfe2d5be', '00000000-0000-0000-0002-000000000002', 3, 'Parte 1 - Capítulo 3', 61, 100),
  ('2af3d593-8dc0-45bf-a656-eb396edbbf58', '00000000-0000-0000-0002-000000000002', 4, 'Parte 1 - Capítulo 4', 101, 140),
  ('f31ac389-1148-42ed-bd39-a7779c5dcb3d', '00000000-0000-0000-0002-000000000002', 5, 'Parte 2 - Capítulo 1', 141, 180),
  ('c572b4b3-584c-4947-914a-ba3a6e27c2ba', '00000000-0000-0000-0002-000000000002', 6, 'Parte 2 - Capítulo 2', 181, 220),
  ('7897be55-5414-4c30-ae45-0bbbf484a13c', '00000000-0000-0000-0002-000000000002', 7, 'Parte 2 - Capítulo 3', 221, 265),
  ('658c9223-eb76-450c-94b4-92b7a1e278b9', '00000000-0000-0000-0002-000000000002', 8, 'Parte 3 - Capítulo 1', 266, 300),
  ('b8243c3c-7813-4045-8398-a1e2f672aca1', '00000000-0000-0000-0002-000000000002', 9, 'Parte 3 - Capítulo 2', 301, 328)
on conflict (id) do nothing;

-- Coraline (8 capítulos)
insert into public.chapters (id, book_id, number, title, start_page, end_page) values
  ('74dd673d-2ea3-43ea-b568-d17135cffa81', '00000000-0000-0000-0003-000000000003', 1, 'Capítulo 1', 1, 18),
  ('fd348e7b-28a1-4189-b4b6-73fb22415657', '00000000-0000-0000-0003-000000000003', 2, 'Capítulo 2', 19, 36),
  ('732f60e0-a94e-46ec-bb4a-9d0b32c64f19', '00000000-0000-0000-0003-000000000003', 3, 'Capítulo 3', 37, 54),
  ('26bdc0bd-ed3b-4551-8a86-adf1faaa5163', '00000000-0000-0000-0003-000000000003', 4, 'Capítulo 4', 55, 75),
  ('92d93803-4ed0-4dc8-86d0-c5635e756307', '00000000-0000-0000-0003-000000000003', 5, 'Capítulo 5', 76, 95),
  ('6b3810c2-3782-48ac-9192-18e6912aabd5', '00000000-0000-0000-0003-000000000003', 6, 'Capítulo 6', 96, 115),
  ('bf483f5a-cb4f-4775-83f5-725601909e88', '00000000-0000-0000-0003-000000000003', 7, 'Capítulo 7', 116, 135),
  ('d2280215-f0f4-486f-9a51-c7d81fe7ed0b', '00000000-0000-0000-0003-000000000003', 8, 'Capítulo 8', 136, 162)
on conflict (id) do nothing;

insert into public.book_contents (id, chapter_id, content_text) values
  ('e24cb81b-1401-4338-8f80-24bd244783a2', 'e04587f0-7c2e-4872-b94e-c7accccedd94', $c$Arthur Dent acorda e descobre que sua casa será demolida para dar passagem a uma estrada de desvio. Ele protesta ficando deitado na lama na frente das máquinas. Seu amigo Ford Prefect chega com urgência incomum e convence Arthur a ir ao pub. Lá, Ford revela que é alienígena de Betelgeuse, não humano, e que esteve preso na Terra por quinze anos pesquisando para o Guia do Mochileiro das Galáxias. Ford avisa que a Terra será destruída em doze minutos pelos Vogons. Arthur mal acredita no que ouve. Eles são teletransportados para a nave Vogon no último instante. A Terra explode.$c$),
  ('201398b7-aa41-4aa1-8111-9e6911cc882e', '7ea95950-0e7e-459d-b205-a0ae4401de91', $c$A bordo da nave Vogon, Arthur e Ford descobrem que os Vogons são criaturas burocráticas, feias e sem sentimentos. O capitão Vogon decide torturá-los lendo sua poesia, considerada a terceira pior do universo. Arthur sofre com os versos enquanto Ford tenta apreciar a experiência como antropólogo. Depois da sessão de poesia, o capitão explica com indiferença burocrática que a Terra foi destruída para dar lugar a uma via expressa hiperespacial — os papéis estavam disponíveis para consulta há cinquenta anos nos Planetas Alfa de Centauro. Arthur e Ford são jogados para fora da nave no espaço.$c$),
  ('d3b3f1d9-9fb0-439d-adc8-4a726ac06343', '92bbdb59-f1c5-4937-b5b2-e6a6f7668bbc', $c$Arthur e Ford estão flutuando no espaço, prestes a morrer, quando são resgatados pela nave Coração de Ouro. A nave usa o Motor de Improbabilidade Infinita, que faz coisas matematicamente improváveis acontecerem. A bordo estão Zaphod Beeblebrox, presidente da Galáxia com duas cabeças e três braços, e Trillian, uma astrofísica que Arthur conheceu numa festa em Southampton. Zaphod é primo de Ford. A coincidência de todos se encontrarem é estatisticamente impossível, mas o motor de improbabilidade explica isso. Arthur fica atordoado tentando processar tudo que aconteceu — o fim da Terra, o espaço, e agora isso.$c$),
  ('8f4aa55d-3d10-4613-9630-1a7708cb70a7', 'cf53a133-da04-4736-a464-eff536c2cd7a', $c$Zaphod revela que roubou a nave Coração de Ouro e quer encontrar o planeta Magrathea, que faz planetas sob encomenda e desapareceu há cinco milhões de anos. O Guia do Mochileiro das Galáxias é descrito: um livro eletrônico com informações sobre todo o universo, mais popular que o Guia Enciclopédico porque é mais barato e tem "Não Entre em Pânico" escrito na capa. Ford explica que trabalha como pesquisador do Guia. Marvin, o robô androide de personalidade genuinamente deprimida, é apresentado. Ele tem um cérebro do tamanho de um planeta e é forçado a fazer tarefas triviais, o que o deixa ainda mais deprimido. Marvin reclama de dor em todos os diodos do lado esquerdo.$c$),
  ('ebb6b57b-5d56-45a7-999b-7f9ca2a3a751', 'd78078ac-0566-4ff2-9c03-4278250d804b', $c$A nave chega a Magrathea, que parece deserto e morto. Avisos automáticos ameaçam destruir qualquer nave que se aproxime. Dois mísseis nucleares são disparados. Zaphod ativa o Motor de Improbabilidade Infinita e os mísseis se transformam: um vira um vaso de petúnias e o outro vira uma baleia enorme que materializa no ar e começa a cair. A baleia, existindo há apenas alguns segundos, tenta entender o mundo ao seu redor antes de colidir com o solo. O vaso de petúnias pensa "Oh, não, não de novo." A tripulação pousa em Magrathea e encontra um planeta árido e silencioso.$c$),
  ('b39baac3-8f74-4ab5-b0f0-d64ec8d99cf3', '23a66ebf-4c2e-44f6-82e0-3ea169e50c19', $c$Arthur encontra Slartibartfast, um velho arquiteto magrathiano que gosta especialmente de fiordes. Ele leva Arthur para dentro do planeta, onde gigantescas cavernas abrigam a produção de novos planetas. Arthur vê planetas em construção sendo esculpidos por artesãos. Slartibartfast explica que Magrathea construía planetas de luxo sob encomenda para clientes ricos. Ele revela que a Terra foi encomendada e construída por eles — um computador orgânico de dez milhões de anos projetado para calcular a Pergunta Fundamental da Vida, do Universo e de Tudo Mais. O encomendante eram, na verdade, os camundongos, que são seres hiperdimensionais disfarçados. Slartibartfast ganhou um prêmio pelas costas da Noruega.$c$),
  ('c252ae3f-a075-49f2-8e05-389897e8fd07', 'd775d2c6-fea8-47f8-98e7-f0e20809963d', $c$Slartibartfast conta a história de Deep Thought, o segundo maior computador do universo, construído para responder à Pergunta Fundamental da Vida, do Universo e de Tudo Mais. Após 7,5 milhões de anos de cálculo, Deep Thought revelou que a resposta era 42. O problema: ninguém sabia qual era a pergunta. Deep Thought então projetou um computador ainda maior para calcular a pergunta — a Terra. A Terra funcionou por quase dez milhões de anos como computador orgânico, com toda a vida sendo parte do processo. Mas foi destruída pelos Vogons cinco minutos antes de concluir o cálculo. Os camundongos, frustrados, descobrem que o cérebro de Arthur pode conter fragmentos da pergunta e querem extraí-lo.$c$),
  ('b39b0043-e5fe-43d6-8a39-85d6bbad890f', 'e8aa61a9-9b41-4a7d-ab9b-e15d304dd06f', $c$Os camundongos Frankie e Benjy oferecem dinheiro pelo cérebro de Arthur para extrair a Pergunta Fundamental. Arthur recusa — prefere continuar vivo com seu cérebro. Uma confusão se instala. Policiais galácticos, Shooty e Bang Bang, aparecem para prender Zaphod por roubar a nave Coração de Ouro. No caos dos túneis de Magrathea, a tripulação foge. Marvin fica para trás e conversa com o computador policial, deprimindo-o completamente ao compartilhar sua visão sombria do universo. O computador para de funcionar. A tripulação foge na nave e todos estão com fome. Zaphod propõe ir ao Restaurante no Fim do Universo — o lugar mais extraordinário do universo para jantar.$c$),
  ('bf165698-0542-4242-8386-e9e7614e662c', 'fe50987e-cd5b-4fd7-9243-547b57317899', $c$Winston Smith, 39 anos, trabalha no Ministério da Verdade em Airstrip One (antiga Londres), em 1984. O Partido, liderado pelo Grande Irmão, controla tudo. Telecrãs em cada parede transmitem propaganda e monitoram os cidadãos. Winston volta para seu apartamento miserável e, escondido de um ângulo que o telecran não alcança, começa a escrever num diário — ato que pode resultar em morte ou campos de trabalho. Ele escreve sobre um filme de guerra assistido e sobre o ódio que sente pelo sistema. Winston sabe que a Polícia do Pensamento pode prendê-lo a qualquer momento só por ter pensamentos contrários ao Partido. A sociedade é dividida entre o Partido Externo, o Partido Interno e os proles.$c$),
  ('27de6246-872d-44a5-bc01-62474f37dd36', 'be9143ed-61a8-4f51-ac8a-12eab853dcb1', $c$Winston interage com seus vizinhos, os Parsons: um homem gordo e entusiasta do Partido e seus filhos que são membros dos Espiões Juvenis, treinados para denunciar qualquer comportamento suspeito, inclusive dos próprios pais. No Ministério da Verdade, Winston trabalha reescrevendo artigos antigos de jornais para que se alinhem à versão atual da história — o Partido apaga e reescreve o passado constantemente. Ele observa uma colega chamada Julia e a suspeita de ser espiã do Pensamento. Winston nota O'Brien, um membro do Partido Interno de aparência inteligente, e imagina que talvez ele seja secretamente um rebelde. A Neolíngua, idioma criado pelo Partido para reduzir o vocabulário e suprimir o pensamento livre, é discutida com um colega linguista.$c$),
  ('add10854-b6d3-465e-af6b-c31706122ac7', 'd89ceadf-d504-4960-8e45-1539cfe2d5be', $c$Winston tem sonhos recorrentes com sua mãe e irmã, lembranças vagas de quando eram felizes antes de desaparecerem misteriosamente. Ele participa dos Dois Minutos de Ódio, ritual diário em que todos gritam contra Emmanuel Goldstein, inimigo do Partido. Durante a sessão, Winston sente raiva irracional e ao mesmo tempo olha para Julia com ódio e desejo. Ele troca um olhar com O'Brien que parece comunicar cumplicidade. Winston escreve no diário sobre a Polícia do Pensamento e reflete que provavelmente já está morto — é só questão de tempo. Ele questiona se existiu mesmo um mundo diferente ou se o Partido sempre existiu assim. A ideia de que o passado pode ser totalmente fabricado o perturba profundamente.$c$),
  ('a599d5df-eddb-407a-a1f3-c28df1061f21', '2af3d593-8dc0-45bf-a656-eb396edbbf58', $c$Winston caminha pelo bairro dos proles, onde a vida é miserável mas mais livre — sem telecrãs nas casas, menos vigilância. Ele entra numa antiquaria de um velho chamado Charrington e compra um peso de papel de vidro com coral dentro, objeto inútil e belo de uma época passada. Charrington mostra um quarto para alugar acima da loja, sem telecran — Winston fica fascinado. Ele pensa nos proles como a única esperança de revolução: são maioria esmagadora da população, mas o Partido os mantém ignorantes e distraídos com entretenimento barato. Se os proles acordassem, poderiam destruir o Partido. Winston reflete: "Se há esperança, ela está nos proles."$c$),
  ('86bb35b0-a6f4-43f8-91cc-d5982d26b7fb', 'f31ac389-1148-42ed-bd39-a7779c5dcb3d', $c$Julia passa uma nota para Winston: "Eu te amo." Winston fica chocado — ela era quem ele mais suspeitava ser espiã. Eles se encontram secretamente num campo onde não há câmeras. Julia é jovem, prática e rebelde por instinto — ela tem casos com membros do Partido como forma de subversão, sem grandes ideologias. Eles se beijam e conversam sobre a vida sob o Partido. Julia diz que o Partido pode controlar o que as pessoas dizem e fazem, mas não o que sentem por dentro. Winston e Julia começam um relacionamento proibido. Eles alugam o quarto acima da loja do velho Charrington como esconderijo particular, um espaço sem telecran onde podem ser eles mesmos.$c$),
  ('51709026-3757-453a-b3a2-97329d8a1012', 'c572b4b3-584c-4947-914a-ba3a6e27c2ba', $c$Winston e Julia se encontram regularmente no quarto sobre a antiquaria. Julia traz alimentos que o Partido reserva para a elite — café real, açúcar, pão branco, chocolate — obtidos no mercado negro. Eles vivem momentos de normalidade proibida. O'Brien contata Winston discretamente e o convida ao seu apartamento para receber um dicionário de Neolíngua. Winston e Julia vão juntos. O apartamento de O'Brien é luxuoso — ele é membro do Partido Interno. O'Brien desliga o telecran e revela que é membro da Irmandade, o movimento clandestino de resistência liderado por Goldstein. Ele diz que enviará a Winston o livro de Goldstein.$c$),
  ('4145ac87-eec3-419c-8306-ba29c1cd0238', '7897be55-5414-4c30-ae45-0bbbf484a13c', $c$Winston recebe o livro proibido de Goldstein e começa a ler no quarto enquanto Julia dorme. O livro explica que o mundo é dividido em três superpotências em guerra constante. A guerra não tem objetivo de vitória; ela existe para consumir o excedente de produção e manter o povo na pobreza e sob controle. As classes dominantes de todos os países mantêm o status quo mutuamente. Winston compreende que o objetivo do Partido não é a felicidade humana nem a eficiência — é o poder pelo poder, eterno e absoluto.$c$),
  ('2c7d3fc8-63ac-4788-9297-a67bccb888ac', '658c9223-eb76-450c-94b4-92b7a1e278b9', $c$Enquanto Winston e Julia estão no quarto, uma voz surge atrás do quadro na parede — havia um telecran escondido. A Polícia do Pensamento invade. Charrington remove a máscara: era um agente há anos. Winston e Julia são capturados. No Ministério do Amor, O'Brien aparece — não como aliado, mas como um dos principais agentes do Partido. Tudo era uma armadilha. A tortura começa: física e psicológica. O'Brien diz que não quer apenas a confissão de Winston — quer que ele acredite genuinamente.$c$),
  ('6b905c28-495c-4d75-83a5-fac71e7ac73d', 'b8243c3c-7813-4045-8398-a1e2f672aca1', $c$A tortura de Winston avança em três fases: aprender, entender, aceitar. O'Brien o força a acreditar que dois mais dois são cinco se o Partido disser isso. Winston é levado ao Quarto 101, onde cada pessoa enfrenta seu pior medo — ratos. Ele trai Julia para se salvar. Depois, solto, Winston encontra Julia acidentalmente. Ela diz que também o traiu. Sentado num café, Winston olha para o rosto do Grande Irmão num telecran. Ele sente um amor quente e tranquilo pelo Grande Irmão. A batalha foi vencida — sobre si mesmo.$c$),
  ('06ce2dad-4248-4d19-a5bd-7a04b6f3a488', '74dd673d-2ea3-43ea-b568-d17135cffa81', $c$Coraline Jones, uma garota curiosa de uns 11 anos, se muda com os pais para um apartamento velho dividido com vizinhos estranhos: a senhorita Spink e a senhorita Forcible, duas atrizes aposentadas com cães, e o velho louco do andar de cima que diz ter um circo de ratos. Os pais de Coraline trabalham em casa e raramente prestam atenção nela. Dentro do apartamento, descobre uma pequena porta trancada na parede. Quando sua mãe a abre, há apenas uma parede de tijolos do outro lado. Coraline está entediada e quer que alguém brinque com ela.$c$),
  ('fd6fc4a0-c081-4d8a-a6f4-75e0fc9435af', 'fd348e7b-28a1-4189-b4b6-73fb22415657', $c$De madrugada, Coraline vê que a porta está aberta e há um corredor escuro do outro lado. Ela atravessa e chega num apartamento idêntico ao seu, mas mais vivo e colorido. Lá mora a Outra Mãe: uma mulher que se parece com sua mãe, mas tem botões pretos no lugar dos olhos. A Outra Mãe cozinha comida deliciosa e presta total atenção em Coraline. O apartamento espelho tem jardim encantado e brinquedos. Tudo parece melhor que a vida real. Antes de dormir, ela retorna pelo corredor para casa.$c$),
  ('46dfa21f-5c6b-4c9d-8c24-7400c96ad6c5', '732f60e0-a94e-46ec-bb4a-9d0b32c64f19', $c$Coraline volta ao mundo espelho e encontra outras versões dos vizinhos. O gato misterioso aparece — aqui ele fala. Ele alerta Coraline que as coisas não são o que parecem. A Outra Mãe propõe que Coraline fique para sempre, mas precisaria deixar costurar botões no lugar dos seus olhos. Coraline recusa e volta para casa — seus pais reais, frios e distraídos, mas são seus.$c$),
  ('f3b73df2-79d2-4c31-9694-692465b47adc', '26bdc0bd-ed3b-4551-8a86-adf1faaa5163', $c$Coraline acorda e chama pelos pais — silêncio. A casa está vazia. No espelho da sala vê seus pais congelados num lugar escuro, tentando falar sem som. A Outra Mãe os sequestrou para atrair Coraline de volta. O gato confirma que é uma armadilha. Coraline pega a chave e atravessa o corredor para o mundo espelho, determinada a resgatar seus pais.$c$),
  ('44dd0deb-9195-44ff-9cbf-55a10daebea7', '92d93803-4ed0-4dc8-86d0-c5635e756307', $c$No mundo espelho, a Outra Mãe está diferente — mais alta, com dedos longos como agulhas, menos humana. Coraline propõe um desafio: vai procurar os pais e as almas de três crianças que a Outra Mãe capturou. Se encontrar tudo, todos vão embora. A Outra Mãe aceita — ela gosta de jogos porque sempre ganha. Coraline começa a busca com o gato e a pedra com buraco que as senhoritas lhe deram.$c$),
  ('373691ea-1521-4116-b831-a355433db17e', '6b3810c2-3782-48ac-9192-18e6912aabd5', $c$Coraline usa a pedra com buraco para enxergar almas escondidas. Encontra a primeira alma no teatro das Outras Spink e Forcible. Encontra a segunda no circo do outro velho, escondida entre os ratos. A cada alma encontrada, o mundo espelho fica mais cinza e vazio, como cenário sendo desmontado. A Outra Mãe percebe e fica irritada. Falta a terceira alma.$c$),
  ('aa5ef41b-ed4a-4850-8b7f-1f04012b6785', 'bf483f5a-cb4f-4775-83f5-725601909e88', $c$Coraline encontra a terceira alma no jardim quase apagado. Coleta as três almas. Os pais estão dentro de uma bola de neve na mão da Outra Mãe. Com astúcia, Coraline distrai a Outra Mãe e agarra a bola. Declara que ganhou. A Outra Mãe furiosa tenta bloquear a porta. Coraline joga o gato contra seu rosto — o gato arranha e a cega temporariamente. Coraline foge pelo corredor com os pais e as almas.$c$),
  ('8e9da446-c0f2-4785-a537-51e11a0afbc0', 'd2280215-f0f4-486f-9a51-c7d81fe7ed0b', $c$Coraline atravessa de volta para casa. Seus pais aparecem como se nada tivesse acontecido — sem memória do que passaram. Coraline libera as três almas, que agradecem e partem. Mas a Outra Mão rastejou pelo corredor. Coraline atrai a mão para o poço do jardim e deixa cair a chave. A Outra Mão afunda com a chave. O caminho está selado para sempre. Coraline acorda para o primeiro dia de aula com seus pais — imperfeitos, distraídos, mas seus.$c$)
on conflict (id) do nothing;
