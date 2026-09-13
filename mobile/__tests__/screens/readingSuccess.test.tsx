import { render, screen } from '@testing-library/react-native';

/**
 * Este arquivo existia ao contrario: ele afirmava "redireciona para a Home em
 * vez de renderizar a tela antiga", e passava. Passava porque a Tarefa 4 da F3
 * partiu de uma premissa falsa — a de que ninguem navegava mais pra ca — e o
 * teste foi escrito pra confirmar a premissa, nao pra checar o produto. Com o
 * teste verde, o caminho mais comum do app ficou sem confirmacao nenhuma.
 *
 * O que vale testar aqui e' o que o leitor precisa ver depois de registrar
 * leitura: quantas paginas entraram e como esta a sequencia.
 */

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  // O LottieSlot da tela usa useFocusEffect pra soltar a animacao ao entrar.
  useFocusEffect: (cb: () => void | (() => void)) => cb(),
}));

import ReadingSuccessScreen from '../../app/reading-success';

describe('reading-success', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockParams = {};
  });

  it('mostra as paginas registradas e a sequencia', () => {
    mockParams = { pagesRead: '12', streak: '4' };
    render(<ReadingSuccessScreen />);

    expect(screen.getByText('+12 páginas')).toBeTruthy();
    expect(screen.getByText('Streak de 4 dias aceso.')).toBeTruthy();
  });

  it('concorda o singular', () => {
    mockParams = { pagesRead: '1', streak: '1' };
    render(<ReadingSuccessScreen />);

    expect(screen.getByText('+1 página')).toBeTruthy();
    expect(screen.getByText('Streak de 1 dia aceso.')).toBeTruthy();
  });

  it('sem parametro nenhum ainda renderiza, com zero', () => {
    render(<ReadingSuccessScreen />);

    expect(screen.getByText('+0 páginas')).toBeTruthy();
  });

  it('nao redireciona sozinha: o leitor sai pelo botao', () => {
    mockParams = { pagesRead: '5', streak: '2' };
    render(<ReadingSuccessScreen />);

    expect(mockReplace).not.toHaveBeenCalled();
    expect(screen.getByText('Voltar ao início')).toBeTruthy();
  });
});
