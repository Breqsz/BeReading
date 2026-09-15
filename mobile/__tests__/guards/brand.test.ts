import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

// Mesmas pastas das outras guardas de sistema.
const VIGIADAS = ['src/ui', 'src/assistant', 'src/game', 'app', 'src/features'];

/**
 * Premium nao tem cor nem simbolo proprio (DESIGN.md secoes 9 e 10). O icone de
 * coroa era a marca do Premium no sistema antigo (PR #27). As tres telas abaixo
 * sao do time e migram na F5 (quiz) e na F6 (planos, checkout).
 */
const EXCECAO_COROA = new Set(['app/checkout.tsx', 'app/planos.tsx', 'app/quiz/[chapterId].tsx']);

const COROA = /\bCrown\b/;

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

const ler = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8');
const TODOS = VIGIADAS.flatMap(arquivos);

describe('guarda: marca', () => {
  it.each(TODOS.filter((rel) => !EXCECAO_COROA.has(rel)))('%s nao usa o icone de coroa', (rel) => {
    expect(COROA.test(ler(rel))).toBe(false);
  });

  it.each([...EXCECAO_COROA])('%s: excecao ainda existe e ainda usa a coroa (tire da lista quando migrar)', (rel) => {
    expect(existsSync(join(RAIZ, rel))).toBe(true);
    expect(COROA.test(ler(rel))).toBe(true);
  });
});
