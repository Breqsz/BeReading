import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * src/features ainda nao existe: entra na F4, quando os blocos de tela forem
 * criados. Fica fora da lista de proposito ate la — ver designTokens.test.ts
 * pro raciocinio completo (rodada de correcao 1).
 */
const VIGIADAS = ['src/ui'];

/**
 * As pastas que o redesign (F2) entregou, mesmo as que esta guarda em
 * particular nao varre: accessibilityRole/Label so faz sentido em JSX
 * (.tsx), e src/assistant e src/game sao .ts puro, sem Pressable nenhum —
 * por isso VIGIADAS acima fica so com src/ui. Mas para a checagem inversa no
 * fim do arquivo (pasta nova nasce coberta ou acusa), as tres precisam
 * aparecer como "com dono conhecido", senao a checagem acusaria pastas que
 * ja existem e ja sao cobertas pelas outras duas guardas (copy,
 * designTokens) por engano.
 */
const PASTAS_DO_REDESIGN = ['src/ui', 'src/assistant', 'src/game'];

/** Pastas do sistema "Luminous Library" anterior, que ainda nao migraram
 * (saem na F6). Lista compartilhada pelas tres guardas deste diretorio. */
const LEGADO = ['src/components', 'src/api', 'src/lib', 'src/stores', 'src/types', 'src/utils', 'src/theme'];

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
  it.each(VIGIADAS)('a pasta %s tem arquivo para varrer', (dir) => {
    expect(arquivos(dir).length).toBeGreaterThan(0);
  });

  it.each(TODOS)('%s: se tem Pressable, declara role e label', (rel) => {
    const conteudo = readFileSync(join(RAIZ, rel), 'utf8');
    if (!/<Pressable|AnimatedPressable/.test(conteudo)) return;
    expect(conteudo).toMatch(/accessibilityRole=/);
    expect(conteudo).toMatch(/accessibilityLabel[=:]/);
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
