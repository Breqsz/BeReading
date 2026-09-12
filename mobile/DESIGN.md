# BeReading: DESIGN.md

> Contrato de marca. Toda UI obedece este arquivo. Direção: **Noturno editorial**,
> público de 18 a 24 anos, dark-first, anti-template.
> Valores canônicos em `src/theme/tokens.ts`. Este documento explica, não duplica a fonte.

## 1. Color

Neutros quentes (tinta e papel) e um acento só. Todo valor de cor em `src/ui`, `src/assistant` e
`src/game` vem de `color` em `src/theme/tokens.ts` — as pastas que a F2 entregou, varridas por
`__tests__/guards`. `app/` e `src/features` (blocos de tela) ainda não existem em código; entram
sob guarda na F4, quando as telas forem migrando. Nada de hex, `rgb()` ou `rgba()` literal fora
de `tokens.ts` nas pastas vigiadas.

| token | valor | uso |
|---|---|---|
| `color.bg` | `#12100E` | fundo das telas |
| `color.surface1` | `#1B1916` | cards, sheets, tab bar |
| `color.surface2` | `#25221E` | inputs, trilhas, botão secundário |
| `color.surface3` | `#302C27` | pressed / selecionado |
| `color.floating` | `#2A2622` | toast, superfície flutuante |
| `color.line` | `rgba(243,237,226,0.08)` | divisória |
| `color.line2` | `rgba(243,237,226,0.14)` | borda de superfície flutuante |
| `color.text` | `#F3EDE2` | texto principal |
| `color.text2` | `#B9B0A3` | texto secundário |
| `color.text3` | `#A0978B` | legenda, desabilitado |
| `color.accent` | `#F0A83A` | progresso e ação primária, apenas |
| `color.accentInk` | `#1B1206` | texto sobre `color.accent` |
| `color.accentSoft` | `rgba(240,168,58,0.14)` | aviso, chip de XP |
| `color.positive` | `#8CC28F` | sucesso |
| `color.positiveSoft` | `rgba(140,194,143,0.14)` | fundo de estado de sucesso |
| `color.danger` | `#EE7B67` | erro, destrutivo |
| `color.dangerSoft` | `rgba(238,123,103,0.14)` | fundo de estado de erro |

O acento `color.accent` `#F0A83A` é o único acento do produto. Uma tela não usa uma segunda cor de
destaque: quando tudo chama atenção, nada chama atenção.

**Âmbar é jogo, neutro é leitura.** O acento marca o progresso da camada de jogo (nível, XP,
sequência); o neutro (`color.text`) marca o progresso de leitura de um livro (capítulo, sessão).
Não é contradição o `Ring` (nível) usar `accent` e a `ProgressBar` (capítulo) usar `text`: são
duas métricas diferentes, e cada uma tem sua cor porque uma tela nunca mistura as duas camadas na
mesma barra.

**Paleta de capas geradas** (`COVER_PALETTE_COLORS`, oito tons: `#5E2A2A` `#2F4A3A` `#22324F`
`#7A5A1E` `#4A2F4F` `#1F4A4F` `#3A3F47` `#7A3B22`), escolhida por hash determinístico do `book.id`.
O texto sobre qualquer uma delas é `COVER_INK` `#F6E9D4`, legível nas oito.

## 2. Typography

Duas famílias com papéis fixos, nunca misturados dentro do mesmo elemento: `fontFamily.serif*`
(Newsreader) fala pela camada do livro, título, pergunta de quiz, citação; `fontFamily.ui*`
(Hanken Grotesk) fala pela interface e pelos números. Todo texto usa uma variante de `type`
(`TypeVariant` em `tokens.ts`); `fontSize` ou `fontFamily` literal fora de `tokens.ts` não existe.

