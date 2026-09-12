import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra editorial sem enforcement morre na terceira entrega. Estas guardas sao o
 * que mantem o design system obedecido quando as telas forem migrando (F4 a F6).
 */
const RAIZ = join(__dirname, '..', '..');

/**
 * Pastas onde o sistema novo ja vale. src/components e app/(tabs) entram conforme
 * migram. src/features ainda nao existe: entra na F4, quando os blocos de tela
 * forem criados. Ate la ela fica FORA desta lista de proposito — vigiar pasta
 * inexistente e a mesma ilusao de seguranca que o teste de "varre pelo menos um
 * arquivo" tinha quando a checagem era agregada (ver rodada de correcao 1).
 */
const VIGIADAS = ['src/ui', 'src/assistant', 'src/game'];

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

/**
 * As tres guardas deste arquivo leem so o que vira codigo de verdade, nunca
 * comentario. Sem isso, um comentario que explica por que o componente NAO usa
 * Alert.alert (citando o nome da API) reprova a guarda por engano — quem
 * documenta a decisao certa e punido do mesmo jeito que quem comete o
 * anti-pattern. O mesmo vale para cor: "ver issue #123" tem digitos que passam
 * por hex se o comentario nao for descartado antes do match. Alem de `//` e `*`
 * (linha de continuacao de bloco), tambem ignora `/*`: sem isso a primeira
 * linha de um comentario de bloco escapa do filtro.
 */
function linhasDeCodigo(conteudo: string): string[] {
  return conteudo
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
}

describe('guarda: cor', () => {
  // Checagem por pasta, nao agregada: se TODOS.length>0 dependesse so do total,
  // src/ui podia sumir ou ser renomeada que src/assistant e src/game ainda
  // manteriam o numero positivo, nenhum it.each rodaria pra src/ui e a guarda
  // passaria protegendo nada. Isso acusa pasta renomeada ou movida.
  it.each(VIGIADAS)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s nao tem cor literal fora dos tokens', (rel) => {
    if (EXCECOES_COR.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    const achados = codigo.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [];
    expect(achados).toEqual([]);
  });
});

describe('guarda: tipografia', () => {
  // Sem lista de isencao: os quatro arquivos que antes eram "isentos" (Text,
  // Field, PageField, Cover) nunca tinham fontSize/fontFamily literal — a
  // isencao nao protegia nada e, pior, escondia justamente o arquivo que existe
  // pra acabar com os tamanhos soltos do app antigo. Se um dia precisar mesmo
  // de literal, a guarda acusa e a excecao volta nominal, com motivo escrito
  // (mesma regra do EXCECOES_COR).
  it.each(TODOS)('%s nao tem fontSize nem fontFamily literal', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/fontSize:\s*\d/);
    expect(codigo).not.toMatch(/fontFamily:\s*['"]/);
  });
});

describe('guarda: feedback', () => {
  it.each(TODOS)('%s nao usa Alert.alert', (rel) => {
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/Alert\.alert/);
  });
});
