import { render, fireEvent, act } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text as RNText } from 'react-native';
import { ToastProvider, useToast } from '../../src/ui/Toast';
import { color } from '../../src/theme/tokens';

function Tela({ opts }: { opts: any }) {
  const { show } = useToast();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="disparar" onPress={() => show(opts)}>
      <RNText>disparar</RNText>
    </Pressable>
  );
}

const montar = (opts: any) =>
  render(<ToastProvider><Tela opts={opts} /></ToastProvider>);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('nao aparece antes de alguem pedir', () => {
    const { queryByText } = montar({ message: '28 páginas registradas' });
    expect(queryByText('28 páginas registradas')).toBeNull();
  });

  it('mostra a mensagem quando pedido', () => {
    const { getByLabelText, getByText } = montar({ message: '28 páginas registradas' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('28 páginas registradas')).toBeTruthy();
  });

  it('mostra o detalhe junto', () => {
    const { getByLabelText, getByText } = montar({
      message: '28 páginas registradas', detail: 'mais 140 XP · 5 dias seguidos',
    });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByText('mais 140 XP · 5 dias seguidos')).toBeTruthy();
  });

  it('some sozinho, sem exigir toque', () => {
    const { getByLabelText, queryByText } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(queryByText('Salvo')).toBeNull();
  });

  it('dispara a acao e fecha', () => {
    const onAction = jest.fn();
    const { getByLabelText, queryByText } = montar({
      message: 'Não deu para registrar', actionLabel: 'Tentar', onAction,
    });
    fireEvent.press(getByLabelText('disparar'));
    fireEvent.press(getByLabelText('Tentar'));
    expect(onAction).toHaveBeenCalled();
    expect(queryByText('Não deu para registrar')).toBeNull();
  });

  it('o toast novo substitui o anterior, em vez de empilhar', () => {
    const { getByLabelText, queryByText, rerender } = montar({ message: 'Primeiro' });
    fireEvent.press(getByLabelText('disparar'));
    rerender(<ToastProvider><Tela opts={{ message: 'Segundo' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    expect(queryByText('Primeiro')).toBeNull();
    expect(queryByText('Segundo')).toBeTruthy();
  });

  it('se anuncia como alerta para o leitor de tela', () => {
    const { getByLabelText, getByRole } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    expect(getByRole('alert')).toBeTruthy();
  });

  it('limpa o timer pendente quando desmonta, para nao disparar contra arvore morta', () => {
    const clearSpy = jest.spyOn(global, 'clearTimeout');
    const { getByLabelText, unmount } = montar({ message: 'Salvo' });
    fireEvent.press(getByLabelText('disparar'));
    clearSpy.mockClear();
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('estoura sem ToastProvider por cima, para nao falhar em silencio', () => {
    // React loga o erro do throw no console durante o render: silencia so
    // aqui, para nao poluir a saida do teste com um erro esperado.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    function SemProvider() {
      useToast();
      return null;
    }
    expect(() => render(<SemProvider />)).toThrow(
      'useToast precisa de um ToastProvider acima na arvore',
    );
    errorSpy.mockRestore();
  });

  it('pinta o indicador com a cor do tom pedido, sucesso e erro nao podem parecer iguais', () => {
    const { getByLabelText, getByTestId, rerender } = montar({ message: 'Ok', tone: 'success' });
    fireEvent.press(getByLabelText('disparar'));
    const sucesso = StyleSheet.flatten(getByTestId('toast-indicator').props.style);
    expect(sucesso.backgroundColor).toBe(color.positive);

    rerender(<ToastProvider><Tela opts={{ message: 'Falhou', tone: 'error' }} /></ToastProvider>);
    fireEvent.press(getByLabelText('disparar'));
    const erro = StyleSheet.flatten(getByTestId('toast-indicator').props.style);
    expect(erro.backgroundColor).toBe(color.danger);
    expect(erro.backgroundColor).not.toBe(sucesso.backgroundColor);
  });
});
