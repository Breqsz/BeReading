// Atalhos de pagina (spec S7.2): "+10", "+20" e "Fim do cap. X · p. Y". Cada
// um so preenche o Ate; o calculo do alvo e do chamador (ver logic.ts).
import { StyleSheet, View } from 'react-native';
import { Chip } from '../../ui/Chip';
import { space } from '../../theme/tokens';

export interface RangeShortcut {
  label: string;
  endPage: number;
}

interface Props {
  shortcuts: RangeShortcut[];
  /** O Ate atual, para marcar o atalho que ja esta aplicado. */
  selectedEnd: number | null;
  onPick: (endPage: number) => void;
}

export function QuickRange({ shortcuts, selectedEnd, onPick }: Props) {
  return (
    <View style={styles.row}>
      {shortcuts.map((s) => (
        <Chip
          key={s.label}
          label={s.label}
          selected={selectedEnd === s.endPage}
          onPress={() => onPick(s.endPage)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
