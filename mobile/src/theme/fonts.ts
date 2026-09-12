import {
  useFonts,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  useFonts as useNewsreader,
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from '@expo-google-fonts/newsreader';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';

export function useLuminousFonts(): boolean {
  const [fontsLoaded] = useFonts({
    PlusJakarta_500Medium: PlusJakartaSans_500Medium,
    PlusJakarta_600SemiBold: PlusJakartaSans_600SemiBold,
    PlusJakarta_700Bold: PlusJakartaSans_700Bold,
    PlusJakarta_800ExtraBold: PlusJakartaSans_800ExtraBold,
  });
  return fontsLoaded;
}

/**
 * As fontes do redesign, com a chave igual ao valor de `fontFamily` em tokens.ts.
 * O teste garante que as duas listas não se separem: peso citado no token e não
 * carregado vira texto no fallback do sistema, que é o tipo de falha que só
 * aparece no aparelho.
 */
export const APP_FONT_MAP = {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} as const;

export function useAppFonts(): boolean {
  const [loaded] = useNewsreader(APP_FONT_MAP);
  return loaded;
}
