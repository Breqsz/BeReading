// Registrar leitura (spec S7.2, mockup 04): o sheet da acao mais frequente do
// app e o gatilho do quiz. A apresentacao (formSheet, detents 0.7 e 1, grabber
// visivel) e configurada em app/_layout.tsx.
//
// Aqui ficam dado, envio e navegacao; a composicao vem de src/features/register.
// A navegacao para a tela de capitulo fechado fica NESTE arquivo, com o
// pathname literal, porque e isso que a guarda de rotas
// (__tests__/guards/rotas.test.ts) le para saber que aquela tela tem quem a
// alcance.
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useReadingStore } from '../src/stores/readingStore';
import { useProgressStore } from '../src/stores/progressStore';
import { registerReadingSession, type RegisterReadingResponse } from '../src/api/edgeFunctions';
import { getBookWithChapters, getStudentBooks } from '../src/api/queries';
import { pickInitialBook, toChoices, type BookChoice } from '../src/utils/registerReading';
import { Banner, Button, EmptyState, Screen, Text, useToast } from '../src/ui';
import { space } from '../src/theme/tokens';
import {
  BookLine, BookPicker, PageRangeFields, QuickRange, ReadingSummary, RepeatedPagesNote,
  RegisterSkeleton, chapterCompleteParams, closingChaptersLabel, ctaLabel, initialStartPage,
  nextChapterEnd, parsePage, quickEndPage, repeatedPagesNote, successToast, summarizeRange,
  type RangeShortcut,
} from '../src/features/register';
import type { Chapter } from '../src/types/database';

/** Os dois atalhos fixos da spec S7.2, em paginas contadas a partir do De. */
const ATALHOS_FIXOS = [10, 20] as const;

function vibrar(tipo: Haptics.NotificationFeedbackType) {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(tipo).catch(() => {});
}

