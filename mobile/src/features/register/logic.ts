// Logica pura do sheet de registrar leitura (spec S7.2, F4 Tarefa 5). Sem
// React e sem primitivo visual: so dado e conta, para o teste checar produto e
// nao forma.
import type { Chapter } from '../../types/database';
import { XP_PER_PAGE, formatXp } from '../../game/xp';
import { validatePageRange } from '../../utils/validation';
import { pagesAlreadyRead } from '../../utils/registerReading';

export type ChapterPages = Pick<Chapter, 'id' | 'number' | 'end_page'>;

/** Texto do campo virando pagina. Qualquer coisa alem de digito nao e pagina. */
export function parsePage(text: string): number | null {
  return /^\d+$/.test(text) ? Number(text) : null;
}

/** O "De" ja vem na pagina seguinte a ultima registrada. */
export function initialStartPage(currentPage: number): string {
  return String(Math.max(0, currentPage) + 1);
}

/**
 * Atalho "+N": N paginas contadas a partir do De, com o proprio De incluido
 * (De 85, +10 da 94, que sao 10 paginas). Nunca passa do fim do livro.
 */
export function quickEndPage(start: number, pages: number, totalPages: number): number {
  return Math.min(start + pages - 1, totalPages);
}

/**
 * O atalho "Fim do cap. X · p. Y": o capitulo paginado mais proximo cujo fim
 * ainda nao ficou para tras do De. Capitulo sem `end_page` (BER-72) nao vira
 * atalho, porque um fim chutado e pior que nenhum atalho.
 */
export function nextChapterEnd(
  chapters: ChapterPages[],
  start: number,
): { number: number; endPage: number } | null {
  if (!Number.isFinite(start)) return null;
  let proximo: { number: number; endPage: number } | null = null;
  for (const c of chapters) {
    if (typeof c.end_page !== 'number' || c.end_page < start) continue;
    const maisPerto =
      !proximo ||
      c.end_page < proximo.endPage ||
      (c.end_page === proximo.endPage && c.number < proximo.number);
    if (maisPerto) proximo = { number: c.number, endPage: c.end_page };
  }
  return proximo;
}

/**
 * Quais capitulos o registro vai fechar. E PREVISAO, para o resumo avisar antes
 * do envio; quem decide o que de fato fechou e `completed_chapter_ids` na
 * resposta do servidor (F4-10).
 *
 * Espelha `findNewlyCompletedChapters`
 * (supabase/functions/register-reading-session/reading.ts):
 * `end_page > previousMaxPage && end_page <= newMaxPage`, com
 * `newMaxPage = max(previousMaxPage, Ate)`.
 *
 * Diferenca conhecida: o servidor tira `previousMaxPage` do maior `end_page`
 * das sessoes anteriores; o cliente usa `student_books.current_page` como
 * proxy, que e o mesmo valor que o servidor grava depois de cada registro. Se
 * os dois divergirem (dado editado a mao, sessao removida), o aviso pode errar,
 * e a navegacao continua certa porque le a resposta.
 */
export function predictCompletedChapters<T extends ChapterPages>(
  chapters: T[],
  previousMaxPage: number,
  endPage: number,
): T[] {
  const newMaxPage = Math.max(previousMaxPage, endPage);
  return chapters
    .filter(
      (c) => typeof c.end_page === 'number' && c.end_page > previousMaxPage && c.end_page <= newMaxPage,
    )
    .sort((a, b) => a.number - b.number);
}

/** "fecha o capítulo 4", ou todos pelo nome quando sao varios. */
export function closingChaptersLabel(numbers: number[]): string | null {
  if (numbers.length === 0) return null;
  if (numbers.length === 1) return `fecha o capítulo ${numbers[0]}`;
  const antes = numbers.slice(0, -1).join(', ');
  return `fecha os capítulos ${antes} e ${numbers[numbers.length - 1]}`;
}

