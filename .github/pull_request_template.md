<!--
Título do PR: tipo(BER-XX): o que muda, no imperativo
  tipos: feat | fix | docs | refactor | test | chore | ci
  ex.: fix(BER-68): impede que reler páginas infle o XP
O título vira a mensagem do commit de merge — precisa se ler bem no `git log`.

Antes de abrir: uma label de tipo (bug | enhancement | documentation), uma label de área
(infra/DR, segurança, mobile-ux, ia-pipeline, testes-CI, produto) e você como responsável.
Trabalho ainda em andamento? Abra como rascunho (draft).

Remova as seções que não se aplicam, em vez de deixá-las vazias.
-->

## Resumo

<!-- Em 1–3 frases: o que este PR entrega, para quem não vai ler o resto. -->

## Contexto

**Issue:** [BER-XX](https://linear.app/tpgn/issue/BER-XX)

<!-- Por que esta mudança é necessária agora. Qual problema resolve, com evidência. -->

## O que muda

<!--
- Mudanças principais, por área (backend, app, banco, CI, docs).
- Decisões tomadas e alternativas descartadas, com o motivo — evita refazer a discussão depois.
-->

## Riscos e rollback

<!--
Obrigatório se toca produção: migrations, Edge Functions, deploy/CI, secrets, auth, cobrança.
- O que pode dar errado e como perceber (qual erro, qual log, qual tela).
- Como desfazer: reverter o PR basta? A migration tem volta? Precisa de passo manual?
Se não toca produção, escreva "Sem impacto em produção" e o porquê.
-->

## Como testar

<!--
Passos que outra pessoa consegue repetir, com o resultado esperado de cada um.
Evidências: link da execução do CI/Actions, prints ou vídeo para mudanças de tela.
Marque honestamente o que NÃO foi testado.
-->

1.

## Fora de escopo / pendências

<!-- O que ficou de fora de propósito e por quê; issues de acompanhamento criadas. -->

## Checklist

- [ ] CI verde
- [ ] Testes adicionados ou atualizados (ou o motivo de não precisar)
- [ ] Documentação atualizada (`README.md`, `docs/`) quando o comportamento ou a operação mudam
- [ ] Migrations: aplicam do zero (`supabase db reset`), destrutivas têm `-- allow-destructive: <motivo>`, nada aplicado direto em produção
- [ ] Nenhum segredo ou dado pessoal em código, logs ou artefatos — **o repositório é público**
- [ ] Labels de tipo e de área, responsável definido
- [ ] Issue do Linear vinculada a este PR e com o status atualizado
