// Capitulo fechado (spec S7.3, F4 Tarefa 6): substitui o Alert.alert("Capitulo
// completo!") antigo, no momento mais importante do produto. A apresentacao
// (fullScreenModal) e configurada em app/_layout.tsx.
//
// Aqui ficam dado e navegacao; a composicao vem de src/features/chapter-complete.
// O XP sai do progressStore, que o sheet de registrar leitura recalcula antes de
// navegar pra ca (spec S7.2 e S8). Os numeros dos capitulos saem do banco,
// porque os params so trazem ids (F4-15).
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProgressStore } from '../src/stores/progressStore';
import { getChaptersByIds } from '../src/api/queries';
import { quizInviteLine } from '../src/assistant/lines';
import { Button, Screen } from '../src/ui';
import {
  ChapterCompleteSkeleton, ClosedChapterHeader, GainTags, XpRing, chapterCompleteLayout,
  chapterTargets, closedTitle, parseParams, streakTagLabel, xpGained, xpPlan, xpTagLabel,
  type ChapterCompleteRawParams,
} from '../src/features/chapter-complete';
import type { Chapter } from '../src/types/database';

type Carga = { estado: 'carregando' } | { estado: 'pronto'; capitulos: Chapter[] | null };

export default function ChapterCompleteScreen() {
  const router = useRouter();
  const bruto = useLocalSearchParams<ChapterCompleteRawParams>();

  // Lidos uma vez, na montagem. Os params de uma rota montada nao mudam, e o XP
  // fica congelado de proposito: um refresh no meio da tela mudaria o alvo e
  // reiniciaria a contagem.
  const [params] = useState(() => parseParams(bruto));
  const [progresso] = useState(() => {
    const { xp, level, carregado } = useProgressStore.getState();
    return { xp, level, carregado };
  });

  const ids = params.chapterIds;
  const [carga, setCarga] = useState<Carga>(() =>
    ids.length > 0 ? { estado: 'carregando' } : { estado: 'pronto', capitulos: null },
  );

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelado = false;
    getChaptersByIds(ids)
      .then((capitulos) => {
        if (!cancelado) setCarga({ estado: 'pronto', capitulos });
      })
      // F4-15: sem os numeros a tela segue, sem inventar nenhum.
      .catch(() => {
        if (!cancelado) setCarga({ estado: 'pronto', capitulos: null });
      });
    return () => {
      cancelado = true;
    };
  }, [ids]);

  // back, nunca replace da pilha: volta pra onde o leitor abriu o registro. Existe
  // tambem durante o carregamento (F4-26): sair nao depende dos capitulos, e uma
  // consulta pendurada deixaria o leitor num fullScreenModal sem saida no iOS.
  const depois = <Button variant="ghost" onPress={() => router.back()}>Depois</Button>;

  if (carga.estado === 'carregando') {
    return (
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <ChapterCompleteSkeleton>{depois}</ChapterCompleteSkeleton>
      </Screen>
    );
  }

  const alvos = chapterTargets(ids, carga.capitulos);
  const quiz = alvos.quizChapterId;
  const plano = xpPlan({
    xpBefore: params.xpBefore,
    gained: xpGained(params.pagesRead) ?? 0,
    storeXp: progresso.xp,
    storeLevel: progresso.level,
    loaded: progresso.carregado,
  });

  return (
    <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
      <View style={chapterCompleteLayout.corpo}>
        <ClosedChapterHeader
          title={closedTitle(alvos.numbers, ids.length)}
          invite={quiz ? quizInviteLine() : null}
        />
        {plano ? <XpRing plan={plano} /> : null}
        <GainTags xp={xpTagLabel(params.pagesRead)} streak={streakTagLabel(params.streak)} />
      </View>
      <View style={chapterCompleteLayout.acoes}>
        {/* replace: a conquista nao fica na pilha atras do quiz. */}
        {quiz ? <Button onPress={() => router.replace(`/quiz/${quiz}`)}>Bora pro quiz</Button> : null}
        {depois}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A moldura (miolo no centro, botoes embaixo) precisa da altura inteira.
  content: { flexGrow: 1 },
});
