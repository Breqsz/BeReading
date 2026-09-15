// Mapa de constancia de 12 semanas (spec 7.9). Substitui o grafico de 14 dias:
// o que importa e o habito, nao o volume de um dia. Colunas sao semanas, linhas
// sao dias (segunda em cima). Para o leitor de tela, uma frase so.
import { StyleSheet, View } from 'react-native';
import { color, space } from '../../theme/tokens';
import { readDaysIn, type ConstancyDay } from './logic';

const CELULA = 14;

export function ConstancyMap({ weeks }: { weeks: ConstancyDay[][] }) {
  const dias = readDaysIn(weeks);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${dias} ${dias === 1 ? 'dia' : 'dias'} com leitura nas últimas ${weeks.length} semanas`}
      style={styles.grade}
    >
      {weeks.map((semana) => (
        <View key={semana[0].date} style={styles.coluna}>
          {semana.map((dia) => (
            <View
              key={dia.date}
              testID={dia.read ? 'constancia-lido' : undefined}
              style={[styles.celula, dia.read ? styles.lido : dia.future ? styles.futuro : styles.vazio]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grade: { flexDirection: 'row', gap: space.xs },
  coluna: { gap: space.xs },
  celula: { width: CELULA, height: CELULA, borderRadius: 3 },
  lido: { backgroundColor: color.accent },
  vazio: { backgroundColor: color.surface2 },
  futuro: { backgroundColor: color.surface1 },
});
