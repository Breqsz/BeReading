import { create } from 'zustand';
import { getEntitlement } from '../api/billing';
import type { Entitlement } from '../utils/billing';

/**
 * Plano do leitor (BER-58 / BER-61), compartilhado entre as telas.
 *
 * É só cache para exibição: o servidor aplica os limites de qualquer jeito.
 */
interface EntitlementState {
  entitlement: Entitlement | null;
  setEntitlement: (entitlement: Entitlement | null) => void;
  /** Busca de novo no servidor. Em falha, mantém o que tinha e devolve `null`. */
  refresh: () => Promise<Entitlement | null>;
  clear: () => void;
}

export const useEntitlementStore = create<EntitlementState>((set) => ({
  entitlement: null,
  setEntitlement: (entitlement) => set({ entitlement }),
  refresh: async () => {
    try {
      const entitlement = await getEntitlement();
      set({ entitlement });
      return entitlement;
    } catch {
      return null;
    }
  },
  clear: () => set({ entitlement: null }),
}));
