// Card da Orelha na Hoje (spec S7.1, mockup 04): so aparece quando o
// chamador decidiu que ha assunto (quiz pendente, sequencia em risco ou
// livro parado). A fala (`text`) sempre vem de src/assistant/lines.ts; este
// componente e' so a composicao visual.
import { StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { Text } from '../../ui/Text';
import { Button } from '../../ui/Button';
import { Glyph } from '../../assistant/Glyph';
import { ASSISTANT_NAME } from '../../assistant/persona';
import { color, radius, space } from '../../theme/tokens';

interface Props {
  text: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function AssistantCard({ text, ctaLabel, onPressCta }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.who}>
        {/* Tamanho padrao do Glyph (20): o mesmo do "who" do mockup, sem
            numero novo inventado. */}
        <Glyph />
        <Text variant="label" tone="accent">{ASSISTANT_NAME}</Text>
      </View>
      <Text variant="callout" tone="secondary" style={styles.text}>{text}</Text>
      {ctaLabel && onPressCta ? (
        <Button variant="ghost" size="md" icon={ArrowRight} onPress={onPressCta}>
          {ctaLabel}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface1,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: {},
});
