// Reanimated roda em worklet no aparelho; no Jest, o mock oficial devolve a API
// sincrona. Sem isto, todo componente com animacao quebra no teste.
require('@testing-library/jest-native/extend-expect');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// useSafeAreaInsets lanca fora de um SafeAreaProvider. O mock oficial do pacote
// devolve insets zerados, que e o que o teste precisa.
jest.mock('react-native-safe-area-context', () => {
  // O mock oficial do pacote exporta como `default` sob o babel deste projeto,
  // enquanto o pacote real exporta os hooks no topo do modulo. Normaliza aqui,
  // para nenhum componente precisar saber disso.
  const m = require('react-native-safe-area-context/jest/mock');
  return m.default ?? m;
});
