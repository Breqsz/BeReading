import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import * as SafeAreaContext from 'react-native-safe-area-context';
import { Text } from './Text';
import { elevation, radius, space } from '../theme/tokens';

type SafeAreaModule = typeof SafeAreaContext;

// O mock oficial do pacote (react-native-safe-area-context/jest/mock, usado em
// jest.setup.ui.js) faz `export default {...}`; passado pelo babel deste
// projeto (CommonJS), isso aninha os hooks dentro de ".default" em vez de
// exporta-los no topo do modulo, como o pacote real faz em runtime. Resolve os
// dois formatos aqui, sem tocar no setup global do Jest (outras suites usam).
const safeArea: SafeAreaModule =
  'useSafeAreaInsets' in SafeAreaContext
    ? SafeAreaContext
    : (SafeAreaContext as unknown as { default: SafeAreaModule }).default;
const { useSafeAreaInsets } = safeArea;

export interface ToastOptions {
  message: string;
  detail?: string;
  tone?: 'success' | 'error' | 'info';
  actionLabel?: string;
  onAction?: () => void;
}

const DURATION_MS = 4000;

const ToastContext = createContext<{ show: (o: ToastOptions) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa de um ToastProvider acima na arvore');
  return ctx;
}

// Substitui os 20 Alert.alert do app. O alerta de sistema tapa a tela, exige um
// toque para sumir e some sem deixar rastro; o toast confirma e sai sozinho.
// So confirmacao destrutiva continua em dialogo.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const limpar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const show = useCallback((o: ToastOptions) => {
    // Toast novo substitui o anterior: empilhar esconde a tela.
    limpar();
    setToast(o);
    timer.current = setTimeout(() => setToast(null), DURATION_MS);
  }, [limpar]);

  // O timer pendente dispararia contra uma arvore ja desmontada.
  useEffect(() => limpar, [limpar]);

  const valor = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      {toast ? (
        <Animated.View
          entering={FadeInDown.duration(240)}
          exiting={FadeOutDown.duration(160)}
          accessible
          accessibilityRole="alert"
          style={[styles.wrap, elevation.floating, { bottom: insets.bottom + 90 }]}
        >
          <View style={styles.texts}>
            <Text variant="callout">{toast.message}</Text>
            {toast.detail ? <Text variant="caption" tone="secondary">{toast.detail}</Text> : null}
          </View>
          {toast.actionLabel && toast.onAction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={toast.actionLabel}
              hitSlop={8}
              onPress={() => { limpar(); setToast(null); toast.onAction?.(); }}
            >
              <Text variant="label" tone="accent">{toast.actionLabel}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.control + 2,
  },
  texts: { flex: 1, gap: 1 },
});
