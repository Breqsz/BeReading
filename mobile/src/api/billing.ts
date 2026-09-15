// src/api/billing.ts
// BER-61: plano do leitor e cobrança.
//
// `billing` é o único ponto que o app usa para assinar, cancelar e retomar. Hoje
// ele aponta para a cobrança SIMULADA (`billing-mock`); a integração com a loja
// (App Store / Google Play) entra trocando esta implementação, sem mexer nas telas.
import { supabase } from '../lib/supabase';
import type { Entitlement } from '../utils/billing';

/** Plano, limites e uso do leitor logado. */
export async function getEntitlement(): Promise<Entitlement> {
  const { data, error } = await supabase.functions.invoke('get-entitlement');
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.data as Entitlement;
}

export interface BillingProvider {
  /** Assina o plano; resolve com o plano já atualizado. */
  purchase(planId: string): Promise<Entitlement>;
  /** Cancela a renovação — o Premium vale até o fim do período pago. */
  cancel(): Promise<Entitlement>;
  /** Desfaz o cancelamento antes do fim do período. */
  resume(): Promise<Entitlement>;
}

async function invokeMockBilling(body: Record<string, string>): Promise<Entitlement> {
  const { data, error } = await supabase.functions.invoke('billing-mock', { body });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.data as Entitlement;
}

/** Cobrança simulada: grava a assinatura no servidor sem cobrar nada. */
export const mockBillingProvider: BillingProvider = {
  purchase: (planId) => invokeMockBilling({ action: 'subscribe', plan_id: planId }),
  cancel: () => invokeMockBilling({ action: 'cancel' }),
  resume: () => invokeMockBilling({ action: 'resume' }),
};

export const billing: BillingProvider = mockBillingProvider;
