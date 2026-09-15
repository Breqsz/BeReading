# Produto — o que o BeReading é, para quem, e o que ele não é

Este documento existe para que ninguém — pessoa ou agente de IA — construa a
coisa errada. O `README.md` diz como rodar; o `AGENTS.md` diz como não quebrar
produção; **este diz o que vale a pena construir.**

> Última revisão: 2026-09-15. Os números de pesquisa foram recalculados da fonte
> nesta data (método no fim do arquivo), não copiados de apresentação.

---

## 1. Em uma frase

**BeReading é um assistente de leitura com IA que ajuda quem quer ler a
realmente ler — e mede se entendeu, sem parecer prova.**

O aluno registra o que leu; ao fechar um capítulo, a IA conversa sobre aquele
capítulo com perguntas de compreensão e de reflexão, dá nota e devolve um
feedback específico. Streaks e medalhas seguram o hábito.

Três escolhas que definem o produto:

1. **Funciona com qualquer livro** — físico ou digital. Não somos um catálogo
   fechado.
2. **A IA não lê por você.** O mercado usa IA para resumir (Blinkist, Headway);
   nós usamos para provocar leitura e verificar compreensão. Se uma feature
   permite pular a leitura, ela é contra o produto.
3. **Não é prova.** O tom é de companheiro de leitura. Feedback automático que
   só elogia não serve — a devolutiva diz o que a pessoa pegou, o que deixou
   passar e o que vale reler (ver o prompt em `evaluate-answer/prompt.ts`).

---

## 2. Para quem

**Hoje (B2C):** quem quer ler mais e não consegue manter o hábito. O foco
declarado é geração Z, mas veja a limitação da amostra em §5 antes de tratar
isso como validado.

**Não é para escola — ainda.** O pivô B2C foi oficializado em **31/08/2026**
(BER-52). O schema ainda tem `schools`, `classrooms`, `teachers`,
`classroom_books` e `classroom_teachers`, e o app tem `ClassroomGateModal`:
é fundação de fase 2 (BER-47), inativa. O design spec escolar está arquivado em
`docs/history/` justamente para não voltar a guiar trabalho.

---

## 3. O problema, com evidência

Pesquisa própria, formulário de jul/2025, **N = 127**:

| Achado | Número |
|---|---|
| Já começou um livro e **não terminou** | **78,0%** (99/127) |
| **Distração** (celular, redes) é o que mais impede de ler | **60,6%** (77/127) |
| Falta de tempo | 52,0% (66/127) |
| **Quer** desenvolver o hábito de leitura | **81,9%** (104/127) — mais 7,1% "talvez" |
| Sente que **esquece o que leu** | 33,9% (43/127) |
| Lê "quase nunca" ou "nunca" | 35,4% (45/127) |
| Deixaram e-mail para testar em primeira mão | 55 |

O que as pessoas querem num app de leitura gamificado:

| Funcionalidade | % que marcou |
|---|---|
| Acompanhar o progresso de leitura | 59,8% |
| Sugestões personalizadas de livros | 57,5% |
| Recompensas por manter o hábito | 47,2% |
| Revisar resumos do que já leu | 44,1% |
| "Currículo de leitura" | 42,5% |
| Fazer quizzes sobre o que leu | 35,4% |

Contexto externo: PISA 2022 (OECD) aponta ~50% dos jovens brasileiros abaixo do
nível básico de leitura.

**Leia o que esses números dizem de verdade:** a demanda é declarada, não
observada. Ninguém pagou nada e ninguém usou nada para responder isso. Trate
como sinal de direção, nunca como tração.

---

## 4. O que NÃO vamos construir agora

Esta lista vale tanto quanto a de features. Se você está prestes a construir
algo daqui, pare e discuta antes.

- **Dashboard de professor / painel de escola.** Fase 2 (BER-47). Foi descrito
  em detalhe no spec arquivado e nunca existiu em código.
- **Resumo do livro gerado por IA.** Contradiz a escolha nº 2 do §1: entrega o
  atalho que o produto existe para combater. Resumo *do que a pessoa já leu e
  respondeu* é outra coisa e é legítimo.
- **Bloqueador de apps do sistema.** Aparece nos materiais antigos de visão. O
  SO não permite de fato; o máximo honesto é um modo foco dentro do app.
- **Chat com personagem do livro.** Boa ideia de marketing, mas exige controle
  de spoiler atado ao progresso de leitura e curadoria para menores. É visão,
  não roadmap.
- **Rede social / feed / ranking público.** Não existe e não está priorizado.
  Não prometa em tela nem em material.
- **Cobrança real.** Hoje é `billing-mock` (BER-79) — ver `AGENTS.md` §3.8.

---

## 5. Limitações honestas desta base

- **A amostra não é o público-alvo declarado.** Das 127 respostas, **42,5% têm
  35 anos ou mais** e apenas **32,3% têm menos de 25**. A maior faixa única é
  20–24 anos (26,8%). Dizer que a pesquisa validou "geração Z" seria falso:
  validar 15–19 é trabalho ainda não feito.
- **A pesquisa é de jul/2025** — mais de um ano atrás, antes do pivô B2C.
- **Uso real ainda é pequeno.** Não meça produto por esta pesquisa; meça pelo
  banco de produção.
- **Preço não foi testado com ninguém.** O valor em `README.md` §Planos é uma
  decisão interna, não um número validado por disposição a pagar.

---

## 6. Onde está o resto do material

Este repositório é **público**. Material de negócio que não pode ser publicado
não mora aqui:

| Material | Onde |
|---|---|
| Respostas brutas do formulário (contêm e-mails de participantes) | **fora do git** — LGPD. `.gitignore` bloqueia `docs/*.csv`, `*.txt`, `*.xlsx` |
| Transcrição da reunião com o professor de literatura | fora do git (voz de terceiro) |
| Pitch, Business Model Canvas, projeções financeiras | repositório privado de documentos |
| Auditoria técnica de jul/2026 (diagnóstico e achados) | repositório privado de documentos; o que virou trabalho está no Linear (BER-27+) |
| Backlog e decisões em andamento | Linear — projeto *Auditoria Técnica — Jul/2026* |

**Regra:** rascunho e discussão vivem fora; **decisão vira arquivo aqui**. Se
uma direção de produto mudou e este arquivo não mudou junto, este arquivo está
errado — conserte-o no mesmo PR.

---

## Método dos números do §3 e §5

Recalculados em 2026-09-15 a partir do CSV original de respostas (N=127, sem
amostragem nem descarte), contando cada opção marcada nas perguntas de múltipla
escolha — separador `;`, porque os rótulos das opções contêm vírgula. Percentual
sobre o total de respondentes, não sobre o total de marcações; por isso as
colunas de múltipla escolha somam mais de 100%. O CSV não está neste repositório
(ver §6).
