import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra editorial sem enforcement morre na terceira entrega. Estas guardas sao o
 * que mantem o design system obedecido quando as telas forem migrando (F4 a F6).
 */
const RAIZ = join(__dirname, '..', '..');

/** Pastas onde o sistema novo ja vale. src/components e app/(tabs) entram conforme migram. */
const VIGIADAS = ['src/ui', 'src/features', 'src/assistant', 'src/game'];

/**
 * Excecoes nominais, com motivo. Qualquer adicao aqui precisa de justificativa
 * no PR — a lista curta e o que dá valor a guarda.
 *
 * Banner.tsx NAO entra aqui: ele so usa cor de tokens (color.dangerSoft,
 * color.danger, color.surface1, color.line). Excecao sem uso enfraquece a
 * guarda e convida a proxima excecao desnecessaria.
 */
const EXCECOES_COR = new Set([
  // Sobreposicao sobre a cor da capa (lombada, filete, sombra): nao e cor de
  // marca, e alpha sobre um fundo que muda por livro.
  'src/ui/Cover.tsx',
]);

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try {
    entradas = readdirSync(abs);
  } catch {
    return []; // pasta ainda nao existe nesta fase
  }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx?$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

describe('guarda: cor', () => {
  it('varre pelo menos um arquivo (a guarda nao passa por estar vazia)', () => {
    expect(TODOS.length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem cor literal fora dos tokens', (rel) => {
    if (EXCECOES_COR.has(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    const achados = conteudo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(achados).toEqual([]);
  });
});

describe('guarda: tipografia', () => {
  it.each(TODOS)('%s nao tem fontSize nem fontFamily literal', (rel) => {
    // Os primitivos que consomem o token diretamente sao a fronteira do sistema.
    if (['src/ui/Text.tsx', 'src/ui/Field.tsx', 'src/ui/PageField.tsx', 'src/ui/Cover.tsx'].includes(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    expect(conteudo).not.toMatch(/fontSize:\s*\d/);
    expect(conteudo).not.toMatch(/fontFamily:\s*['"]/);
  });
});

describe('guarda: feedback', () => {
  it.each(TODOS)('%s nao usa Alert.alert', (rel) => {
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    expect(conteudo).not.toMatch(/Alert\.alert/);
  });
});
