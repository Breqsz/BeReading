# Deploy — runbook

Produção é o projeto Supabase `asfdkzejtuqcgqdcsnac`. Tudo que chega nele (migrations e
Edge Functions) passa pelo workflow `.github/workflows/deploy.yml`, criado na BER-50.

## Como funciona

| Quando | O que acontece |
|---|---|
| PR aberto | `ci.yml` roda type-check e testes (mobile e functions) e o check `migration-safety` |
| Merge no `main` | `ci.yml` roda de novo; se passar, dispara `deploy.yml` |
| Manual | Actions → **Deploy** → **Run workflow** (ou `gh workflow run deploy.yml`) |

Passos do `deploy.yml`, em ordem. Se um falhar, os seguintes não rodam:

1. **Dry run das migrations:** `supabase start` + `supabase db reset` aplicam todas as
   migrations do zero num Postgres local do runner. Erro aqui não chega em produção.
2. **Migrations em produção:** `supabase db push --db-url "$SUPABASE_DB_URL"`. Aplica só os
   arquivos de `supabase/migrations/` que ainda não constam no histórico do banco.
3. **Edge Functions:** `supabase functions deploy` de cada pasta em `supabase/functions/`
   (exceto `_shared`), com `--no-verify-jwt`. A autenticação é feita no código
   (`_shared/auth.ts`), não no gateway.
4. **Smoke test:** chama cada function sem credencial. `500` ou timeout falham o job.

O deploy **não faz rollback**. Se o smoke test falhar, a versão nova já está no ar e a
correção é um novo PR (ou reimplantar a versão anterior manualmente).

## Regras

- **Schema só muda por migration mergeada.** Não aplique SQL de schema pelo SQL Editor, pelo
  MCP ou pela CLI local em produção. Uma migration aplicada fora do pipeline entra no histórico
  com outro número e o próximo `db push` para com
  `Remote migration versions not found in local migrations directory`.
- **Migration destrutiva exige reconhecimento.** Arquivo novo com `DROP TABLE`, `DROP COLUMN`,
  `TRUNCATE` ou `DELETE FROM` falha o check `migration-safety` no PR, a menos que contenha um
  comentário `-- allow-destructive: <motivo>`. Como o deploy é automático, ninguém revisa o SQL
  entre o merge e a produção.
- **Migrations precisam rodar do zero.** O dry run aplica tudo num banco vazio; uma migration
  que depende de estado que só existe em produção quebra o deploy no passo 1.
- **Secrets das functions** (`AI_PROVIDER`, `AI_API_KEY`, `ANTHROPIC_API_KEY` etc.) não são
  gerenciados pelo pipeline; continuam sendo definidos com `supabase secrets set`.

## Secrets do GitHub Actions

Settings → Secrets and variables → Actions:

