import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Crown } from 'lucide-react-native';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { Press3DButton } from '../src/components/Press3DButton';
import { QuizMessageScreen, QuizMessageIconBadge } from '../src/components/QuizMessageScreen';
import { useAuthStore } from '../src/stores/authStore';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { billing } from '../src/api/billing';
import { formatPrice } from '../src/utils/billing';
import { colors, fonts } from '../src/theme/tokens';

// BER-61: confirmação da assinatura, no formato da folha de compra da loja —
// com compra in-app, quem coleta o pagamento é a App Store / Google Play, então
// o app nunca tem campo de cartão. Por ora `billing` é a cobrança simulada.

/** A confirmação não "pisca": dá o mesmo ritmo de uma compra na loja. */
const MIN_PROCESSING_MS = 1200;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Step = 'confirm' | 'processing' | 'success';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { entitlement, setEntitlement } = useEntitlementStore();
  const [step, setStep] = useState<Step>('confirm');

  const plan = entitlement?.premium_plan;

  if (!plan) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Confirmar assinatura" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.textSoft, textAlign: 'center' }}>
            Plano indisponível no momento.
          </Text>
        </View>
      </View>
    );
  }

  const price = formatPrice(plan.price_cents);

  async function handleConfirm() {
    if (step !== 'confirm' || !plan) return;
    setStep('processing');
    try {
      const [updated] = await Promise.all([billing.purchase(plan.id), wait(MIN_PROCESSING_MS)]);
      setEntitlement(updated);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      setStep('success');
    } catch (e: unknown) {
      Alert.alert('Não foi possível concluir a assinatura', e instanceof Error ? e.message : 'Tente novamente');
      setStep('confirm');
    }
  }

  if (step === 'success') {
    return (
      <QuizMessageScreen
        paddingTop={insets.top + 80}
        paddingBottom={insets.bottom + 40}
        icon={
          <QuizMessageIconBadge background={colors.gold} borderColor={colors.goldDeep}>
            <Crown size={32} color="#fff" strokeWidth={2.2} />
          </QuizMessageIconBadge>
        }
        title={`Bem-vindo ao ${plan.name}!`}
        description="Agora você lê quantos livros quiser e responde todos os quizzes, com feedback da IA em cada resposta."
      >
        <View style={{ width: '100%' }}>
          {/* Fecha a confirmação e os planos: volta para onde o leitor estava. */}
          <Press3DButton onPress={() => router.dismiss(2)} color="gold" size="lg">
            Continuar
          </Press3DButton>
        </View>
      </QuizMessageScreen>
    );
  }

  const processing = step === 'processing';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Confirmar assinatura" onBack={() => { if (!processing) router.back(); }} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <Card style={{ padding: 18, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: colors.gold,
              borderBottomWidth: 3,
              borderBottomColor: colors.goldDeep,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Crown size={24} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.black, fontSize: 17, color: colors.text }}>
                BeReading {plan.name}
              </Text>
              <Text style={{ fontFamily: fonts.semi, fontSize: 12, color: colors.textMute, marginTop: 2 }}>
                Assinatura mensal
              </Text>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.divider }} />

          <SummaryRow label="Valor" value={`${price}/mês`} />
          <SummaryRow label="Renovação" value="Automática, todo mês" />
          <SummaryRow label="Conta" value={session?.user.email ?? '—'} />
          <SummaryRow
            label="Pagamento"
            value={Platform.OS === 'ios' ? 'Conta da App Store' : 'Conta do Google Play'}
          />
        </Card>

        <Text style={{
          fontFamily: fonts.medium,
          fontSize: 13,
          color: colors.textMute,
          lineHeight: 19,
          textAlign: 'center',
          paddingHorizontal: 8,
        }}>
          Hoje você paga {price}. A assinatura renova automaticamente a cada mês e pode ser
          cancelada a qualquer momento em Perfil → Gerenciar assinatura.
        </Text>

        <Press3DButton onPress={handleConfirm} disabled={processing} color="gold" size="lg">
          {processing ? 'Processando…' : `Assinar por ${price}/mês`}
        </Press3DButton>
        {processing && <ActivityIndicator color={colors.gold} />}
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
      <Text style={{ fontFamily: fonts.semi, fontSize: 13, color: colors.textMute }}>{label}</Text>
      <Text numberOfLines={1} style={{
        flexShrink: 1,
        fontFamily: fonts.bold,
        fontSize: 13,
        color: colors.text,
        textAlign: 'right',
      }}>{value}</Text>
    </View>
  );
}
