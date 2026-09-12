import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * src/features ainda nao existe: entra na F4, quando os blocos de tela forem
 * criados. Fica fora da lista de proposito ate la — ver designTokens.test.ts
 * pro raciocinio completo (rodada de correcao 1).
 *
 * src/game entrou nesta rodada: LEVEL_TITLES em src/game/xp.ts ("Rato de
 * biblioteca" etc.) e copy de verdade, exibida na tela, e nao tinha guarda
 * nenhuma de emoji/travessao ate agora — a checagem inversa no fim do
 * arquivo foi o que acusou o buraco.
 */
const VIGIADAS = ['src/ui', 'src/assistant', 'src/game'];

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

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
  it.each(VIGIADAS)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem emoji', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(EMOJI.test(codigo)).toBe(false);
  });

  it.each(TODOS)('%s nao tem travessao em codigo', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(TRAVESSAO.test(codigo)).toBe(false);
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
