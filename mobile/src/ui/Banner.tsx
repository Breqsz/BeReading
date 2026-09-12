import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { color, radius, space } from '../theme/tokens';

interface Props {
  tone: 'error' | 'info';
  message: string;
  onRetry?: () => void;
}

// Erro que nao derruba a tela: o que ja carregou continua visivel e o banner
// explica o resto. Substitui o Alert.alert, que tapa a tela e some sem rastro.
export function Banner({ tone, message, onRetry }: Props) {
  return (
    <View
      accessible
      accessibilityRole="alert"
      // Mesma razao do Toast: accessibilityRole="alert" sozinho nao e
      // anunciado no TalkBack, so com accessibilityLiveRegion="polite" junto.
      accessibilityLiveRegion="polite"
      style={[styles.wrap, tone === 'error' ? styles.error : styles.info]}
    >
      <Text variant="callout" tone={tone === 'error' ? 'danger' : 'secondary'} style={styles.msg}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Tentar de novo" onPress={onRetry} hitSlop={8}>
          <Text variant="label" tone="accent">Tentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  error: { backgroundColor: color.dangerSoft, borderColor: color.danger },
  info: { backgroundColor: color.surface1, borderColor: color.line },
  msg: { flex: 1 },
});
