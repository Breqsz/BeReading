import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { Text } from '../../src/ui/Text';
import { type as typeTokens, color } from '../../src/theme/tokens';

describe('Text', () => {
  it('aplica tamanho, linha e familia da variante', () => {
    const { getByText } = render(<Text variant="heading">Magrathea</Text>);
    const s = StyleSheet.flatten(getByText('Magrathea').props.style);
    expect(s.fontSize).toBe(typeTokens.heading.fontSize);
    expect(s.lineHeight).toBe(typeTokens.heading.lineHeight);
    expect(s.fontFamily).toBe(typeTokens.heading.fontFamily);
  });

  it('usa body como variante padrao', () => {
    const { getByText } = render(<Text>Sem variante</Text>);
    expect(StyleSheet.flatten(getByText('Sem variante').props.style).fontSize).toBe(typeTokens.body.fontSize);
  });

  it.each([
    ['primary', color.text],
    ['secondary', color.text2],
    ['tertiary', color.text3],
    ['accent', color.accent],
    ['danger', color.danger],
  ])('o tone %s pinta com o token certo', (tone, esperado) => {
    const { getByText } = render(<Text tone={tone as any}>Cor</Text>);
    expect(StyleSheet.flatten(getByText('Cor').props.style).color).toBe(esperado);
  });

  it('limita o Dynamic Type para o layout nao quebrar', () => {
    const { getByText } = render(<Text variant="display">Guilherme</Text>);
    expect(getByText('Guilherme').props.maxFontSizeMultiplier)
      .toBe(typeTokens.display.maxFontSizeMultiplier);
  });

  it('numeros usam fonte tabular, para nao pular quando contam', () => {
    const { getByText } = render(<Text variant="numericXL">1840</Text>);
    expect(StyleSheet.flatten(getByText('1840').props.style).fontVariant).toEqual(['tabular-nums']);
  });

  it('deixa o chamador sobrescrever com style, sem perder a variante', () => {
    const { getByText } = render(<Text variant="body" style={{ marginTop: 8 }}>X</Text>);
    const s = StyleSheet.flatten(getByText('X').props.style);
    expect(s.marginTop).toBe(8);
    expect(s.fontSize).toBe(typeTokens.body.fontSize);
  });

  it('repassa numberOfLines', () => {
    const { getByText } = render(<Text numberOfLines={2}>Titulo longo</Text>);
    expect(getByText('Titulo longo').props.numberOfLines).toBe(2);
  });
});
