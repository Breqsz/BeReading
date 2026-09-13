import { useEffect, useRef, useState } from 'react';
import { Easing, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color, motion } from '../theme/tokens';

/** Estado counting (DESIGN.md secao 5): um trecho do arco andando em `motion.count`. */
export interface RingCount {
  /** De onde o arco sai, de 0 a 1. */
  from: number;
  /** Onde o arco para neste trecho, de 0 a 1. Padrao: `progress`. */
  to?: number;
  /** Uma vez, quando o trecho termina. Com reduce motion, logo ao montar. */
  onEnd?: () => void;
}

/** O que o anel esta desenhando agora, para o conteudo central contar junto. */
export interface RingFrame {
  /** Onde o arco esta, de 0 a 1. */
  progress: number;
  /** Quanto da contagem ja andou, com a curva aplicada, de 0 a 1. Fora da contagem, 1. */
  fraction: number;
}

interface Props {
  /**
   * De 0 a 1. Valor fora da faixa satura; NaN vira 0. E o valor final: o que o
   * leitor de tela ouve, sempre, mesmo durante a contagem.
   */
  progress: number;
  size: number;
  thickness?: number;
  accessibilityLabel: string;
  /** Sem ele, o anel e estatico (estado default). */
  count?: RingCount;
  /** Conteudo central. Em funcao, recebe o quadro atual e conta junto com o arco. */
  children?: React.ReactNode | ((frame: RingFrame) => React.ReactNode);
}

const EASE_OUT = Easing.out(Easing.cubic);

function saturar(valor: number): number {
  return Number.isFinite(valor) ? Math.min(1, Math.max(0, valor)) : 0;
}

// O anel e o simbolo do progresso no app inteiro: 38 na Hoje, 84 em Voce, 112
// no resumo e 160 na conquista.
//
// Estados do DESIGN.md secao 5. Default: sem `count`, desenha o valor e so; nao
// chama hook de animacao nem agenda quadro. Counting (F4-21): com `count`, o
// arco anda de `from` ate `to` em `motion.count`, ease-out. Reduced motion: com
// `count` e o sistema pedindo menos movimento, aparece direto em `progress`.
//
// Um trecho so por vez, de proposito. A subida de nivel (completa, zera,
// continua) e sequencia de quem usa, trecho a trecho, pelo `onEnd`.
export function Ring({ count, ...resto }: Props) {
  if (count) return <RingContando {...resto} count={count} />;
  const valor = saturar(resto.progress);
  return <Desenho {...resto} quadro={{ progress: valor, fraction: 1 }} />;
}

type SemCount = Omit<Props, 'count'>;

// A contagem anda em requestAnimationFrame no JS, e nao no thread de UI do
// Reanimated. O numero de XP no centro conta junto com o arco, e Text so muda
// por render: um motor so para os dois mantem arco e numero no mesmo quadro.
// Sao 600 ms, uma vez, na conquista. Do Reanimated vem so o useReducedMotion,
// o mesmo do Skeleton.
function RingContando({ count, progress, ...resto }: SemCount & { count: RingCount }) {
  const semMovimento = useReducedMotion();
  const de = saturar(count.from);
  const ate = saturar(count.to ?? progress);

  // O trecho e o par de valores, e nao o objeto `count`: quem usa passa objeto
  // novo a cada render, e isso nao pode reiniciar a contagem.
  const trecho = `${de}:${ate}`;
  const [andado, setAndado] = useState({ trecho, fraction: 0 });

  // O onEnd mais recente, fora das dependencias do efeito pelo mesmo motivo.
  const aoTerminar = useRef(count.onEnd);
  aoTerminar.current = count.onEnd;

  useEffect(() => {
    if (semMovimento) {
      aoTerminar.current?.();
      return;
    }
    const inicio = Date.now();
    let quadro = requestAnimationFrame(function passo() {
      const t = Math.min(1, (Date.now() - inicio) / motion.count.duration);
      setAndado({ trecho, fraction: EASE_OUT(t) });
      if (t < 1) quadro = requestAnimationFrame(passo);
      else aoTerminar.current?.();
    });
    return () => cancelAnimationFrame(quadro);
  }, [trecho, semMovimento]);

  // Trecho novo ainda sem quadro comeca do `from`. Sem isto, o primeiro render
  // dele usaria a fracao cheia do trecho anterior e desenharia o fim antes.
  const fraction = semMovimento ? 1 : andado.trecho === trecho ? andado.fraction : 0;
  const desenhado = semMovimento ? saturar(progress) : de + (ate - de) * fraction;

  return <Desenho {...resto} progress={progress} quadro={{ progress: desenhado, fraction }} />;
}

function Desenho({
  progress, size, thickness = Math.max(3, size * 0.08), accessibilityLabel, quadro, children,
}: SemCount & { quadro: RingFrame }) {
  const raio = (size - thickness) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const centro = typeof children === 'function' ? children(quadro) : children;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(saturar(progress) * 100) }}
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
          strokeDasharray={`${circunferencia * quadro.progress} ${circunferencia}`}
        />
      </Svg>
      {centro ? <View style={styles.center} pointerEvents="none">{centro}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // O arco comeca no topo, nao na direita.
  svg: { transform: [{ rotate: '-90deg' }] },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
