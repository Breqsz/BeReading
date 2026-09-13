import { render, fireEvent } from '@testing-library/react-native';
import { TabBar, TAB_BAR_HEIGHT } from '../../src/ui/TabBar';
import { MIN_TOUCH } from '../../src/theme/tokens';

// Mesma tecnica do Button.test.tsx: espiona o haptic em vez de depender do
// modulo nativo, que nao existe no ambiente de teste.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

import * as Haptics from 'expo-haptics';

// Os nomes de rota nao mudam (deep link): index, livros, catalogo, perfil.
// Ver src/components/CustomTabBar.tsx, que usa os mesmos quatro.
function makeProps(activeIndex = 0) {
  const routes = [
    { key: 'index', name: 'index' },
    { key: 'livros', name: 'livros' },
    { key: 'catalogo', name: 'catalogo' },
    { key: 'perfil', name: 'perfil' },
  ];
  return {
    state: { routes, index: activeIndex } as any,
    navigation: { navigate: jest.fn() } as any,
    descriptors: {} as any,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  };
}

describe('TabBar', () => {
  beforeEach(() => {
    (Haptics.impactAsync as jest.Mock).mockClear();
  });

  it('mostra os quatro rotulos, sem FAB', () => {
    const { getByText, queryByTestId } = render(<TabBar {...makeProps()} />);
    expect(getByText('Hoje')).toBeTruthy();
    expect(getByText('Estante')).toBeTruthy();
    expect(getByText('Explorar')).toBeTruthy();
    expect(getByText('Você')).toBeTruthy();
    expect(queryByTestId('fab-registrar')).toBeNull();
  });

  it('navega e vibra leve ao tocar em uma aba diferente da ativa', () => {
    const props = makeProps(0);
    const { getByLabelText } = render(<TabBar {...props} />);
    fireEvent.press(getByLabelText('Estante'));
    expect(props.navigation.navigate).toHaveBeenCalledWith('livros');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('nao navega nem vibra ao tocar na aba ja ativa', () => {
    const props = makeProps(0);
    const { getByLabelText } = render(<TabBar {...props} />);
    fireEvent.press(getByLabelText('Hoje'));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });

  it('marca a aba ativa com accessibilityState selected, e so ela', () => {
    const { getByLabelText } = render(<TabBar {...makeProps(1)} />);
    expect(getByLabelText('Estante').props.accessibilityState.selected).toBe(true);
    expect(getByLabelText('Hoje').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Explorar').props.accessibilityState.selected).toBe(false);
    expect(getByLabelText('Você').props.accessibilityState.selected).toBe(false);
  });

  it('cada aba declara accessibilityRole tab', () => {
    const { getByLabelText } = render(<TabBar {...makeProps()} />);
    expect(getByLabelText('Hoje').props.accessibilityRole).toBe('tab');
  });

  it('TAB_BAR_HEIGHT e maior que o alvo minimo de toque', () => {
    expect(TAB_BAR_HEIGHT).toBeGreaterThan(MIN_TOUCH);
  });
});
