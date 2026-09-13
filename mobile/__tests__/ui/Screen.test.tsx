import { render } from '@testing-library/react-native';
import { ScrollView, Text as RNText } from 'react-native';
import { Screen } from '../../src/ui/Screen';
import { TAB_BAR_HEIGHT } from '../../src/ui/TabBar';
import { color } from '../../src/theme/tokens';

// Sobrescreve o mock global (insets zerados, ver jest.setup.ui.js) com insets
// nao triviais: sem isso, um paddingTop fixo passaria pelo teste por
// coincidencia, exatamente o defeito que o Screen substitui (TopBar antigo
// com paddingTop:58).
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

describe('Screen', () => {
  it('usa os insets reais no topo, nunca um numero fixo', () => {
    const { getByTestId } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const s = getByTestId('screen-root').props.style;
    const paddingTop = Array.isArray(s) ? s.find((x) => x?.paddingTop)?.paddingTop : s.paddingTop;
    expect(paddingTop).toBe(47);
  });

  it('fundo da tela usa o token color.bg', () => {
    const { getByTestId } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const s = getByTestId('screen-root').props.style;
    const backgroundColor = Array.isArray(s)
      ? s.find((x) => x?.backgroundColor)?.backgroundColor
      : s.backgroundColor;
    expect(backgroundColor).toBe(color.bg);
  });

  it('sem onBack, nao ha botao de voltar', () => {
    const { queryByLabelText } = render(
      <Screen title="Hoje"><RNText>conteudo</RNText></Screen>,
    );
    expect(queryByLabelText('Voltar')).toBeNull();
  });

  it('com onBack, mostra o botao de voltar acessivel', () => {
    const onBack = jest.fn();
    const { getByLabelText } = render(
      <Screen title="Hoje" onBack={onBack}><RNText>conteudo</RNText></Screen>,
    );
    expect(getByLabelText('Voltar')).toBeTruthy();
  });

  it('titulo e subtitulo aparecem quando informados', () => {
    const { getByText } = render(
      <Screen title="Hoje" subtitle="E ai, Breq"><RNText>conteudo</RNText></Screen>,
    );
    expect(getByText('Hoje')).toBeTruthy();
    expect(getByText('E ai, Breq')).toBeTruthy();
  });

  it('sem onRefresh, o ScrollView nao monta RefreshControl', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    expect(UNSAFE_getByType(ScrollView).props.refreshControl).toBeUndefined();
  });

  it('com onRefresh, monta o RefreshControl com a cor do token de acento', () => {
    const { UNSAFE_getByType } = render(
      <Screen refreshing={false} onRefresh={jest.fn()}><RNText>conteudo</RNText></Screen>,
    );
    const rc = UNSAFE_getByType(ScrollView).props.refreshControl;
    expect(rc).toBeTruthy();
    expect(rc.props.tintColor).toBe(color.accent);
  });

  it('reserva no fim do scroll espaco para a tab bar, a partir de TAB_BAR_HEIGHT', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    const style = UNSAFE_getByType(ScrollView).props.contentContainerStyle;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.paddingBottom).toBe(TAB_BAR_HEIGHT + 34);
  });

  it('esconde o indicador vertical de scroll', () => {
    const { UNSAFE_getByType } = render(
      <Screen><RNText>conteudo</RNText></Screen>,
    );
    expect(UNSAFE_getByType(ScrollView).props.showsVerticalScrollIndicator).toBe(false);
  });
});
