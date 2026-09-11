# Migrations históricas (mortas)

Os 5 arquivos deste diretório foram as migrations originais do projeto
(`supabase/migrations/20260323000001` a `...005`). Ficaram desatualizadas em
relação ao banco de produção sem que nenhuma migration nova documentasse a
mudança (pivô B2C `students` → `profiles`, entre outras) — ver BER-31.

Não representam mais o schema real e não devem ser aplicadas. O schema atual
foi reconciliado a partir do banco vivo em `supabase/migrations/20260910210000_baseline_reconciled_from_live.sql`,
que é a fonte única da verdade a partir de 10/09/2026.

Mantidos aqui só como referência histórica de como o schema evoluiu, não
para reexecução.
