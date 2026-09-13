// O anel grande da conquista (spec S7.3, F4-14 e F4-21): conta de xpBefore ate
// o XP final e, na subida de nivel, completa, zera e continua. A contagem e
// estado do Ring (src/ui); aqui ficam so a sequencia dos trechos, o centro e a
// fala de nivel.
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Ring, Text } from '../../ui';
import { formatXp, type LevelInfo } from '../../game/xp';
import { levelUpLine } from '../../assistant/lines';
import { ringCaption, ringLabel, xpAt, type CountSegment, type XpPlan } from './logic';

export const RING_SIZE = 160; // Documentado em src/ui/Ring.tsx: 160 na conquista.

interface Props {
  plan: XpPlan;
}

export function XpRing({ plan }: Props) {
  const semMovimento = useReducedMotion();
  const [trecho, setTrecho] = useState(0);

  // F4-14: so conta com trecho pra contar (veio xpBefore) e sem reduce motion.
  // Fora disso o anel ja nasce no valor final, sem nem pedir contagem ao Ring:
  // pedindo, ele chegaria no final sozinho, mas o centro mostraria o primeiro
  // trecho por um quadro.
  const segmento: CountSegment | undefined = semMovimento ? undefined : plan.segments[trecho];
  const terminou = segmento === undefined;

  return (
    <>
      <Ring
        progress={plan.finalLevel.progress}
        size={RING_SIZE}
        accessibilityLabel={ringLabel(plan.finalLevel, plan.finalXp)}
        count={segmento && {
          from: segmento.fromProgress,
          to: segmento.toProgress,
          onEnd: () => setTrecho((t) => t + 1),
        }}
      >
        {({ fraction }) => (segmento
          ? <Centro level={segmento.level} xp={xpAt(segmento, fraction)} />
          : <Centro level={plan.finalLevel} xp={plan.finalXp} />)}
      </Ring>
      {plan.leveledUp ? (
        // O lugar da fala existe desde o inicio, invisivel e fora do leitor de
        // tela, para nada pular quando ela aparece no fim da contagem.
        <Text
          variant="subhead"
          tone="accent"
          align="center"
          style={terminou ? undefined : styles.invisivel}
          accessibilityElementsHidden={!terminou}
          importantForAccessibility={terminou ? 'auto' : 'no-hide-descendants'}
        >
          {levelUpLine(plan.finalLevel.level, plan.finalLevel.title)}
        </Text>
      ) : null}
    </>
  );
}

function Centro({ level, xp }: { level: LevelInfo; xp: number }) {
  return (
    <>
      <Text variant="caption" tone="secondary">{`Nível ${level.level}`}</Text>
      <Text variant="numericL">{formatXp(xp)}</Text>
      <Text variant="caption" tone="tertiary">{ringCaption(level)}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  invisivel: { opacity: 0 },
});
