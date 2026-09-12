import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { color } from '../theme/tokens';

interface Props {
  /** De 0 a 1. Valor fora da faixa satura; NaN vira 0. */
  progress: number;
  size: number;
  thickness?: number;
  accessibilityLabel: string;
  children?: React.ReactNode;
}

// O anel e o simbolo do progresso no app inteiro: 38 na Hoje, 84 em Voce, 112
// no resumo e 160 na conquista. A animacao de contagem entra na F7; aqui ele so
// precisa desenhar certo e se anunciar.
export function Ring({ progress, size, thickness = Math.max(3, size * 0.08), accessibilityLabel, children }: Props) {
  const seguro = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const raio = (size - thickness) / 2;
  const circunferencia = 2 * Math.PI * raio;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(seguro * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.surface2} strokeWidth={thickness}
        />
        <Circle
          testID="ring-progress"
          cx={size / 2} cy={size / 2} r={raio}
          fill="none" stroke={color.accent} strokeWidth={thickness} strokeLinecap="round"
          strokeDasharray={`${circunferencia * seguro} ${circunferencia}`}
        />
      </Svg>
      {children ? <View style={styles.center} pointerEvents="none">{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // O arco comeca no topo, nao na direita.
  svg: { transform: [{ rotate: '-90deg' }] },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
