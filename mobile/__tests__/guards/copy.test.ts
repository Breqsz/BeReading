import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * Pastas onde o sistema novo ja vale, e que hoje tem pelo menos um arquivo
 * real. Ver designTokens.test.ts pro raciocinio completo de por que
 * src/features fica fora desta lista especifica e entra so em VIGIADAS.
 *
 * src/game entrou nesta rodada: LEVEL_TITLES em src/game/xp.ts ("Rato de
 * biblioteca" etc.) e copy de verdade, exibida na tela, e nao tinha guarda
 * nenhuma de emoji/travessao ate agora — a checagem inversa no fim do
 * arquivo foi o que acusou o buraco.
 */
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'src/assistant', 'src/game', 'app'];

/**
 * F4 (Tarefa 1): `app/` e `src/features` sao onde as tarefas seguintes desta
 * fase escrevem tela nova. src/features ainda nao existe (nasce na Tarefa 2)
 * e entra aqui mesmo vazia, pelo mesmo motivo de designTokens.test.ts: nasce
 * coberta desde o primeiro arquivo, sem depender de lembranca futura.
 */
const VIGIADAS = [...VIGIADAS_COM_CONTEUDO, 'src/features'];

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

/**
 * As telas antigas de `app/` que ainda nao migraram. Mesma lista e mesmo
 * raciocinio de designTokens.test.ts (arquivo inteiro fica de fora ate ser
 * reescrito, porque a reescrita troca a tela inteira). Repetida aqui porque
 * cada guarda deste diretorio e standalone — ver aquele arquivo pro
 * raciocinio completo de quem entra e quem fica de fora (chapter-complete,
 * reading-success e os tres _layout.tsx nao entram).
 */
const EXCECAO_APP_LEGADO = new Set([
  'app/(auth)/confirm-email.tsx',
  'app/(auth)/login.tsx',
  'app/(auth)/signup.tsx',
  'app/(tabs)/catalogo.tsx',
  'app/(tabs)/index.tsx',
  'app/(tabs)/livros.tsx',
  'app/(tabs)/perfil.tsx',
  'app/book/[id].tsx',
  'app/quiz/[chapterId].tsx',
  'app/quiz/summary.tsx',
  'app/register-reading.tsx',
  // Volta da F3: o redirect que substituiu esta tela apagou a confirmacao do
  // caminho mais comum do app. Sai da lista quando a F4 Tarefa 5 apagar o
  // arquivo.
  'app/reading-success.tsx',
]);

/**
 * Emoji e travessao: proibidos em texto de interface (DESIGN.md, secao Voice).
 * A faixa de bandeira (Regional Indicator Symbols, U+1F1E6-U+1F1FF) fica ABAIXO
 * da faixa de simbolos e pictogramas (U+1F300+); sem ela, uma bandeira como
 * 🇧🇷 passa pela guarda inteira.
 */
const EMOJI = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const TRAVESSAO = /[—–]/;

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * So o que vira texto na tela. Comentario pode ter travessao. Alem de `//` e
 * `*` (linha de continuacao de bloco), tambem ignora `/*`: sem isso a primeira
 * linha de um comentario de bloco escapa do filtro e um travessao legitimo
 * logo depois de `/**` reprovaria a guarda.
 */
function linhasDeCodigo(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
}

describe('guarda: copy', () => {
  // Checagem por pasta, nao agregada: ver designTokens.test.ts (rodada de
  // correcao 1) pro raciocinio completo de por que o total sozinho nao basta.
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  // src/features fica de fora do it.each acima de proposito: ver
  // designTokens.test.ts. Este teste afirma o vazio atual em vez de so pular
  // a checagem, e vira tripwire quando a Tarefa 2 criar o primeiro arquivo.
  it('src/features ainda esta vazia nesta tarefa (Tarefa 2 cria o primeiro arquivo)', () => {
    expect(arquivos('src/features').length).toBe(0);
  });

  it.each(TODOS)('%s nao tem emoji', (rel) => {
    if (EXCECAO_APP_LEGADO.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(EMOJI.test(codigo)).toBe(false);
  });

  it.each(TODOS)('%s nao tem travessao em codigo', (rel) => {
    if (EXCECAO_APP_LEGADO.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(TRAVESSAO.test(codigo)).toBe(false);
  });
});

/**
 * A lista de excecao precisa provar que esta viva: falha assim que um
 * arquivo listado deixar de existir, em vez de continuar "protegendo" uma
 * tela que ja migrou ou sumiu (lixo que finge cobertura).
 */
describe('guarda: excecao de app/ legado nao aponta pra arquivo fantasma', () => {
  it.each([...EXCECAO_APP_LEGADO])('excecao %s ainda existe', (rel) => {
    expect(existsSync(join(RAIZ, rel))).toBe(true);
  });
});

/**
 * O buraco: nada aqui acusava uma pasta nova sob src/ que ninguem catalogou
 * (foi assim que src/game ficou de fora desta guarda ate agora, mesmo tendo
 * copy de verdade). Enumera as pastas REAIS de primeiro nivel e falha em
 * qualquer uma que nao esteja nem em VIGIADAS nem em LEGADO.
 */
describe('guarda: pasta nova nasce coberta ou acusa', () => {
  it('todo diretorio de primeiro nivel de src/ esta em VIGIADAS ou em LEGADO', () => {
    const raizSrc = join(RAIZ, 'src');
    const dirs = readdirSync(raizSrc).filter((nome) => statSync(join(raizSrc, nome)).isDirectory());
    const conhecidas = new Set([...VIGIADAS, ...LEGADO].map((p) => p.replace('src/', '')));
    for (const dir of dirs) {
      expect(conhecidas.has(dir)).toBe(true);
    }
  });
});
