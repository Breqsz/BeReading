import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { space, COVER_PALETTE_COLORS } from '../theme/tokens';

interface Props {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

// A ilustracao e feita com as pecas do proprio sistema (lombadas de livro), sem
// mascote e sem emoji: o estado vazio continua sendo do mesmo produto.
export function EmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.spines} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.spine,
              { backgroundColor: COVER_PALETTE_COLORS[i], height: i === 1 ? 68 : 56, opacity: 0.5 },
            ]}
          />
        ))}
      </View>
      <Text variant="heading" align="center">{title}</Text>
      <Text variant="callout" tone="secondary" align="center" style={styles.desc}>{description}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button onPress={onAction}>{actionLabel}</Button>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.gutter },
  spines: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, marginBottom: space.xl },
  spine: { width: 16, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  desc: { marginTop: space.sm, maxWidth: 280 },
  action: { marginTop: space.xl, minWidth: 200 },
});