export default function RegisterReadingScreen() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuthStore();
  const { currentBook } = useReadingStore();
  // BER-44: o livro pode vir por parametro (ex.: a partir da tela do livro). A
  // Hoje abre sem parametro, e ai vale pickInitialBook.
  const { bookId } = useLocalSearchParams<{ bookId?: string }>();

  const [choices, setChoices] = useState<BookChoice[]>([]);
  const [selected, setSelected] = useState<BookChoice | null>(null);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const [picking, setPicking] = useState(false);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [sending, setSending] = useState(false);

  const userId = profile?.user_id ?? null;

  // BER-44: sem a lista, o sheet ainda oferece o livro que a Hoje tinha aberto.
  // Lido por ref para uma mudanca no store nao refazer a busca e apagar o que ja
  // foi digitado.
  const reserva = useRef(currentBook);
  reserva.current = currentBook;

  const escolher = useCallback((choice: BookChoice | null) => {
    setSelected(choice);
    setStart(choice ? initialStartPage(choice.studentBook.current_page) : '');
    setEnd('');
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoadingBooks(false);
      return;
    }
    let cancelled = false;
    setLoadingBooks(true);
    setLoadError(false);

    getStudentBooks(userId)
      .then((rows) => {
        if (cancelled) return;
        const list = toChoices(rows);
        setChoices(list);
        escolher(pickInitialBook(list, bookId ?? reserva.current?.book.id ?? null));
      })
      .catch(() => {
        if (cancelled) return;
        if (reserva.current) escolher(reserva.current);
        else setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingBooks(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, bookId, tentativa, escolher]);

  const livroId = selected?.book.id ?? null;
  useEffect(() => {
    setChapters(null);
    if (!livroId) return;
    let cancelled = false;
    getBookWithChapters(livroId)
      .then((b) => {
        if (!cancelled) setChapters(b?.chapters ?? null);
      })
      // Sem capitulos o sheet continua registrando: so somem o atalho de fim de
      // capitulo e o aviso de "fecha o capitulo".
      .catch(() => {
        if (!cancelled) setChapters(null);
      });
    return () => {
      cancelled = true;
    };
  }, [livroId]);

  const resumo = selected
    ? summarizeRange({
        startText: start,
        endText: end,
        totalPages: selected.book.total_pages,
        currentPage: selected.studentBook.current_page,
        chapters,
      })
    : null;

  // Ref alem do estado: dois toques antes do re-render desabilitar o botao
  // registrariam a mesma leitura duas vezes, e pagina repetida conta de novo.
  const enviando = useRef(false);

  async function enviar() {
    if (enviando.current || !userId || !selected || !resumo?.valid) return;
    const { start: de, end: ate, pages } = resumo;
    const livro = selected.book.id;

    // F4-7: o XP de antes e lido ANTES do envio, e so vale com o store ja
    // carregado. Sem carga nenhuma, o zero do estado inicial nao e dado: o
    // param fica de fora e a tela de capitulo fechado mostra o valor pronto.
    const antes = useProgressStore.getState();
    const xpBefore = antes.carregado ? antes.xp : null;

    enviando.current = true;
    setSending(true);

    let resposta: RegisterReadingResponse;
    try {
      resposta = await registerReadingSession(userId, livro, de, ate);
    } catch {
      enviando.current = false;
      setSending(false);
      vibrar(Haptics.NotificationFeedbackType.Error);
      // Os campos ficam como estao. "Tentar" reenvia o que estiver digitado na
      // hora do toque, pela ref, e nao o que estava quando o erro aconteceu.
      toast.show({
        message: 'Não deu pra registrar sua leitura.',
        detail: 'O que você digitou continua aqui.',
        tone: 'danger',
        actionLabel: 'Tentar',
        onAction: () => {
          void enviarAtual.current();
        },
      });
      return;
    }

    vibrar(Haptics.NotificationFeedbackType.Success);

    // Recalcula o progresso antes de sair (spec S7.2 e S8): a Hoje e a tela de
    // capitulo fechado leem numero persistido, nao o de antes do envio.
    try {
      await useProgressStore.getState().refresh(userId);
    } catch {
      // A leitura ja esta salva no servidor; sem o recalculo, a Hoje refaz a
      // carga no proximo foco. Travar o leitor aqui nao ganha nada.
    }

    // F4-10: o caminho sai da resposta do servidor, nunca da previsao que o
    // resumo mostrou.
    if (resposta.completed_chapter_ids.length > 0) {
      router.replace({
        pathname: '/chapter-complete',
        params: chapterCompleteParams({
          completedChapterIds: resposta.completed_chapter_ids,
          bookId: livro,
          start: de,
          end: ate,
          streak: resposta.current_streak,
          xpBefore,
        }),
      });
      return;
    }

    toast.show({ ...successToast(pages, resposta.current_streak), tone: 'positive' });
    router.back();
  }

  const enviarAtual = useRef(enviar);
  enviarAtual.current = enviar;

  if (loadingBooks) {
    return (
      <Screen scroll={false} edges={['bottom']} contentStyle={styles.content}>
        <RegisterSkeleton />
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen scroll={false} edges={['bottom']} contentStyle={styles.content}>
        <Banner
          tone="danger"
          message="Não deu pra carregar seus livros."
          onRetry={() => setTentativa((n) => n + 1)}
        />
      </Screen>
    );
  }

  if (!selected || !resumo) {
    return (
      <Screen scroll={false} edges={['bottom']} contentStyle={styles.content}>
        <EmptyState
          title="Nada em leitura, por enquanto."
          description="Escolhe um livro no catálogo pra começar a registrar."
          actionLabel="Ver catálogo"
          onAction={() => router.replace('/(tabs)/catalogo')}
        />
      </Screen>
    );
  }

  const { book, studentBook } = selected;
  const prefill = initialStartPage(studentBook.current_page);
  const inicio = parsePage(start);
  const fimDoCapitulo = inicio !== null && chapters ? nextChapterEnd(chapters, inicio) : null;

  const atalhos: RangeShortcut[] =
    inicio === null
      ? []
      : [
          ...ATALHOS_FIXOS.map((n) => ({
            label: `+${n}`,
            endPage: quickEndPage(inicio, n, book.total_pages),
          })),
          ...(fimDoCapitulo
            ? [{
                label: `Fim do cap. ${fimDoCapitulo.number} · p. ${fimDoCapitulo.endPage}`,
                endPage: fimDoCapitulo.endPage,
              }]
            : []),
        ];

  const rotuloCta = resumo.valid ? ctaLabel(resumo.pages) : 'Registrar leitura';

  return (
    <Screen scroll={false} edges={['bottom']} contentStyle={styles.content}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text variant="title">Até onde você foi?</Text>

          <BookLine
            book={book}
            currentPage={studentBook.current_page}
            switching={picking}
            onToggleSwitch={choices.length > 1 ? () => setPicking((p) => !p) : undefined}
          />
          {picking ? (
            <BookPicker
              choices={choices}
              selectedId={book.id}
              onChoose={(choice) => {
                escolher(choice);
                setPicking(false);
              }}
            />
          ) : null}

          <PageRangeFields
            start={start}
            end={end}
            onChangeStart={setStart}
            onChangeEnd={setEnd}
            totalPages={book.total_pages}
            startHint={start === prefill && studentBook.current_page > 0 ? 'continua de onde parou' : null}
          />

          {atalhos.length > 0 ? (
            <QuickRange
              shortcuts={atalhos}
              selectedEnd={parsePage(end)}
              onPick={(pagina) => setEnd(String(pagina))}
            />
          ) : null}

          {resumo.valid && resumo.repeatedPages > 0 ? (
            <RepeatedPagesNote text={repeatedPagesNote(resumo.repeatedPages, studentBook.current_page)} />
          ) : null}

          <ReadingSummary
            pages={resumo.valid ? resumo.pages : null}
            xp={resumo.valid ? resumo.xp : null}
            closingLabel={resumo.valid ? closingChaptersLabel(resumo.closing.map((c) => c.number)) : null}
          />

          {resumo.valid ? null : (
            <Text variant="caption" tone="secondary" align="center">{resumo.reason}</Text>
          )}

          <Button
            icon={Check}
            onPress={() => {
              void enviar();
            }}
            loading={sending}
            disabled={!resumo.valid}
            accessibilityLabel={resumo.valid ? rotuloCta : `${rotuloCta}. ${resumo.reason}`}
          >
            {rotuloCta}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xl },
  flex: { flex: 1 },
  scroll: { gap: space.lg, paddingBottom: space.xl },
});
