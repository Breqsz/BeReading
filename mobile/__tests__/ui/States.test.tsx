import { render, fireEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { Skeleton } from '../../src/ui/Skeleton';
import { EmptyState } from '../../src/ui/EmptyState';
import { Banner } from '../../src/ui/Banner';
import { ListRow } from '../../src/ui/ListRow';

// O mock oficial de react-native-reanimated (usado globalmente no
// jest.setup.ui.js) deixa useReducedMotion de fora de proposito — o proprio
// arquivo do pacote comenta "ADD ME IF NEEDED". Sobrescreve so aqui, sem
// tocar no setup global, que outras suites tambem usam.
jest.mock('react-native-reanimated', () => ({
  ...jest.requireActual('react-native-reanimated/mock'),
  useReducedMotion: () => false,
}));

describe('Skeleton', () => {
  it('se anuncia como carregando, para o leitor de tela nao ler caixa vazia', () => {
    const { getByLabelText } = render(<Skeleton width={100} height={12} />);
    expect(getByLabelText('Carregando')).toBeTruthy();
  });
});

describe('EmptyState', () => {
  it('mostra titulo, explicacao e acao', () => {
    const { getByText, getByRole } = render(
      <EmptyState
        title="Estante vazia, por enquanto"
        description="Escolhe o primeiro livro no Explorar."
        actionLabel="Explorar livros"
        onAction={jest.fn()}
      />,
    );
    expect(getByText('Estante vazia, por enquanto')).toBeTruthy();
    expect(getByText('Escolhe o primeiro livro no Explorar.')).toBeTruthy();
    expect(getByRole('button')).toBeTruthy();
  });

  it('dispara a acao', () => {
    const onAction = jest.fn();
    const { getByRole } = render(
      <EmptyState title="T" description="D" actionLabel="Ir" onAction={onAction} />,
    );
    fireEvent.press(getByRole('button'));
    expect(onAction).toHaveBeenCalled();
  });

  it('sem acao, nao renderiza botao', () => {
    const { queryByRole } = render(<EmptyState title="T" description="D" />);
    expect(queryByRole('button')).toBeNull();
  });
});

describe('Banner', () => {
  it('mostra a mensagem e o botao de tentar de novo', () => {
    const onRetry = jest.fn();
    const { getByText, getByRole } = render(
      <Banner tone="error" message="Caiu a internet. O que você registrou tá salvo." onRetry={onRetry} />,
    );
    expect(getByText('Caiu a internet. O que você registrou tá salvo.')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onRetry).toHaveBeenCalled();
  });

  it('se anuncia como alerta', () => {
    const { getByRole } = render(<Banner tone="error" message="Falhou" />);
    expect(getByRole('alert')).toBeTruthy();
  });

  it('sem onRetry, nao renderiza botao', () => {
    const { queryByRole } = render(<Banner tone="info" message="Só um aviso" />);
    expect(queryByRole('button')).toBeNull();
  });
});

describe('ListRow', () => {
  it('e um botao com label quando tocavel', () => {
    const { getByRole } = render(
      <ListRow title="Capítulo 4" subtitle="p. 61 a 85" accessibilityLabel="Capítulo 4, quiz feito" onPress={jest.fn()} />,
    );
    expect(getByRole('button').props.accessibilityLabel).toBe('Capítulo 4, quiz feito');
  });

  it('nao vira botao quando nao tem onPress', () => {
    const { queryByRole, getByText } = render(<ListRow title="Capítulo 4" />);
    expect(queryByRole('button')).toBeNull();
    expect(getByText('Capítulo 4')).toBeTruthy();
  });

  it('anuncia desabilitado e nao dispara quando trancado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <ListRow title="Capítulo 6" accessibilityLabel="Capítulo 6, trancado" onPress={onPress} disabled />,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('renderiza leading e trailing', () => {
    const { getByText } = render(
      <ListRow
        title="Capítulo 4"
        leading={<RNText>L</RNText>}
        trailing={<RNText>92</RNText>}
      />,
    );
    expect(getByText('L')).toBeTruthy();
    expect(getByText('92')).toBeTruthy();
  });
});
