import { render } from '@testing-library/react-native';

// Espiona o Redirect do expo-router em vez de montar o Stack de verdade: o
// que a Tarefa 4 pede e' que a tela redirecione, nao que o roteador real
// resolva a navegacao (isso e' teste do proprio expo-router).
const mockRedirect = jest.fn((_props: { href: string }) => null);
jest.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => mockRedirect(props),
}));

import ReadingSuccessScreen from '../../app/reading-success';

describe('reading-success', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
  });

  it('redireciona para a Home em vez de renderizar a tela antiga', () => {
    render(<ReadingSuccessScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(expect.objectContaining({ href: '/' }));
  });
});
