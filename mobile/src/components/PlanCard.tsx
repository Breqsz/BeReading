import { View, Text } from 'react-native';
import { Crown } from 'lucide-react-native';
import { Card } from './Card';
import { Press3DButton } from './Press3DButton';
import { GhostButton } from './GhostButton';
import { colors, fonts } from '../theme/tokens';
import { planSummary, type Entitlement } from '../utils/billing';

interface PlanCardProps {
  entitlement: Entitlement | null;
  onPress: () => void;
}

/** BER-61: plano atual no perfil — uso do gratuito ou renovação do Premium. */
export function PlanCard({ entitlement, onPress }: PlanCardProps) {
  if (!entitlement) return null;

  const premium = entitlement.plan === 'premium';
  const { title, lines } = planSummary(entitlement);

  return (
    <Card style={{ padding: 16, gap: 14, borderColor: premium ? `${colors.gold}55` : colors.hairline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          backgroundColor: premium ? colors.gold : colors.surface,
          borderBottomWidth: 3,
          borderBottomColor: premium ? colors.goldDeep : colors.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Crown size={20} color={premium ? '#fff' : colors.textSoft} strokeWidth={2.4} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 16,
            color: premium ? colors.gold : colors.text,
          }}>{title}</Text>
          {lines.map((line) => (
            <Text key={line} style={{
              fontFamily: fonts.semi,
              fontSize: 12,
              color: colors.textMute,
              marginTop: 2,
            }}>{line}</Text>
          ))}
        </View>
      </View>

      {premium ? (
        <GhostButton onPress={onPress}>Gerenciar assinatura</GhostButton>
      ) : (
        <Press3DButton onPress={onPress} color="gold" size="sm" Icon={Crown}>
          Conhecer o Premium
        </Press3DButton>
      )}
    </Card>
  );
}
