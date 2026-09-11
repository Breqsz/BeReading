-- BER-28: revoke client write access to server-computed gamification state.
--
-- streaks, student_badges e answers são inteiramente calculados e escritos por
-- Edge Functions rodando como service_role (register-reading-session,
-- award-badges, evaluate-answer) — o app nunca escreve nelas diretamente
-- (confirmado em mobile/src/api/queries.ts e edgeFunctions.ts: só SELECT).
-- Antes, a policy `FOR ALL ... USING (user_id = auth.uid())` permitia ao
-- cliente escrever essas tabelas direto via REST com a anon key + o próprio
-- JWT, sem passar pelas Edge Functions — dava pra inflar streak, autoconceder
-- medalha ou reescrever a nota da IA.
--
-- student_books É escrito diretamente pelo cliente (`addBookToReadingList`,
-- mobile/src/api/queries.ts) — mas só para registrar que começou um livro
-- (status='reading', current_page=1). Todo avanço de progresso depois disso
-- passa por `register-reading-session` (service_role). O WITH CHECK abaixo
-- permite só essa forma exata, fechando o vetor `PATCH student_books
-- {status:'finished'}` sem quebrar a funcionalidade real do app.

drop policy streaks_own on public.streaks;
create policy streaks_own on public.streaks for select to authenticated
  using (user_id = auth.uid());

drop policy student_badges_own on public.student_badges;
create policy student_badges_own on public.student_badges for select to authenticated
  using (user_id = auth.uid());

drop policy answers_own on public.answers;
create policy answers_own on public.answers for select to authenticated
  using (user_id = auth.uid());

drop policy student_books_own on public.student_books;

create policy student_books_read on public.student_books for select to authenticated
  using (user_id = auth.uid());

-- `status='dropped'` não tem caminho no app hoje (nenhuma tela escreve isso) —
-- se for implementado, esta policy precisa entrar na lista de valores aceitos.
create policy student_books_start_reading on public.student_books for insert to authenticated
  with check (user_id = auth.uid() and status = 'reading' and current_page = 1);

create policy student_books_start_reading_upsert on public.student_books for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and status = 'reading' and current_page = 1);
