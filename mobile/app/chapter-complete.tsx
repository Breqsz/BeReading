// Capítulo fechado (spec S7.3): rota nova desta fase. Substitui o
// Alert.alert("Capítulo completo!") antigo. A apresentação (fullScreenModal)
// é configurada em app/_layout.tsx.
//
// Aqui é só placeholder (Tarefa 4): a rota já existe com o contrato de params
// certo, mas o conteúdo real (anel de XP contando de xpBefore até o XP atual,
// chips de "+X XP" e sequência, qual capítulo abre o quiz quando chapterIds
// tem mais de um, texto de subida de nível) é da F4.
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, Button, Glyph } from '../src/ui';
import { space } from '../src/theme/tokens';

export default function ChapterCompleteScreen() {
  const router = useRouter();

  // Recebidos para o contrato da rota já sair certo (chapterIds, bookId,
  // pagesRead, streak, xpBefore vêm de router.replace('/chapter-complete', …)
  // no sheet de registrar leitura, spec S7.2). Quem os consome é a F4.
  useLocalSearchParams<{
    chapterIds?: string;
    bookId?: string;
    pagesRead?: string;
    streak?: string;
    xpBefore?: string;
  }>();

  return (
    <Screen scroll={false}>
      <View style={styles.centro}>
        <Glyph size={40} />
        <Text variant="title">Capítulo fechado</Text>
        <Button onPress={() => router.back()}>Voltar</Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centro: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
});