| Secret | Usado em | Como obter |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | deploy das Edge Functions | Dashboard → avatar → Access Tokens. Escopo: projeto BeReading, Full access |
| `SUPABASE_DB_URL` | `db push` | Projeto → **Connect** → **Direct** → **Session pooler** (porta 5432), com a senha do banco |
| `SUPABASE_ANON_KEY` | smoke test | Project Settings → API Keys |
| `BACKUP_ENCRYPTION_KEY` | `backup.yml` (criptografia do backup) | Gerada pelo time; cópia obrigatória no gerenciador de senhas. Ver [Backup e restauração](#backup-e-restauração) |

Ao gravar, evite espaço ou quebra de linha no final do valor. No PowerShell:

```powershell
$v = Read-Host "Valor" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToGlobalAllocUnicode($v)).Trim()
gh secret set NOME_DO_SECRET --body $plain
```

### `SUPABASE_DB_URL`

- Use o **Session pooler**. A conexão direta (`db.<ref>.supabase.co`) só responde por IPv6, e
  os runners do GitHub não têm IPv6. O Transaction pooler (porta 6543) não funciona bem com
  `db push`.
- Troque `[YOUR-PASSWORD]` inteiro, colchetes inclusive.
- Caracteres especiais da senha precisam ir codificados na URL (`@` → `%40`, `#` → `%23`,
  `/` → `%2F`, `:` → `%3A`).
- Se a senha do banco for resetada, este secret precisa ser atualizado.

### Rotação do `SUPABASE_ACCESS_TOKEN`

Tokens do Supabase expiram (o atual foi criado com validade de 1 mês). Para rotacionar:

1. Gere um token novo com o mesmo escopo.
2. Atualize o secret no GitHub.
3. Dispare o deploy manualmente e confirme que passou.
4. Só então revogue o token antigo.

Use tokens diferentes para o GitHub Actions e para ferramentas locais (MCP, CLI), para que
revogar um não derrube o outro.

## Backup e restauração

O projeto está no **plano gratuito do Supabase, que não faz backup**. Até migrar para o Pro
(gatilho e passos na BER-83), o backup é feito pelo workflow `.github/workflows/backup.yml`.

### Como funciona

- **Quando:** todo dia às 06:00 UTC (03:00 em São Paulo), ou manualmente em Actions →
  **Backup** → **Run workflow**.
- **O que exporta:** três arquivos via `supabase db dump`:
  - `roles.sql`: papéis do banco;
  - `schema.sql`: estrutura;
  - `data.sql`: dados, **incluindo as contas (`auth.users`)**. O `vault` fica de fora.
- **Criptografia:** os três arquivos viram um `.tar.gz`, criptografado com GPG (AES-256) usando o
  secret `BACKUP_ENCRYPTION_KEY`. Só o arquivo `.gpg` sai do runner.
- **Verificação:** o próprio job descriptografa a cópia, restaura num Supabase local vazio e
  compara a contagem de `auth.users`, `profiles`, `reading_sessions`, `answers`,
  `student_books` e `subscriptions` com a de produção. O log mostra só "confere" ou "diverge".
- **Onde fica:** artefato `bereading-db-AAAAMMDD-HHMM` da execução, **por 14 dias**.

**O repositório é público.** Artefatos e logs das execuções podem ser vistos por qualquer
pessoa logada no GitHub. Por isso a cópia só existe criptografada e o log nunca mostra dados.
Não altere o workflow para imprimir conteúdo, contagens ou subir arquivos em claro.

### A chave

- **Quem guarda:** o Nikolas, com cópia obrigatória no gerenciador de senhas do time.
- **Por que a cópia é obrigatória:** o secret do GitHub não pode ser lido de volta. Sem a
  cópia fora do GitHub, os backups não abrem.
- **Trocar a chave:** gere uma nova, atualize o secret e o gerenciador. **Guarde a antiga
  por 14 dias**: os backups anteriores à troca continuam criptografados com ela.

Para gerar uma chave (PowerShell):

```powershell
$bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$key = [Convert]::ToBase64String($bytes)
Set-Clipboard $key   # cole no gerenciador de senhas e no secret; não salve em arquivo
gh secret set BACKUP_ENCRYPTION_KEY --body $key
```

### Restaurar

Restaurar **sobrescreve produção**. Faça só com o time avisado, de preferência depois de
testar a mesma cópia num Supabase local (passos 1 a 4 abaixo, trocando o destino).

1. Baixe o artefato em Actions → **Backup** → execução do dia → **Artifacts** (ou
   `gh run download <id> -n bereading-db-AAAAMMDD-HHMM`).
2. Descriptografe (pede a chave do gerenciador de senhas):
   ```bash
   gpg --decrypt --output bereading-db.tar.gz bereading-db-AAAAMMDD-HHMM.tar.gz.gpg
   tar -xzf bereading-db.tar.gz   # gera roles.sql, schema.sql e data.sql
   ```
3. Aponte para o banco de destino. Para testar localmente, use o banco de um `supabase start`
   num projeto **vazio** (sem migrations): `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
   Para produção, a URI do Session pooler.
4. Restaure na ordem roles → schema → dados, numa transação só:
   ```bash
   psql "$DESTINO" --single-transaction -v ON_ERROR_STOP=1 \
     -f roles.sql -f schema.sql \
     -c 'SET session_replication_role = replica' \
     -f data.sql
   ```
5. Confira login de uma conta de teste, contagens principais e o cron `retry-pending-quizzes`.
6. **Apague os arquivos descriptografados** (`.sql` e `.tar.gz`) da máquina. Eles têm dados
   pessoais em claro.

### Limites

- **Perda máxima de até 24h**, o intervalo entre backups.
- **Restauração manual**, com o app fora do ar enquanto roda.
- **Não inclui arquivos do Storage**, só os metadados.
- **Workflows agendados em repositório público são desligados pelo GitHub após 60 dias sem
  atividade no repositório.** Se o projeto ficar parado, confira se o Backup continua ativo
  em Actions.
- **Falha avisa por email** quem fez a última alteração no agendamento do workflow (notificação
  padrão do GitHub para execuções agendadas).

## Troubleshooting

### `Authorization failed for the access token and project ref pair`

Aparece no `supabase link`, que o pipeline **não usa de propósito**: o link lê
`GET /v1/projects/{ref}/api-keys`, e esse endpoint devolve 403 para membros com papel
Administrator na organização, mesmo com token Full access. Se alguém reintroduzir o
`supabase link` no workflow, o erro volta. Os passos atuais não dependem dele.

Para testar um token fora do pipeline:

```powershell
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/asfdkzejtuqcgqdcsnac" -Headers @{ Authorization = "Bearer $plain" }
```

### `password authentication failed for user "postgres"`

Senha errada no `SUPABASE_DB_URL`: colchetes do placeholder, caractere especial sem
codificação ou senha resetada. Ver [`SUPABASE_DB_URL`](#supabase_db_url).

### `Remote migration versions not found in local migrations directory`

O histórico do banco tem versões sem arquivo correspondente no repo, quase sempre porque algo
foi aplicado fora do pipeline. **Não rode o `supabase migration repair` sugerido às cegas.**

1. Liste o histórico no SQL Editor:
   ```sql
   select version, name from supabase_migrations.schema_migrations order by version;
   ```
2. Compare com `supabase/migrations/`. Para cada versão remota sem arquivo, descubra se o
   conteúdo já está coberto por algum arquivo do repo (mesma migration com outro número, ou
   incluída na baseline).
3. Para cada arquivo do repo **sem** versão remota, confira no banco se a mudança já existe.
   Se já existe, o `db push` vai tentar executar de novo e pode falhar ou duplicar efeito.
4. Ajuste só a tabela de histórico (remover versões órfãs, registrar as já aplicadas) e rode
   o deploy.

Foi o que aconteceu no primeiro deploy (14/09/2026): cinco versões remotas estavam cobertas
pela baseline da BER-31, e a BER-72 tinha sido aplicada à mão com outro número. Detalhes na
BER-50.

### Smoke test falhou

O job lista o status de cada function. `500` indica erro de runtime logo na entrada; veja os
logs da function no Dashboard (Edge Functions → nome → Logs). `401`/`400` sem credencial é o
esperado.
