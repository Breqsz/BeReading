-- BER-72: start_page/end_page em `chapters` viram opcionais.
--
-- Investigação desta issue (10-11/09/2026): nem Open Library nem Google Books
-- expõem paginação por capítulo — nenhuma fonte pública de metadado bibliográfico
-- tem "capítulo 4 começa na página 61". Só dá pra obter o total de páginas da
-- edição. Exigir start_page/end_page em todo capítulo, como o schema fazia até
-- aqui, é incompatível com qualquer livro cadastrado fora do catálogo curado
-- (BER-60): não existe de onde tirar esse dado no cadastro.
--
-- A tabela `valid_pages` já lida bem com NULL (CHECK com NULL é tratado como
-- satisfeito pelo Postgres), então não precisa mudar — só as colunas.

alter table public.chapters alter column start_page drop not null;
alter table public.chapters alter column end_page drop not null;
