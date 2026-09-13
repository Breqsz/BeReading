import { render, fireEvent, act } from '@testing-library/react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';

// Capitulo fechado (spec S7.3, F4 Tarefa 6).
//
// Relogio falso do Jest em todos os testes, porque a contagem anda em
// requestAnimationFrame. O cuidado desta suite: com relogio falso, "o valor
// final chegou" passa tanto para a contagem certa quanto para um salto direto.
// Todo teste de contagem prova tambem que o valor intermediario existiu.

let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => mockReducedMotion };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('../../src/api/queries', () => ({
  getChaptersByIds: jest.fn(),
}));

import ChapterCompleteScreen from '../../app/chapter-complete';
import { Ring } from '../../src/ui/Ring';
import * as RingModule from '../../src/ui/Ring';
import { useProgressStore } from '../../src/stores/progressStore';
import { getChaptersByIds } from '../../src/api/queries';
import { levelFor } from '../../src/game/xp';
import { motion } from '../../src/theme/tokens';
import type { Chapter } from '../../src/types/database';

const mGetChapters = getChaptersByIds as jest.Mock;

const DURACAO = motion.count.duration;
const METADE = DURACAO / 2;
// Um quadro de folga: o ultimo quadro da contagem pode cair logo depois dos 600 ms.
const FOLGA = 20;

type Tela = ReturnType<typeof render>;

const capitulo = (id: string, number: number): Chapter => ({
  id, book_id: 'b1', number, title: null, start_page: null, end_page: null,
});

/** Params como o sheet de registrar leitura manda (contrato F4-7). */
function registro(over: Record<string, string> = {}) {
  mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '28', streak: '5', xpBefore: '1840', ...over };
}

function storeCom(xp: number) {
  useProgressStore.setState({ xp, level: levelFor(xp), carregado: true });
}

async function montar(): Promise<Tela> {
  const tela = render(<ChapterCompleteScreen />);
  await act(async () => {});
  return tela;
}

