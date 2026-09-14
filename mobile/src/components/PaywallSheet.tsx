import { Modal, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown } from 'lucide-react-native';
import { Press3DButton } from './Press3DButton';
import { GhostButton } from './GhostButton';
import { colors, fonts, radii } from '../theme/tokens';
import { paywallCopy, type QuotaExceeded } from '../utils/billing';

interface PaywallSheetProps {
  /** Limite atingido; `null` fecha a folha. */
  quota: QuotaExceeded | null;
  onDismiss: () => void;
}

/**
 * BER-58: o leitor bateu num limite do plano gratuito. É um convite para o
 * Premium, não uma mensagem de erro — e sempre dá para dispensar.
 */
export function PaywallSheet({ quota, onDismiss }: PaywallSheetProps) {
  const router = useRouter();
  const copy = quota ? paywallCopy(quota) : null;

  function handleUpgrade() {
    onDismiss();
    router.push('/planos');
  }

  return (
    <Modal visible={!!quota} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          onPress={onDismiss}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' }}
        />
        {copy && (
          <View style={{
            backgroundColor: colors.bgRaise,
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.hairline,
            paddingHorizontal: 24,
            paddingTop: 18,
            paddingBottom: 36,
            alignItems: 'center',
          }}>
            <View style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.surface,
              marginBottom: 20,
            }} />

            <View style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              backgroundColor: colors.gold,
              borderBottomWidth: 4,
              borderBottomColor: colors.goldDeep,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
            }}>
              <Crown size={30} color="#fff" strokeWidth={2.2} />
            </View>

            <Text style={{
              fontFamily: fonts.black,
              fontSize: 22,
              color: colors.text,
              letterSpacing: -0.3,
              textAlign: 'center',
              marginBottom: 8,
            }}>{copy.title}</Text>
            <Text style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.textSoft,
              textAlign: 'center',
              lineHeight: 21,
              marginBottom: copy.hint ? 10 : 24,
            }}>{copy.description}</Text>
            {copy.hint && (
              <Text style={{
                fontFamily: fonts.semi,
                fontSize: 13,
                color: colors.textMute,
                textAlign: 'center',
                lineHeight: 19,
                marginBottom: 24,
              }}>{copy.hint}</Text>
            )}

            <Press3DButton onPress={handleUpgrade} color="gold" Icon={Crown}>
              Conhecer o Premium
            </Press3DButton>
            <View style={{ marginTop: 12, width: '100%' }}>
              <GhostButton onPress={onDismiss}>Agora não</GhostButton>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
