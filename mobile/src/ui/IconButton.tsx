import { Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { color, radius, MIN_TOUCH } from '../theme/tokens';

type IconCmp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  icon: IconCmp;
  /** Obrigatorio: icone sozinho nao se explica para quem usa leitor de tela. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'surface' | 'ghost';
  style?: ViewStyle;
}

export function IconButton({ icon: Icon, accessibilityLabel, onPress, variant = 'surface', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' ? styles.surface : null,
        pressed ? { backgroundColor: color.surface3 } : null,
        style,
      ]}
    >
      <Icon size={20} color={color.text} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  surface: { backgroundColor: color.surface1, borderWidth: 1, borderColor: color.line },
});