function avancar(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

/** O numero grande do centro do anel: o unico texto que e so numero. */
function xpNoAnel(tela: Tela): number {
  const texto = String(tela.getByText(/^\d{1,3}(?:\.\d{3})*$/).props.children);
  return Number(texto.replace(/\./g, ''));
}

// Mesma leitura de __tests__/ui/Progress.test.tsx.
function lerDasharray(valor: unknown): [number, number] {
  const partes = Array.isArray(valor) ? valor : String(valor).trim().split(/[\s,]+/);
  return [Number(partes[0]), Number(partes[1])];
}

function arco(tela: Tela): number {
  const [preenchido, total] = lerDasharray(tela.getByTestId('ring-progress').props.strokeDasharray);
  return preenchido / total;
}

/** O que o leitor de tela ouve no anel. */
function anel(tela: Tela) {
  const el = tela.getByRole('progressbar');
  return { label: el.props.accessibilityLabel, agora: el.props.accessibilityValue?.now };
}

describe('chapter-complete (spec S7.3)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    mockReplace.mockClear();
    mockBack.mockClear();
    mGetChapters.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('conteudo, capitulos e navegacao (F4-15)', () => {
    it('um capitulo: Orelha, titulo com o numero, convite pro quiz e as tags de XP e sequencia', async () => {
      registro();
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(mGetChapters).toHaveBeenCalledWith(['c-4']);
      expect(tela.getByText('Orelha')).toBeTruthy();
      expect(tela.getByText('Capítulo 4, fechado.')).toBeTruthy();
      expect(tela.getByText('Bora ver o que ficou?')).toBeTruthy();
      expect(tela.getByText('+140 XP')).toBeTruthy();
      expect(tela.getByText('5 dias seguidos')).toBeTruthy();
      expect(tela.getByRole('button', { name: 'Bora pro quiz' })).toBeTruthy();
      expect(tela.getByRole('button', { name: 'Depois' })).toBeTruthy();
    });

    it('carregando os capitulos: skeleton no formato da tela, sem spinner, sem titulo e sem botao', () => {
      registro();
      storeCom(1980);
      mGetChapters.mockReturnValue(new Promise(() => {}));
      const tela = render(<ChapterCompleteScreen />);

      expect(tela.getAllByLabelText('Carregando').length).toBeGreaterThan(3);
      expect(tela.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
      expect(tela.queryByText(/fechado/)).toBeNull();
      expect(tela.queryByRole('button')).toBeNull();
      expect(tela.queryByRole('progressbar')).toBeNull();
    });

    it('varios capitulos, fora de ordem na resposta: o titulo conta e o quiz abre pelo menor numero, com replace', async () => {
      registro({ chapterIds: 'c-6,c-4,c-5' });
      storeCom(1980);
      // .in() nao preserva ordem: nem os ids (c-6 primeiro) nem a resposta
      // (c-5 primeiro) apontam o menor numero.
      mGetChapters.mockResolvedValue([capitulo('c-5', 5), capitulo('c-6', 6), capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('3 capítulos, fechados.')).toBeTruthy();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledTimes(1);
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('falha da consulta: nenhum numero inventado, e o quiz abre pelo primeiro id', async () => {
      registro({ chapterIds: 'c-6,c-4' });
      storeCom(1980);
      mGetChapters.mockRejectedValue(new Error('sem rede'));
      const tela = await montar();

      expect(tela.getByText('2 capítulos, fechados.')).toBeTruthy();
      expect(tela.queryByText(/Capítulo \d/)).toBeNull();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-6');
    });

    it('falha da consulta com um capitulo so: titulo sem numero, e o convite continua', async () => {
      registro({ chapterIds: 'c-4' });
      storeCom(1980);
      mGetChapters.mockRejectedValue(new Error('sem rede'));
      const tela = await montar();

      expect(tela.getByText('Capítulo fechado.')).toBeTruthy();
      expect(tela.getByText('Bora ver o que ficou?')).toBeTruthy();
      fireEvent.press(tela.getByRole('button', { name: 'Bora pro quiz' }));
      expect(mockReplace).toHaveBeenCalledWith('/quiz/c-4');
    });

    it('"Depois" sai da conquista de volta pra onde o leitor estava, sem replace', async () => {
      registro();
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      fireEvent.press(tela.getByRole('button', { name: 'Depois' }));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('sem chapterIds: nao consulta, nao inventa numero e nao oferece quiz', async () => {
      registro({ chapterIds: '' });
      storeCom(1980);
      const tela = await montar();

      expect(mGetChapters).not.toHaveBeenCalled();
      expect(tela.getByText('Capítulo fechado.')).toBeTruthy();
      expect(tela.queryByRole('button', { name: 'Bora pro quiz' })).toBeNull();
      expect(tela.queryByText('Bora ver o que ficou?')).toBeNull();
      expect(tela.getByRole('button', { name: 'Depois' })).toBeTruthy();
    });
  });

  describe('anel e XP (F4-14, F4-21)', () => {
    it('sem subida de nivel: XP e arco passam por valor intermediario e chegam no final, e o leitor de tela ouve o final o tempo todo', async () => {
      // Premissa: 1840 e 1980 ficam no mesmo nivel (4).
      expect(levelFor(1840).level).toBe(4);
      expect(levelFor(1980).level).toBe(4);
      registro({ pagesRead: '28', xpBefore: '1840' });
      storeCom(1980);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      const final = { label: 'Nível 4 · Constante. 1.980 de 2.200 XP', agora: 75 };
      expect(xpNoAnel(tela)).toBe(1840);
      expect(arco(tela)).toBeCloseTo(levelFor(1840).progress, 3);
      expect(anel(tela)).toEqual(final);
      expect(tela.getByText('Nível 4')).toBeTruthy();
      expect(tela.getByText('de 2.200 XP')).toBeTruthy();

      avancar(METADE);
      const meio = xpNoAnel(tela);
      expect(meio).toBeGreaterThan(1840);
      expect(meio).toBeLessThan(1980);
      expect(arco(tela)).toBeGreaterThan(levelFor(1840).progress);
      expect(arco(tela)).toBeLessThan(levelFor(1980).progress);
      expect(anel(tela)).toEqual(final);

      avancar(METADE + FOLGA);
      expect(xpNoAnel(tela)).toBe(1980);
      expect(arco(tela)).toBeCloseTo(levelFor(1980).progress, 3);
      expect(anel(tela)).toEqual(final);
      expect(tela.queryByText(/Agora você é/, { includeHiddenElements: true })).toBeNull();
    });

    it('refresh falho no registro (store ainda com o XP antigo): o ganho nao some e conta ate xpBefore + ganho', async () => {
      registro({ pagesRead: '28', xpBefore: '1840' });
      storeCom(1840);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('+140 XP')).toBeTruthy();
      expect(anel(tela).label).toBe('Nível 4 · Constante. 1.980 de 2.200 XP');
      expect(xpNoAnel(tela)).toBe(1840);

      avancar(METADE);
      expect(xpNoAnel(tela)).toBeGreaterThan(1840);
      expect(xpNoAnel(tela)).toBeLessThan(1980);

      avancar(METADE + FOLGA);
      expect(xpNoAnel(tela)).toBe(1980);
      expect(arco(tela)).toBeCloseTo(levelFor(1980).progress, 3);
    });

    it('subiu de nivel: o anel completa, zera, continua ate o progresso do nivel novo, e a fala aparece so no fim', async () => {
      // Premissa: 2100 e nivel 4 (proximo em 2200); 2300 e nivel 5.
      expect(levelFor(2100)).toMatchObject({ level: 4, next: 2200 });
      expect(levelFor(2300)).toMatchObject({ level: 5, title: 'Maratonista', next: 3300 });
      registro({ pagesRead: '40', xpBefore: '2100' });
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      const fala = 'Nível 5. Agora você é Maratonista.';
      const final = { label: 'Nível 5 · Maratonista. 2.300 de 3.300 XP', agora: 9 };
      const opacidadeDaFala = () =>
        StyleSheet.flatten(tela.getByText(fala, { includeHiddenElements: true }).props.style).opacity;

      // Largada: o anel conta, no nivel e XP de antes, e a fala ainda nao aparece.
      expect(tela.UNSAFE_getByType(Ring).props.count).toBeDefined();
      expect(tela.getByText('Nível 4')).toBeTruthy();
      expect(xpNoAnel(tela)).toBe(2100);
      expect(arco(tela)).toBeCloseTo(levelFor(2100).progress, 3);
      expect(tela.queryByText(fala)).toBeNull();
      expect(opacidadeDaFala()).toBe(0);
      expect(anel(tela)).toEqual(final);

      // Primeiro trecho, no meio.
      avancar(METADE);
      expect(tela.getByText('Nível 4')).toBeTruthy();
      expect(xpNoAnel(tela)).toBeGreaterThan(2100);
      expect(xpNoAnel(tela)).toBeLessThan(2200);
      expect(anel(tela)).toEqual(final);

      // Completa: perto do fim do primeiro trecho, o arco esta cheio.
      avancar(METADE - 10);
      expect(arco(tela)).toBeGreaterThan(0.99);
      expect(tela.queryByText(fala)).toBeNull();

      // Zera: o segundo trecho recomeca do zero, ja no nivel novo.
      avancar(50);
      expect(arco(tela)).toBeLessThan(0.05);
      expect(tela.getByText('Nível 5')).toBeTruthy();
      expect(tela.queryByText('Nível 4')).toBeNull();
      expect(xpNoAnel(tela)).toBeGreaterThanOrEqual(2200);
      expect(xpNoAnel(tela)).toBeLessThan(2300);
      expect(tela.queryByText(fala)).toBeNull();
      expect(anel(tela)).toEqual(final);

      // Continua: meio do segundo trecho.
      avancar(METADE);
      expect(xpNoAnel(tela)).toBeGreaterThan(2200);
      expect(xpNoAnel(tela)).toBeLessThan(2300);
      expect(arco(tela)).toBeGreaterThan(0);
      expect(arco(tela)).toBeLessThan(levelFor(2300).progress);
      expect(tela.queryByText(fala)).toBeNull();

      // Fim: progresso do nivel novo, XP final e a fala, visivel e anunciavel.
      avancar(DURACAO);
      expect(xpNoAnel(tela)).toBe(2300);
      expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 3);
      expect(tela.getByText(fala)).toBeTruthy();
      expect(opacidadeDaFala() ?? 1).toBe(1);
      expect(anel(tela)).toEqual(final);
    });

    it('reduce motion: XP, nivel e fala aparecem prontos, e o anel nao recebe pedido de contagem em render nenhum', async () => {
      mockReducedMotion = true;
      registro({ pagesRead: '40', xpBefore: '2100' });
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      // Espia todos os renders do Ring, e nao so o ultimo. O act esconde os
      // renders do meio: se a tela pedisse contagem, o Ring (que respeita
      // reduce motion) avisaria o fim na hora e a arvore final sairia igual,
      // mas o centro teria mostrado o nivel e o XP do primeiro trecho antes.
      // Checar so a arvore final passava com esse defeito.
      const espiaRing = jest.spyOn(RingModule, 'Ring');
      try {
        const tela = await montar();

        expect(espiaRing.mock.calls.length).toBeGreaterThan(0);
        expect(espiaRing.mock.calls.every(([props]) => props.count === undefined)).toBe(true);
        expect(xpNoAnel(tela)).toBe(2300);
        expect(tela.getByText('Nível 5')).toBeTruthy();
        expect(tela.queryByText('Nível 4')).toBeNull();
        expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 3);
        expect(tela.getByText('Nível 5. Agora você é Maratonista.')).toBeTruthy();

        avancar(METADE);
        expect(xpNoAnel(tela)).toBe(2300);
        expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 3);
      } finally {
        espiaRing.mockRestore();
      }
    });

    it('sem xpBefore: anel parado no XP do store, sem contagem e sem fala de nivel', async () => {
      // Quem deduzisse o "antes" do store (2300 - 200 = 2100, nivel 4) contaria
      // e anunciaria uma subida que nao da pra provar.
      mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '40', streak: '5' };
      storeCom(2300);
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.UNSAFE_getByType(Ring).props.count).toBeUndefined();
      expect(xpNoAnel(tela)).toBe(2300);
      expect(arco(tela)).toBeCloseTo(levelFor(2300).progress, 3);

      avancar(DURACAO + FOLGA);
      expect(xpNoAnel(tela)).toBe(2300);
      expect(tela.queryByText(/Agora você é/, { includeHiddenElements: true })).toBeNull();
      expect(tela.getByText('+200 XP')).toBeTruthy();
    });

    it('sem xpBefore e store que nunca carregou: nenhum XP inventado no anel, mas o ganho do registro aparece', async () => {
      mockParams = { chapterIds: 'c-4', bookId: 'b1', pagesRead: '40', streak: '5' };
      useProgressStore.setState({ xp: 0, level: levelFor(0), carregado: false });
      mGetChapters.mockResolvedValue([capitulo('c-4', 4)]);
      const tela = await montar();

      expect(tela.getByText('Capítulo 4, fechado.')).toBeTruthy();
      expect(tela.queryByRole('progressbar')).toBeNull();
      expect(tela.queryByText(/^\d{1,3}(?:\.\d{3})*$/)).toBeNull();
      expect(tela.getByText('+200 XP')).toBeTruthy();
    });
  });
});
