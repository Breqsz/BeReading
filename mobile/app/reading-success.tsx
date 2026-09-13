// F3 (BER-77): a tela de sucesso de leitura saiu de cena. O fluxo novo é
// toast de "N páginas registradas" (sem capítulo fechado) ou
// router.replace('/chapter-complete', …) (com capítulo fechado) — ambos
// disparados pelo próprio sheet de registrar leitura, spec S7.2. Esta rota
// continua registrada só para não quebrar link antigo, e redireciona à Home.
import { Redirect } from 'expo-router';

export default function ReadingSuccessScreen() {
  return <Redirect href="/" />;
}