| variante | família · peso | tamanho/linha |
|---|---|---|
| `type.display` | `fontFamily.serifMedium` | 34/38 |
| `type.title` | `fontFamily.serifMedium` | 28/32 |
| `type.heading` | `fontFamily.serifMedium` | 22/28 |
| `type.subhead` | `fontFamily.uiSemi` | 17/24 |
| `type.body` | `fontFamily.ui` | 16/24 |
| `type.reading` | `fontFamily.serif`, itálico | 17/27 |
| `type.callout` | `fontFamily.ui` | 14/20 |
| `type.label` | `fontFamily.uiSemi` | 13/18 |
| `type.caption` | `fontFamily.uiMedium` | 12/16 |
| `type.button` | `fontFamily.uiSemi` | 16/20 |
| `type.numericXL` | `fontFamily.uiBold`, tabular | 40/44 |
| `type.numericL` | `fontFamily.uiBold`, tabular | 28/32 |
| `type.numericM` | `fontFamily.uiBold`, tabular | 20/24 |

Piso: nada abaixo de 12 (`type.caption`, a menor variante, já está nesse piso). Números usam
sempre `fontVariant: ['tabular-nums']`, para não "pular" de largura quando contam. Caixa de frase
em tudo: não existe rótulo em maiúsculas espaçadas. Cada variante carrega seu próprio
`maxFontSizeMultiplier` (entre 1,1 e 1,4), o teto do Dynamic Type que impede o layout de quebrar
quando o usuário aumenta a fonte do sistema.

## 3. Spacing

Escala única em `space`, sempre em múltiplos de 4: `space.xs` 4 · `space.sm` 8 · `space.md` 12 ·
`space.lg` 16 · `space.gutter` 20 · `space.xl` 24 · `space.xxl` 32 · `space.xxxl` 40 · `space.huge`
48. Gutter lateral de tela é sempre `space.gutter`. Gap entre itens de uma lista é `space.md`. Gap
entre seções de uma tela é `space.xxl`.

## 4. Layout

- **Raio** (`radius`): `radius.tag` 6 para tag, `radius.chip` 10 para chip, `radius.control` 14
  para botão e input, `radius.card` 20 para card, `radius.sheet` 28 para sheet, `radius.pill` 999
  para pílula, reservado a chip e ao contador de XP. A capa usa um raio assimétrico próprio, `3 7 7
  3`, lombada à esquerda: não é um token de `radius`, é geometria do componente `Cover`.
- **Elevação** (`elevation`): `elevation.flat` (`{}`) para lista e texto correntes, sem superfície.
  `elevation.surface` (`color.surface1` + borda `color.line`) para card tocável. `elevation.floating`
  (`color.floating` + borda `color.line2` + sombra `0 12 32 rgba(0,0,0,.4)`) para sheet e toast. A
  capa tem sombra própria de objeto, fora de `elevation`. Card de lista não leva sombra: hierarquia
  vem de espaço e divisória, não de profundidade forjada.
- **Toque:** alvo mínimo `MIN_TOUCH` 44×44, com `hitSlop` `{ top: 8, bottom: 8, left: 8, right: 8
  }` quando o elemento visual é menor que isso.

## 5. Components

Os primitivos abaixo já existem em código, em `src/ui`. Este é o contrato que eles cumprem: cada
um lista seus estados. Nenhum estado aqui descrito é opcional a implementar; um primitivo sem o
estado "erro" descrito, por exemplo, ainda entra incompleto.

- **Text**: wrapper de `RNText` por `TypeVariant`. Não tem estado de interação; a única variação é
  a `TypeVariant` e a cor (`color.text`, `color.text2`, `color.text3`, `color.accent`,
  `color.danger`, conforme o contexto).
- **Button**: ação primária (`color.accent` + `color.accentInk`) e secundária
  (`color.surface2` + `color.text`). Estados: default; pressed (`motion.press`: scale 0,98,
  escurece); loading (indicador ao lado do rótulo, que continua visível, sem mudar a largura);
  disabled (`color.text3` sobre `color.surface2`, sem interação). `accessibilityRole="button"` e
  `accessibilityLabel` sempre.
- **IconButton**: mesmo contrato de estado do Button, em alvo quadrado com `MIN_TOUCH`.
  `accessibilityLabel` é obrigatório porque não há texto visível que o substitua.
- **Field**: campo de texto de uma linha. Estados: default (`color.surface2`, borda
  `color.line`); focused (borda `color.text2`, não `accent` — o acento fica reservado a
  progresso e ação primária); error (borda `color.danger` + legenda em `color.danger`, que
  **substitui** a legenda de ajuda, não convive com ela); disabled (`color.text3`).
  `accessibilityLabel` cobre o rótulo do campo.
