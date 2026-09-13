import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * Pastas .tsx que ja tem arquivo real hoje (accessibilityRole/Label so faz
 * sentido em JSX). app/ entra nesta rodada (F4, Tarefa 1): e onde a fase
 * escreve tela nova, e o app antigo tinha zero accessibilityLabel. Ver
 * designTokens.test.ts pro raciocinio completo de por que src/features fica
 * fora desta lista especifica (so em VIGIADAS, abaixo).
 */
const VIGIADAS_COM_CONTEUDO = ['src/ui', 'app'];

/**
 * src/features ainda nao existe (nasce na Tarefa 2). Entra em VIGIADAS
 * vazia mesmo assim, pelo mesmo motivo das outras duas guardas: nasce
 * coberta desde o primeiro arquivo .tsx, sem depender de lembranca futura.
 */
const VIGIADAS = [...VIGIADAS_COM_CONTEUDO, 'src/features'];

/**
 * As pastas que o redesign (F2-F4) entregou, mesmo as que esta guarda em
 * particular nao varre: accessibilityRole/Label so faz sentido em JSX
 * (.tsx), e src/assistant e src/game sao .ts puro, sem Pressable nenhum —
 * por isso VIGIADAS acima fica sem eles. Mas para a checagem inversa no fim
 * do arquivo (pasta nova nasce coberta ou acusa), as pastas precisam
 * aparecer como "com dono conhecido", senao a checagem acusaria pastas que
 * ja existem e ja sao cobertas pelas outras duas guardas (copy,
 * designTokens) por engano.
 */
const PASTAS_DO_REDESIGN = ['src/ui', 'src/assistant', 'src/game', 'src/features'];

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

/**
 * As telas antigas de `app/` que ainda nao migraram. Mesma lista e mesmo
 * raciocinio de designTokens.test.ts. Repetida aqui porque cada guarda deste
 * diretorio e standalone. Nem toda entrada tem Pressable sem label (por
 * exemplo app/(auth)/login.tsx nao usa Pressable) — mas a excecao e sobre o
 * ARQUIVO como divida de migracao inteira, nao sobre a violacao pontual, e
 * pra quem nao tem Pressable a linha e inofensiva (o teste so roda de
 * verdade quando acha <Pressable ou AnimatedPressable).
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

function arquivos(dir: string): string[] {
  const abs = join(RAIZ, dir);
  let entradas: string[];
  try { entradas = readdirSync(abs); } catch { return []; }
  return entradas.flatMap((nome) => {
    const caminho = join(abs, nome);
    if (statSync(caminho).isDirectory()) return arquivos(join(dir, nome));
    return /\.tsx$/.test(nome) ? [join(dir, nome).replace(/\\/g, '/')] : [];
  });
}

const TODOS = VIGIADAS.flatMap(arquivos);

/**
 * Zero accessibilityLabel no app inteiro foi um dos achados da auditoria. Aqui a
 * regra e grosseira de proposito: todo arquivo que renderiza Pressable precisa
 * declarar role e label em algum lugar. O teste de componente cobre o caso a caso.
 */
describe('guarda: acessibilidade', () => {
  // Checagem por pasta, nao agregada: ver designTokens.test.ts (rodada de
  // correcao 1) pro raciocinio completo de por que o total sozinho nao basta.
  it.each(VIGIADAS_COM_CONTEUDO)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  // src/features fica de fora do it.each acima de proposito: ver
  // designTokens.test.ts. Afirma o vazio atual em vez de so pular a
  // checagem, e vira tripwire quando a Tarefa 2 criar o primeiro arquivo.
  it('src/features ainda esta vazia nesta tarefa (Tarefa 2 cria o primeiro arquivo)', () => {
    expect(arquivos('src/features').length).toBe(0);
  });

  it.each(TODOS)('%s: se tem Pressable, declara role e label', (rel) => {
    if (EXCECAO_APP_LEGADO.has(rel)) return;
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    if (!/<Pressable|AnimatedPressable/.test(conteudo)) return;
    expect(conteudo).toMatch(/accessibilityRole=/);
    expect(conteudo).toMatch(/accessibilityLabel[=:]/);
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
 * O buraco: nada aqui acusava uma pasta nova sob src/ que ninguem catalogou.
 * Enumera as pastas REAIS de primeiro nivel e falha em qualquer uma que nao
 * esteja nem em PASTAS_DO_REDESIGN nem em LEGADO — pasta nova nasce coberta
 * ou acusa.
 */
describe('guarda: pasta nova nasce coberta ou acusa', () => {
  it('todo diretorio de primeiro nivel de src/ esta em PASTAS_DO_REDESIGN ou em LEGADO', () => {
    const raizSrc = join(RAIZ, 'src');
    const dirs = readdirSync(raizSrc).filter((nome) => statSync(join(raizSrc, nome)).isDirectory());
    const conhecidas = new Set([...PASTAS_DO_REDESIGN, ...LEGADO].map((p) => p.replace('src/', '')));
    for (const dir of dirs) {
      expect(conhecidas.has(dir)).toBe(true);
    }
  });
});
