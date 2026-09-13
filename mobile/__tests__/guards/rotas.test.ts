import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Guarda de rotas — nasceu de um defeito real da F3 (BER-77).
 *
 * A F3 trocou `app/reading-success.tsx` por um `<Redirect href="/" />` com a
 * justificativa, escrita no plano, de que a rota so existia pra nao quebrar
 * link antigo. Era falso: `app/register-reading.tsx` navegava pra la em duas
 * linhas. O resultado foi o caminho MAIS COMUM do app — registrar leitura sem
 * fechar capitulo — largando o usuario na Home sem confirmacao nenhuma.
 *
 * Nenhuma suite pegou. Cada arquivo, sozinho, estava certo: a tela redirecionava
 * como o codigo dizia, e o register-reading navegava como sempre navegou. O
 * defeito so existe no par. Guarda por arquivo nao ve par, entao esta guarda le
 * o grafo: quem navega pra onde, e o que tem do outro lado.
 *
 * Limite conhecido e aceito: so enxerga alvo em string literal. Rota montada com
 * template (`/book/${id}`) fica de fora. Cobrir isso pediria analise de AST, e o
 * ganho nao paga — o defeito que aconteceu foi com literal.
 */

const RAIZ = join(__dirname, '..', '..');
const APP = join(RAIZ, 'app');

function rotasNoDisco(dir = 'app'): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((nome) => {
    const caminho = join(RAIZ, dir, nome);
    if (statSync(caminho).isDirectory()) return rotasNoDisco(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const ARQUIVOS = rotasNoDisco();

/** `app/(tabs)/catalogo.tsx` -> `/(tabs)/catalogo` e `/catalogo`. Grupo entre
 *  parenteses nao aparece na URL, entao a mesma tela responde pelos dois. */
function urlsDe(arquivo: string): string[] {
  const semExt = arquivo.replace(/^app/, '').replace(/\.tsx$/, '');
  const comIndex = semExt.replace(/\/index$/, '') || '/';
  const semGrupo = comIndex.replace(/\/\([^)]+\)/g, '') || '/';
  return [...new Set([comIndex, semGrupo])];
}

const MAPA = new Map<string, string>();
for (const arquivo of ARQUIVOS) {
  if (/_layout\.tsx$/.test(arquivo)) continue;
  for (const url of urlsDe(arquivo)) {
    if (!MAPA.has(url)) MAPA.set(url, arquivo);
  }
}

/** Alvos de navegacao escritos como string literal em `app/`. */
function alvosDe(codigo: string): string[] {
  const achados = [
    ...codigo.matchAll(/pathname:\s*'([^']+)'/g),
    ...codigo.matchAll(/router\.(?:push|replace|navigate)\(\s*'([^']+)'/g),
    ...codigo.matchAll(/href=\{?['"]([^'"]+)['"]/g),
  ];
  return [...new Set(achados.map((m) => m[1]).filter((u) => u.startsWith('/')))];
}

const NAVEGACOES = ARQUIVOS.flatMap((arquivo) =>
  alvosDe(readFileSync(join(RAIZ, arquivo), 'utf8')).map((alvo) => ({ arquivo, alvo }))
);

/** Componente cujo corpo inteiro e um `<Redirect ...>`, sem ramo nenhum. */
function soRedireciona(codigo: string): boolean {
  const semComentario = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (!/\bRedirect\b/.test(semComentario)) return false;
  const retornos = [...semComentario.matchAll(/return\s*(\(\s*)?<\s*(\w+)/g)].map((m) => m[2]);
  return retornos.length > 0 && retornos.every((tag) => tag === 'Redirect');
}

describe('guarda: o grafo de navegacao aponta pra tela de verdade', () => {
  it('existe navegacao com alvo literal pra vigiar', () => {
    // Se este numero cair pra zero, a extracao quebrou e as duas checagens
    // abaixo viraram it.each de lista vazia, que passa sem testar nada.
    expect(NAVEGACOES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(NAVEGACOES.map(({ arquivo, alvo }) => [`${arquivo} -> ${alvo}`, alvo] as const))(
    '%s cai numa rota que existe',
    (_titulo, alvo) => {
      expect(MAPA.get(alvo)).toBeDefined();
    }
  );

  it.each(NAVEGACOES.map(({ arquivo, alvo }) => [`${arquivo} -> ${alvo}`, alvo] as const))(
    '%s cai numa tela que mostra algo, nao num redirect mudo',
    (_titulo, alvo) => {
      const destino = MAPA.get(alvo);
      if (!destino) return; // ja reprovou na checagem de cima
      const codigo = readFileSync(join(RAIZ, destino), 'utf8');
      expect({ destino, soRedireciona: soRedireciona(codigo) }).toEqual({
        destino,
        soRedireciona: false,
      });
    }
  );
});

describe('guarda: a leitura de rota funciona', () => {
  it('resolve grupo, index e raiz', () => {
    expect(urlsDe('app/(tabs)/index.tsx')).toEqual(['/(tabs)', '/']);
    expect(urlsDe('app/(tabs)/catalogo.tsx')).toEqual(['/(tabs)/catalogo', '/catalogo']);
    expect(urlsDe('app/reading-success.tsx')).toEqual(['/reading-success']);
  });

  it('reconhece o redirect mudo que causou o defeito da F3', () => {
    const defeito = `
      import { Redirect } from 'expo-router';
      export default function Tela() {
        return <Redirect href="/" />;
      }
    `;
    expect(soRedireciona(defeito)).toBe(true);
  });

  it('nao confunde tela que redireciona so num ramo', () => {
    const legitimo = `
      export default function Tela({ logado }) {
        if (!logado) return <Redirect href="/login" />;
        return <View><Text>oi</Text></View>;
      }
    `;
    expect(soRedireciona(legitimo)).toBe(false);
  });

  it('nao acha redirect em comentario', () => {
    const comentado = `
      // antes isso era um <Redirect href="/" />
      export default function Tela() { return <View />; }
    `;
    expect(soRedireciona(comentado)).toBe(false);
  });

  it('todas as rotas do disco entraram no mapa', () => {
    expect(APP).toBeTruthy();
    const telas = ARQUIVOS.filter((a) => !/_layout\.tsx$/.test(a));
    expect([...new Set(MAPA.values())].sort()).toEqual(telas.sort());
  });
});
