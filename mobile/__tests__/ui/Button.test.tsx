import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { X } from 'lucide-react-native';
import { Button } from '../../src/ui/Button';
import { IconButton } from '../../src/ui/IconButton';
import { color, MIN_TOUCH } from '../../src/theme/tokens';

describe('Button', () => {
  it('chama onPress no toque', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress}>Registrar leitura</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('nao chama onPress quando desabilitado', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} disabled>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('nao chama onPress durante o loading, para nao enviar duas vezes', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button onPress={onPress} loading>Registrar</Button>);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('anuncia o estado desabilitado para o leitor de tela', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('anuncia busy durante o loading', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} loading>Registrar</Button>);
    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });

  it('usa o proprio texto como label acessivel quando nenhum e dado', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Registrar leitura</Button>);
    expect(getByRole('button').props.accessibilityLabel).toBe('Registrar leitura');
  });

  it('o primario pinta com o acento e escreve com a tinta escura', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    expect(StyleSheet.flatten(getByRole('button').props.style).backgroundColor).toBe(color.accent);
  });

  it('o destrutivo usa o token de erro, nao o acento', () => {
    const { getByRole } = render(<Button variant="destructive" onPress={jest.fn()}>Sair</Button>);
    expect(StyleSheet.flatten(getByRole('button').props.style).backgroundColor).toBe(color.dangerSoft);
  });

  it('o desabilitado nao usa opacidade, para o texto seguir legivel', () => {
    const { getByRole } = render(<Button onPress={jest.fn()} disabled>Ir</Button>);
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.backgroundColor).toBe(color.surface2);
    expect(s.opacity).toBeUndefined();
  });

  it('respeita o alvo minimo de toque', () => {
    const { getByRole } = render(<Button onPress={jest.fn()}>Ir</Button>);
    expect(StyleSheet.flatten(getByRole('button').props.style).height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
});

describe('IconButton', () => {
  it('exige e expoe um label, porque icone sozinho nao se explica', () => {
    const { getByLabelText } = render(
      <IconButton icon={X} accessibilityLabel="Fechar o quiz" onPress={jest.fn()} />,
    );
    expect(getByLabelText('Fechar o quiz')).toBeTruthy();
  });

  it('tem alvo de toque de ao menos 44 nos dois eixos', () => {
    const { getByRole } = render(
      <IconButton icon={X} accessibilityLabel="Fechar" onPress={jest.fn()} />,
    );
    const s = StyleSheet.flatten(getByRole('button').props.style);
    expect(s.width).toBeGreaterThanOrEqual(MIN_TOUCH);
    expect(s.height).toBeGreaterThanOrEqual(MIN_TOUCH);
  });
});
