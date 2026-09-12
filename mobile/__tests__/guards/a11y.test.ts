import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const RAIZ = join(__dirname, '..', '..');

/**
 * src/features ainda nao existe: entra na F4, quando os blocos de tela forem
 * criados. Fica fora da lista de proposito ate la — ver designTokens.test.ts
 * pro raciocinio completo (rodada de correcao 1).
 */
const VIGIADAS = ['src/ui'];

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
