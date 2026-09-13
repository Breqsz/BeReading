// Hoje (spec S7.1, mockup 04): a primeira tela redesenhada do app. Ordem:
// saudacao + anel de nivel -> semana de sequencia + frase -> hero do livro em
// leitura -> acao primaria "Registrar leitura" -> card do assistente
// (condicional) -> fileira "Tambem lendo" (2+ livros) -> linha de nivel/XP.
import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useReadingStore } from '../../src/stores/readingStore';
import { useProgressStore } from '../../src/stores/progressStore';
import { ProfileErrorState } from '../../src/components/ProfileErrorState';
import {
  getStudentBooks, loadPendingQuizzes, getBookWithChapters, getQuestionsForChapter,
} from '../../src/api/queries';
import { Screen, Button, Banner } from '../../src/ui';
import { space } from '../../src/theme/tokens';
import { effectiveStreak, weekDays } from '../../src/game/streak';
import { streakLine, streakRiskLine, pendingQuizLine, staleBookLine } from '../../src/assistant/lines';
import {
  HomeHeader, StreakWeek, CurrentBookHero, AlsoReadingRow, AssistantCard, LevelFooter,
  HomeSkeleton, HomeEmptyState, currentChapterGoal, daysSinceLastSession, readSessionToday,
  chooseAssistantReason,
} from '../../src/features/home';
import type { Book, Chapter, StudentBook } from '../../src/types/database';

type Entry = StudentBook & { book: Book };

const SEM_STREAK = { current_streak: 0, last_read_date: null as string | null };

export default function HomeScreen() {
  const router = useRouter();
  const { profile, profileStatus } = useAuthStore();
  const { setCurrentBook } = useReadingStore();
  const { xp, level, streak, sessions, refresh: refreshProgress } = useProgressStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<Entry[] | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [pendingChapters, setPendingChapters] = useState<Chapter[]>([]);
  const [pendingQuestionCount, setPendingQuestionCount] = useState(0);

  const load = useCallback(async (userId: string) => {
    setError(null);
    try {
      const [entries] = await Promise.all([
        getStudentBooks(userId),
        refreshProgress(userId),
      ]);
      setBooks(entries);

      const lendo = entries.filter((e) => e.status === 'reading');
      const atual = lendo[0] ?? entries[0] ?? null;
      setCurrentBook(atual ? { studentBook: atual, book: atual.book } : null);

      if (atual) {
        try {
          const withChapters = await getBookWithChapters(atual.book.id);
          setChapters(withChapters?.chapters ?? null);
        } catch {
          setChapters(null);
        }
      } else {
        setChapters(null);
      }

      // BER-54: falhar aqui nao derruba a tela, so o card do assistente some.
      try {
        const pendentes = await loadPendingQuizzes(userId, entries);
        setPendingChapters(pendentes);
        if (pendentes.length > 0) {
          try {
            const perguntas = await getQuestionsForChapter(pendentes[0].id);
            setPendingQuestionCount(perguntas.length);
          } catch {
            setPendingQuestionCount(0);
          }
        } else {
          setPendingQuestionCount(0);
        }
      } catch {
        setPendingChapters([]);
        setPendingQuestionCount(0);
      }
    } catch {
      // Erro (banner): o que ja carregou (books, chapters, progressStore)
      // fica como estava, ninguem zera nada aqui.
      setError('Não foi possível carregar seus dados. Puxe para atualizar.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshProgress, setCurrentBook]);

  useFocusEffect(
    useCallback(() => {
      // BER-45: sem este early return, o `loading` inicial nunca vira false
      // quando o perfil falha, e a aba gira para sempre.
      if (!profile) { setLoading(false); return; }
      load(profile.user_id);
    }, [profile, load]),
  );

  const onRefresh = useCallback(() => {
    if (!profile) return Promise.resolve();
    setRefreshing(true);
    return load(profile.user_id);
  }, [profile, load]);

  if (profileStatus === 'error') return <ProfileErrorState />;

  if (!profile || loading) {
    return (
      <Screen contentStyle={styles.content}>
        <HomeSkeleton />
      </Screen>
    );
  }

  const lendo = books?.filter((e) => e.status === 'reading') ?? [];
  const atual = books ? (lendo[0] ?? books[0] ?? null) : null;
  const outros = atual ? lendo.filter((e) => e.book.id !== atual.book.id) : [];

  const meta = atual && chapters ? currentChapterGoal(chapters, atual.current_page) : null;

  const streakEfetiva = effectiveStreak(streak ?? SEM_STREAK);
  const leuHoje = readSessionToday(sessions);

  const pendingQuiz = pendingChapters.length > 0
    ? {
      chapterId: pendingChapters[0].id,
      chapterNumber: pendingChapters[0].number,
      questionCount: pendingQuestionCount,
    }
    : null;

  const motivo = atual ? chooseAssistantReason({
    pendingQuiz,
    streak: streakEfetiva,
    readToday: leuHoje,
    staleDays: daysSinceLastSession(sessions, atual.book.id),
  }) : null;

  let assistantText: string | null = null;
  let assistantCta: { label: string; onPress: () => void } | null = null;
  if (motivo?.kind === 'quiz') {
    assistantText = pendingQuizLine(motivo.chapterNumber, motivo.questionCount);
    assistantCta = { label: 'Responder agora', onPress: () => router.push(`/quiz/${motivo.chapterId}`) };
  } else if (motivo?.kind === 'streakRisk') {
    assistantText = streakRiskLine(motivo.hoursLeft);
  } else if (motivo?.kind === 'stale') {
    assistantText = staleBookLine(motivo.days);
  }

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh} contentStyle={styles.content}>
      {error ? <Banner tone="danger" message={error} onRetry={onRefresh} /> : null}

      <HomeHeader
        name={profile.display_name}
        level={level}
        onPressRing={() => router.push('/(tabs)/perfil')}
      />

      {books === null ? null : books.length === 0 ? (
        <HomeEmptyState onExplore={() => router.push('/(tabs)/catalogo')} />
      ) : (
        <>
          <StreakWeek days={weekDays(sessions)} streakText={streakLine(streakEfetiva)} />

          {atual ? (
            <>
              <CurrentBookHero
                book={atual.book}
                currentPage={atual.current_page}
                goal={meta}
                onPress={() => router.push(`/book/${atual.book.id}`)}
              />
              <Button icon={BookOpen} onPress={() => router.push('/register-reading')}>
                Registrar leitura
              </Button>
            </>
          ) : null}

          {assistantText ? (
            <AssistantCard
              text={assistantText}
              ctaLabel={assistantCta?.label}
              onPressCta={assistantCta?.onPress}
            />
          ) : null}

          {outros.length > 0 ? (
            <AlsoReadingRow
              books={outros.map((e) => ({
                id: e.book.id, title: e.book.title, author: e.book.author, cover_url: e.book.cover_url,
              }))}
              onPressBook={(id) => router.push(`/book/${id}`)}
            />
          ) : null}

          <LevelFooter level={level} xp={xp} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.sm, gap: space.xxl },
});