- **PageField**: variante numérica do Field para "De"/"Até" de página. Mesmos estados do Field,
  mais um estado de valor pré-preenchido (não editado ainda) versus editado, para diferenciar o
  atalho aplicado do valor digitado.
- **Chip**: seleção de baixo compromisso (filtro, atalho de página). `radius.pill`. Estados:
  default (fundo transparente, borda `color.line2`); pressed; selected (invertido: fundo
  `color.text`, texto escuro — tinta clara com texto escuro, não `accentSoft`); disabled.
- **Segmented**: alternância entre poucas opções mutuamente exclusivas. Estados por segmento:
  default; pressed; selected (fundo `color.surface3`, texto `color.text`); disabled. Só um
  segmento selecionado por vez; a troca é instantânea, sem `motion.enter`.
- **Cover**: capa do livro. Capa tipográfica gerada (paleta de capas, seção 1) por padrão; capa
  real (`expo-image`) por cima quando `cover_url` existir, com crossfade de 200 ms na troca.
  Tamanhos nomeados (`size`): `xs` 48, `sm` 74, `md` 108, `lg` 160 — a altura sai sempre da
  proporção 2:3. A prop `width` (número) tem precedência sobre `size` para os tamanhos que as
  telas pedem e a tabela não cobre (52 na Estante, 86 na Hoje, 100 no detalhe do livro); o
  tamanho do título escala com `width` pela mesma proporção da tabela. Estados: loading (skeleton
  no formato da capa, nunca spinner); loaded; error (cai para a capa tipográfica gerada, nunca
  para um placeholder genérico).
- **Ring**: anel de nível. Estados: default (progresso estático até o valor atual); counting
  (`motion.count`, 600 ms, ease-out, só na conquista de nível); reduced motion (aparece direto no
  valor final, sem contagem). Pressionável quando leva a Você: nesse caso segue os estados de
  pressed do Button.
- **ProgressBar**: barra linear (progresso de capítulo, resumo de registro). Estados: default;
  updating (anima até o novo valor com `motion.count` quando o valor muda por uma ação do usuário,
  sem animar em carregamento inicial). Não existe estado "complete": em 100% o preenchimento
  continua em `color.text`, a cor de progresso de leitura (ver regra de cor da seção 1) — a barra
  não muda de cor por chegar ao fim.
- **Skeleton**: placeholder de carregamento no formato exato do conteúdo final (card, linha,
  capa), nunca um spinner de tela cheia. Único estado: loading, com crossfade `motion.skeleton`
  (200 ms) para o conteúdo real ao terminar.
- **EmptyState**: estante vazia, catálogo sem resultado, sem conquista ainda. Composição: texto
  de voz (seção 7) e CTA opcional. Não é um erro; não usa `color.danger`.
- **Banner**: aviso no topo da tela (erro de rede preservando o que já carregou, aviso de
  reflexão fraca). Duas variantes, não três: `error` (`color.dangerSoft`, texto `color.danger`) e
  `info` (`color.surface1`, texto `color.text2`). Sem dispensar automaticamente: some quando a
  causa é corrigida.
- **ListRow**: linha de lista com divisória (`color.line`), no lugar do card do sistema legado.
  Estados: default; pressed (`color.surface3`) quando a linha é tocável; disabled. Sem sombra,
  sem borda lateral de destaque (anti-pattern, seção 9).
- **Toast**: confirmação transitória (registro salvo, conquista simples), via `ToastProvider`, no
  lugar de `Alert.alert`. Estados: entering (`motion.enter`); visible; exiting (`motion.exit`, ⅔
  da entrada). Não bloqueia interação por trás.

## 6. Motion

Toda animação sai de `motion` em `tokens.ts`; não se inventa duração ou curva nova por tela.

| token | valor |
|---|---|
| `motion.press` | spring, damping 18, stiffness 320, mass 0,6, scale 0,98 |
| `motion.enter` | 240 ms, ease-out, fade + translateY 8 |
| `motion.exit` | 160 ms, ease-in (⅔ da entrada) |
| `motion.stagger` | passo de 40 ms, até 6 itens, só na primeira aparição |
| `motion.count` | 600 ms, ease-out (XP e anel na conquista; única exceção acima de 500 ms) |
| `motion.skeleton` | crossfade de 200 ms |

