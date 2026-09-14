import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Crown } from 'lucide-react-native';
import { TopBar } from '../src/components/TopBar';
import { Card } from '../src/components/Card';
import { Press3DButton } from '../src/components/Press3DButton';
import { GhostButton } from '../src/components/GhostButton';
import { useEntitlementStore } from '../src/stores/entitlementStore';
import { billing } from '../src/api/billing';
import { formatDateBR, formatPrice, planFeatures, type Entitlement } from '../src/utils/billing';
import { colors, fonts } from '../src/theme/tokens';

// BER-61: comparação dos planos e gestão da assinatura (assinar, cancelar, retomar).
export default function PlanosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entitlement, refresh, setEntitlement } = useEntitlementStore();
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refresh]);

  if (!entitlement) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <TopBar title="Planos" onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 18 }}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.gold} />
          ) : (
            <>
              <Text style={{
                fontFamily: fonts.medium,
                fontSize: 15,
                color: colors.textSoft,
                textAlign: 'center',
              }}>Não foi possível carregar os planos.</Text>
              <View style={{ width: '70%' }}>
                <Press3DButton onPress={() => {
                  setLoading(true);
                  refresh().finally(() => setLoading(false));
                }}>
                  Tentar de novo
                </Press3DButton>
              </View>
            </>
          )}
        </View>
      </View>
    );
  }

  const premium = entitlement.plan === 'premium';
  const subscription = entitlement.subscription;
  const price = formatPrice(entitlement.premium_plan.price_cents);
  const periodEnd = subscription ? formatDateBR(subscription.current_period_end) : null;
  const features = planFeatures(entitlement);

  async function run(action: () => Promise<Entitlement>) {
    if (working) return;
    setWorking(true);
    try {
      setEntitlement(await action());
    } catch (e: unknown) {
      Alert.alert('Não foi possível concluir', e instanceof Error ? e.message : 'Tente novamente');
    } finally {
      setWorking(false);
    }
  }

  function handleCancel() {
    Alert.alert(
      'Cancelar assinatura?',
      `Você continua com o Premium até ${periodEnd}. Depois disso, sua conta volta para o plano gratuito — nada do seu progresso é apagado.`,
      [
        { text: 'Manter Premium', style: 'cancel' },
        { text: 'Cancelar assinatura', style: 'destructive', onPress: () => run(() => billing.cancel()) },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopBar title="Planos" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 18 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: colors.gold,
            borderBottomWidth: 5,
            borderBottomColor: colors.goldDeep,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Crown size={34} color="#fff" strokeWidth={2.2} />
          </View>
          <Text style={{
            fontFamily: fonts.black,
            fontSize: 26,
            color: colors.text,
            letterSpacing: -0.5,
            textAlign: 'center',
          }}>{premium ? 'Você é Premium' : 'Leia sem limites'}</Text>
          <Text style={{
            fontFamily: fonts.medium,
            fontSize: 14,
            color: colors.textSoft,
            textAlign: 'center',
            lineHeight: 21,
            paddingHorizontal: 12,
          }}>
            {premium
              ? 'Obrigado por ler com o BeReading. Seus livros e quizzes não têm limite.'
              : 'Acompanhe quantos livros quiser e receba perguntas e feedback da IA em todos os capítulos.'}
          </Text>
        </View>

        <PlanOption
          name={entitlement.premium_plan.name}
          price={price}
          period="/mês"
          features={features.premium}
          current={premium}
          highlight
        />
        <PlanOption
          name="Gratuito"
          price="R$ 0"
          features={features.free}
          current={!premium}
        />

        {!premium && (
          <View style={{ gap: 10 }}>
            <Press3DButton onPress={() => router.push('/checkout')} color="gold" size="lg" Icon={Crown}>
              {`Assinar por ${price}/mês`}
            </Press3DButton>
            <Text style={{
              fontFamily: fonts.medium,
              fontSize: 12,
              color: colors.textMute,
              textAlign: 'center',
            }}>Renovação mensal automática. Cancele quando quiser.</Text>
          </View>
        )}

        {premium && subscription && !subscription.cancel_at_period_end && (
          <View style={{ gap: 10 }}>
            <Text style={{
              fontFamily: fonts.semi,
              fontSize: 13,
              color: colors.textSoft,
              textAlign: 'center',
            }}>Sua assinatura renova em {periodEnd}.</Text>
            <GhostButton onPress={handleCancel}>
              {working ? 'Cancelando…' : 'Cancelar assinatura'}
            </GhostButton>
          </View>
        )}

        {premium && subscription?.cancel_at_period_end && (
          <View style={{ gap: 10 }}>
            <Text style={{
              fontFamily: fonts.semi,
              fontSize: 13,
              color: colors.textSoft,
              textAlign: 'center',
              lineHeight: 19,
            }}>Seu Premium vale até {periodEnd} e não será renovado.</Text>
            <Press3DButton onPress={() => run(() => billing.resume())} disabled={working} color="gold">
              {working ? 'Retomando…' : 'Retomar assinatura'}
            </Press3DButton>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PlanOption({
  name,
  price,
  period,
  features,
  current,
  highlight = false,
}: {
  name: string;
  price: string;
  period?: string;
  features: string[];
  current: boolean;
  highlight?: boolean;
}) {
  const accent = highlight ? colors.gold : colors.green;

  return (
    <Card style={{
      padding: 18,
      gap: 14,
      borderWidth: highlight ? 2 : 1,
      borderColor: highlight ? colors.gold : colors.hairline,
    }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {highlight && <Crown size={18} color={colors.gold} strokeWidth={2.4} />}
          <Text style={{ fontFamily: fonts.black, fontSize: 18, color: colors.text }}>{name}</Text>
        </View>
        {current && (
          <View style={{
            paddingHorizontal: 10,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: `${colors.green}22`,
            borderWidth: 1,
            borderColor: `${colors.green}55`,
          }}>
            <Text style={{
              fontFamily: fonts.black,
              fontSize: 10.5,
              color: colors.green,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>Seu plano</Text>
          </View>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
        <Text style={{
          fontFamily: fonts.black,
          fontSize: 30,
          color: highlight ? colors.gold : colors.text,
          letterSpacing: -1,
        }}>{price}</Text>
        {period && (
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textMute }}>{period}</Text>
        )}
      </View>

      <View style={{ gap: 10 }}>
        {features.map((feature) => (
          <View key={feature} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ paddingTop: 2 }}>
              <Check size={16} color={accent} strokeWidth={3} />
            </View>
            <Text style={{
              flex: 1,
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.textSoft,
              lineHeight: 20,
            }}>{feature}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
