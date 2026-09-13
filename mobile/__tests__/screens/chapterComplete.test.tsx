import { render, fireEvent } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({
  chapterIds: '1,2',
  bookId: 'livro-1',
  pagesRead: '12',
  streak: '3',
  xpBefore: '40',
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

import ChapterCompleteScreen from '../../app/chapter-complete';

describe('chapter-complete (placeholder da Tarefa 4, conteudo real na F4)', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('mostra o Glyph e o titulo', () => {
    // O Glyph e' decorativo (accessibilityElementsHidden): precisa pedir os
    // elementos escondidos de acessibilidade, mesma convencao de
    // __tests__/ui/Glyph.test.tsx.
    const { getByTestId, getByText } = render(<ChapterCompleteScreen />);
    expect(getByTestId('glyph', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('Capítulo fechado')).toBeTruthy();
  });

  it('le os params do contrato da rota (chapterIds, bookId, pagesRead, streak, xpBefore)', () => {
    render(<ChapterCompleteScreen />);
    expect(mockUseLocalSearchParams).toHaveBeenCalled();
  });

  it('o botao volta chama router.back', () => {
    const { getByText } = render(<ChapterCompleteScreen />);
    fireEvent.press(getByText('Voltar'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