Transição de tela é nativa (stack, `formSheet`, modal do expo-router), nunca reimplementada.
`useReducedMotion()` reduz tudo a crossfade: sem translate, sem contagem, o anel aparece direto no
valor final. Proibido: `scale(0)`, loop decorativo, animação de layout e saída mais lenta que a
entrada. Haptics: leve para navegação (aba, chip, seleção), médio para ação primária, sucesso para
registro, conquista e nível, erro para falha de envio.

## 7. Voice

Público de 18 a 24 anos. Pode: "pra", "tá", "bora", "mandou bem", frase curta, humor seco. Não
pode: emoji na interface, gíria datada ou de meme, exclamação em série, tratar o leitor como
criança, travessão em copy.

| contexto | copy |
|---|---|
| saudação | "E aí, {nome}" |
| sequência | "{n} dias seguidos. Lê hoje e vira {n+1}." |
| sequência em risco | "Faltam {h}h pra sua sequência zerar. Uma página já conta." |
| capítulo fechado | "Capítulo {n}, fechado." / "Bora ver o que ficou?" |
| nota alta / baixa | "Mandou bem." / "Quase. Olha esse detalhe que passou." |
| subiu de nível | "Nível {n}. Agora você é {título}." |
| vazio | "Estante vazia, por enquanto. Escolhe o primeiro." |
| sem rede | "Caiu a internet. O que você registrou tá salvo." |

**Títulos de nível:** 1 Primeira página, 2 Curioso, 3 Engatado, 4 Constante, 5 Maratonista,
6 Devorador, 7 Rato de biblioteca, 8+ Lenda da estante.

A microcopy honesta dos estados de erro que já existe é preservada no conteúdo e só ganha o
registro de voz novo. Nenhuma copy inventa um número: toda métrica citada vem de dado persistido
(XP, sequência, páginas, nota).

## 8. Brand

**Essência:** BeReading trata a leitura como hábito que se constrói, não como tarefa escolar. A
interface fala como alguém que também lê e não acha isso um sacrifício.

**Direção:** Noturno editorial. Fundo escuro de tinta (`color.bg`), papel quente (`color.text`),
um único acento âmbar (`color.accent`). Serifa (Newsreader) para a camada do livro, sans (Hanken
Grotesk) para a interface: a leitura tem uma voz, o produto tem outra.

**Referências de acabamento:** Spotify Wrapped e BookTok, pelo registro visual jovem e editorial
sem infantilizar. Explicitamente não Duolingo: sem mascote, sem tom de aplicativo escolar.

**Sentimento alvo:** que o app pareça editorial e feito à mão, não um template genérico de
gamificação. Um acento por tela. Métrica real, nunca inflada. Confiança sóbria, sem grito.

## 9. Anti-patterns

Checklist de revisão. **(T)** marca o item coberto por teste automatizado na Tarefa 17.

- Cor literal (hex, `rgb()` ou `rgba()`) fora de `tokens.ts` em `src/ui`, `src/assistant` ou
  `src/game` (T) — `app/` e `src/features` entram sob guarda na F4
- `fontSize` ou `fontFamily` literal fora de `tokens.ts` (T)
- `Alert.alert` fora da lista de exceção (T)
- Emoji em copy de interface (T)
- Travessão, o caractere de em dash ou de en dash, em código: comentário ou string, copy
  incluída (T)
- `Pressable` sem `accessibilityRole` ou sem `accessibilityLabel` (T)
- Lábio 3D (borda inferior grossa)
- Borda lateral de destaque em card
- Sombra em card de lista
- Maiúsculas espaçadas como rótulo
- Mascote, dragão, espada, coroa
- Mais de um acento por tela
- Número inventado: toda métrica sai de dado persistido
- Spinner de tela cheia: o carregamento usa skeleton no formato do conteúdo
- Glow, neon, gradiente roxo, glass em tudo (blur só na tab bar, se usado)