export type RangeSummary =
  | { valid: false; reason: string }
  | {
      valid: true;
      start: number;
      end: number;
      pages: number;
      xp: number;
      repeatedPages: number;
      closing: ChapterPages[];
    };

interface RangeInput {
  startText: string;
  endText: string;
  totalPages: number;
  currentPage: number;
  /** `null` enquanto os capitulos nao chegaram (ou falharam): sem previsao. */
  chapters: ChapterPages[] | null;
}

/**
 * Tudo que o resumo ao vivo e o CTA precisam, de uma vez. Invalido sempre
 * traz o motivo, porque o CTA desabilitado mostra por que (spec S7.2). A
 * validacao de intervalo continua sendo `validatePageRange`, sem regra nova.
 */
export function summarizeRange({
  startText, endText, totalPages, currentPage, chapters,
}: RangeInput): RangeSummary {
  const start = parsePage(startText);
  if (start === null) return { valid: false, reason: 'Diz de onde você começou.' };
  const end = parsePage(endText);
  if (end === null) return { valid: false, reason: 'Diz até onde você foi.' };

  const erro = validatePageRange(start, end, totalPages);
  if (erro) return { valid: false, reason: erro };

  const pages = end - start + 1;
  return {
    valid: true,
    start,
    end,
    pages,
    xp: pages * XP_PER_PAGE,
    repeatedPages: pagesAlreadyRead(start, end, currentPage),
    closing: chapters ? predictCompletedChapters(chapters, currentPage, end) : [],
  };
}

export function ctaLabel(pages: number): string {
  return pages === 1 ? 'Registrar 1 página' : `Registrar ${pages} páginas`;
}

/**
 * BER-54: pagina relida conta de novo (`pages_read` e coluna gerada), e sem
 * migration nao da pra corrigir a contagem. O que da e a pessoa saber antes de
 * enviar. Conteudo da nota antiga, no registro de voz novo.
 */
export function repeatedPagesNote(repeated: number, currentPage: number): string {
  const quantas = repeated === 1 ? 'Uma página' : `${repeated} páginas`;
  return `${quantas} desse trecho você já tinha registrado. Seu progresso tá na pág. ${currentPage}.`;
}

/**
 * O toast do registro sem capitulo fechado (spec S7.2). Sequencia vem de
 * `current_streak` da resposta; XP e paginas x XP_PER_PAGE, a mesma parcela
 * que `totalXp` soma a partir de `reading_sessions.pages_read`.
 */
export function successToast(pages: number, streak: number): { message: string; detail: string } {
  const message = pages === 1 ? '1 página registrada' : `${pages} páginas registradas`;
  const dias = streak === 1 ? '1 dia seguido' : `${streak} dias seguidos`;
  return { message, detail: `+${formatXp(pages * XP_PER_PAGE)} XP · ${dias}` };
}

// `type`, nao `interface`: o expo-router tipa params como registro com indice
// de string, e so alias de tipo literal e atribuivel a isso.
export type ChapterCompleteParams = {
  chapterIds: string;
  bookId: string;
  pagesRead: string;
  streak: string;
  xpBefore?: string;
};

interface ChapterCompleteInput {
  completedChapterIds: string[];
  bookId: string;
  start: number;
  end: number;
  streak: number;
  /** XP lido antes do envio; `null` quando o store nunca carregou. */
  xpBefore: number | null;
}

/**
 * Contrato da rota `/chapter-complete` (F4-7), consumido pela Tarefa 6:
 * ids na ordem da resposta, unidos por virgula; `xpBefore` so existe com dado.
 */
export function chapterCompleteParams({
  completedChapterIds, bookId, start, end, streak, xpBefore,
}: ChapterCompleteInput): ChapterCompleteParams {
  const params: ChapterCompleteParams = {
    chapterIds: completedChapterIds.join(','),
    bookId,
    pagesRead: String(end - start + 1),
    streak: String(streak),
  };
  if (xpBefore !== null) params.xpBefore = String(xpBefore);
  return params;
}
