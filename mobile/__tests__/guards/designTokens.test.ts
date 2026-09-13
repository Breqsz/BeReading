import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Regra editorial sem enforcement morre na terceira entrega. Estas guardas sao o
 * que mantem o design system obedecido quando as telas forem migrando (F4 a F6).
 */
const RAIZ = join(__dirname, '..', '..');

/**
 * Pastas onde o sistema novo ja vale, e que hoje tem pelo menos um arquivo
 * real (por isso ficam fora da checagem especial de pasta vazia, logo
 * abaixo). src/components e app/(tabs) entram conforme migram.
 */
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'src/assistant', 'src/game', 'app'];

/**
 * F4 (Tarefa 1): fecha o buraco que a revisao da F2 apontou. `app/` e
 * `src/features` sao exatamente onde as tarefas seguintes desta fase vao
 * escrever tela nova — sem entrar em VIGIADAS agora, tela nova nasceria
 * descoberta (cor literal, fontSize solto, Alert.alert) sem nenhum teste
 * acusar.
 *
 * `src/features` ainda nao existe (nasce na Tarefa 2, quando o primeiro
 * bloco de tela for criado). Ela entra aqui mesmo assim, vazia: a varredura
 * (`arquivos`, abaixo) tolera pasta ausente ou vazia e so vai encontrar
 * arquivo pra valer quando a Tarefa 2 criar o primeiro — nascendo coberta
 * desde o primeiro arquivo, sem depender de alguem lembrar de atualizar esta
 * guarda depois. A checagem "pasta tem arquivo pra varrer" (que existe pra
 * acusar pasta renomeada ou movida) nao faz sentido pra uma pasta que E pra
 * estar vazia agora: por isso ela roda so em VIGIADAS_COM_CONTEUDO, e
 * src/features ganha teste proprio mais abaixo, que afirma o estado atual em
 * vez de so pular a checagem (ver esse teste pra o raciocinio completo).
 */
const VIGIADAS = [...VIGIADAS_COM_CONTEUDO, 'src/features'];

/**
 * Pastas do sistema "Luminous Library" anterior, que ainda nao migraram (saem
 * na F6). Lista compartilhada pelas tres guardas deste diretorio (a11y, copy
 * e esta) — ver a checagem inversa no fim do arquivo.
 */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

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

/**
 * As 13 telas do "Luminous Library" anterior que moram em `app/` (a
 * contagem exclui os _layout.tsx de rota, que sao config de navegacao, nao
 * tela) ainda nao migraram pro design novo — migram uma a uma, ate a F6.
 * Cada entrada aqui e divida DECLARADA: o arquivo inteiro fica de fora das
 * tres guardas deste diretorio ate ser reescrito, porque a reescrita troca a
 * tela inteira (cor, tipografia, feedback juntos), nao um literal de cada
 * vez — diferente de EXCECOES_COR acima, que e uma excecao pontual e
 * permanente (alpha sobre capa), esta e temporal e so encolhe.
 *
 * app/chapter-complete.tsx e app/reading-success.tsx (F3) NAO entram: sao
 * novos e limpos, e por isso respondem pela guarda como qualquer arquivo de
 * VIGIADAS. app/_layout.tsx, app/(auth)/_layout.tsx e app/(tabs)/_layout.tsx
 * (tambem tocados na F3) tambem ficam de fora: nenhum tinha cor, fontSize ou
 * Alert.alert literal de verdade (o unico achado bruto era um travessao
 * dentro de um comentario JSX de app/(tabs)/_layout.tsx, corrigido no
 * arquivo em vez de virar excecao).
 *
 * Lista compartilhada pelas tres guardas deste diretorio. Ela so encolhe: ao
 * migrar uma tela, tire a entrada daqui, nao adicione.
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
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  // src/features nao entra no it.each acima porque HOJE ela deve estar vazia
  // (ver comentario de VIGIADAS). Esta afirma o estado atual em vez de so
  // pular a checagem: no dia que a Tarefa 2 criar o primeiro arquivo, este
  // teste comeca a falhar sozinho e obriga quem migrar a trocar para
  // toBeGreaterThan(0) — nao a apagar a linha silenciosamente.
  it('src/features ainda esta vazia nesta tarefa (Tarefa 2 cria o primeiro arquivo)', () => {
    expect(arquivos('src/features').length).toBe(0);
  });

  it.each(TODOS)('%s nao tem cor literal fora dos tokens', (rel) => {
    if (EXCECOES_COR.has(rel)) return;
    if (EXCECAO_APP_LEGADO.has(rel)) return;
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
  // (mesma regra do EXCECOES_COR). EXCECAO_APP_LEGADO e diferente: e divida
  // de migracao, nao decisao de design, e por isso vale aqui tambem.
  it.each(TODOS)('%s nao tem fontSize nem fontFamily literal', (rel) => {
    if (EXCECAO_APP_LEGADO.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/fontSize:\s*\d/);
    expect(codigo).not.toMatch(/fontFamily:\s*['"]/);
  });
});

describe('guarda: feedback', () => {
  it.each(TODOS)('%s nao usa Alert.alert', (rel) => {
    if (EXCECAO_APP_LEGADO.has(rel)) return;
    const codigo = linhasDeCodigo(readFileSync(join(RAIZ, rel), 'utf8')).join('\n');
    expect(codigo).not.toMatch(/Alert\.alert/);
  });
});

/**
 * A lista de excecao precisa provar que esta viva. Excecao apontando pra
 * arquivo apagado e lixo que finge cobertura: a tela "migrou" (ou sumiu) e a
 * entrada continuou aqui, escondendo que ninguem tirou a divida da lista.
 * Isso apodrece ao longo de seis fases se ninguem checar. Este teste falha
 * assim que um arquivo listado deixar de existir.
 */
describe('guarda: excecao de app/ legado nao aponta pra arquivo fantasma', () => {
  it.each([...EXCECAO_APP_LEGADO])('excecao %s ainda existe', (rel) => {
    expect(existsSync(join(RAIZ, rel))).toBe(true);
  });
});

/**
 * O buraco que as guardas acima nao cobriam: elas so sabem varrer o que ja
 * esta em VIGIADAS. Uma pasta nova sob src/ (ninguem lembrou de adicionar
 * aqui nem em LEGADO) nao acusava nada — nem cor solta, nem fontSize solto,
 * nem Alert.alert eram barrados nela, e o silencio parecia aprovacao. Esta
 * checagem inverte o sentido: enumera as pastas REAIS de primeiro nivel de
 * src/ e falha em qualquer uma que nao esteja nem vigiada nem catalogada
 * como legado. Pasta nova nasce coberta (alguem decide o balde) ou acusa —
 * nunca fica muda.
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
