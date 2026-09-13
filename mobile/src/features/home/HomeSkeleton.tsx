// Carregamento da Hoje: skeleton no formato exato da tela, nunca spinner
// (DESIGN.md secao 5 e 9). As formas espelham HomeHeader, StreakWeek,
// CurrentBookHero, o botao primario e o rodape de nivel.
import { StyleSheet, View } from 'react-native';
import { Skeleton } from '../../ui/Skeleton';
import { radius, space } from '../../theme/tokens';

const RING_SIZE = 38; // Documentado em src/ui/Ring.tsx: 38 na Hoje.
const COVER_WIDTH = 86; // Documentado em src/ui/Cover.tsx: 86 na Hoje.
const COVER_HEIGHT = Math.round(COVER_WIDTH * 1.5); // Mesma proporcao 2:3 do Cover.
const PROGRESS_HEIGHT = 4; // Altura default de src/ui/ProgressBar.tsx.
const BUTTON_HEIGHT = 50; // Altura de Button size="lg" (src/ui/Button.tsx).
const WEEK_MARKER = space.xxl; // Mesmo diametro do marcador real (StreakWeek.tsx).

export function HomeSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={{ gap: space.xs }}>
          <Skeleton width={48} height={14} />
          <Skeleton width={140} height={28} />
        </View>
        <Skeleton width={RING_SIZE} height={RING_SIZE} borderRadius={radius.pill} />
      </View>

      <View style={styles.week}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} width={WEEK_MARKER} height={WEEK_MARKER} borderRadius={radius.pill} />
        ))}
      </View>

      <View style={styles.hero}>
        <Skeleton width={COVER_WIDTH} height={COVER_HEIGHT} borderRadius={radius.tag} />
        <View style={{ flex: 1, gap: space.sm }}>
          <Skeleton width={90} height={14} />
          <Skeleton width="100%" height={20} />
          <Skeleton width={120} height={14} />
          <Skeleton width="100%" height={PROGRESS_HEIGHT} borderRadius={PROGRESS_HEIGHT / 2} />
        </View>
      </View>

      <Skeleton width="100%" height={BUTTON_HEIGHT} borderRadius={radius.control} />
      <Skeleton width="100%" height={90} borderRadius={radius.card} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxl },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  hero: { flexDirection: 'row', gap: space.md },
});
