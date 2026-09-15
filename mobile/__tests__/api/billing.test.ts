jest.mock('../../src/lib/supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { billing, getEntitlement, mockBillingProvider } from '../../src/api/billing';
import { supabase } from '../../src/lib/supabase';

const invoke = supabase.functions.invoke as jest.Mock;
const ENTITLEMENT = { plan: 'premium' };

describe('getEntitlement (BER-58)', () => {
  beforeEach(() => invoke.mockReset());

  it('chama a function sem body — o dono é quem está logado', async () => {
    invoke.mockResolvedValue({ data: { data: ENTITLEMENT, error: null }, error: null });
    await expect(getEntitlement()).resolves.toEqual(ENTITLEMENT);
    expect(invoke).toHaveBeenCalledWith('get-entitlement');
  });

  it('erro de rede é relançado', async () => {
    const err = new Error('network');
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(getEntitlement()).rejects.toBe(err);
  });
});

describe('billing (BER-61)', () => {
  beforeEach(() => invoke.mockReset());

  it('hoje aponta para a cobrança simulada', () => {
    expect(billing).toBe(mockBillingProvider);
  });

  it('assinar, cancelar e retomar chamam billing-mock com a ação certa', async () => {
    invoke.mockResolvedValue({ data: { data: ENTITLEMENT, error: null }, error: null });

    await expect(billing.purchase('premium_monthly')).resolves.toEqual(ENTITLEMENT);
    expect(invoke).toHaveBeenLastCalledWith('billing-mock', {
      body: { action: 'subscribe', plan_id: 'premium_monthly' },
    });

    await billing.cancel();
    expect(invoke).toHaveBeenLastCalledWith('billing-mock', { body: { action: 'cancel' } });

    await billing.resume();
    expect(invoke).toHaveBeenLastCalledWith('billing-mock', { body: { action: 'resume' } });
  });

  it('erro de negócio no corpo vira Error', async () => {
    invoke.mockResolvedValue({ data: { data: null, error: 'No active subscription' }, error: null });
    await expect(billing.cancel()).rejects.toThrow('No active subscription');
  });
});
