import { render, act } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';

// Estado counting do Ring (DESIGN.md secao 5, F4-21). Arquivo separado de
// Progress.test.tsx de proposito: aquele arquivo nao mocka useReducedMotion
// (o mock oficial do Reanimated nao traz o hook), e continuar passando sem o
// mock e a prova de que o anel sem `count` nao chama nada de animacao.
let mockReducedMotion = false;
jest.mock('react-native-reanimated', () => {
  const real = jest.requireActual('react-native-reanimated/mock');
  return { ...real, useReducedMotion: () => mockReducedMotion };
});

import { Ring, type RingFrame } from '../../src/ui/Ring';
import { motion } from '../../src/theme/tokens';

const DURACAO = motion.count.duration;
const METADE = DURACAO / 2;
// Um quadro de folga: a contagem anda em requestAnimationFrame (16 ms), entao
// o ultimo quadro pode cair logo depois dos 600 ms.
const FOLGA = 20;

// Mesma leitura de Progress.test.tsx: o Circle normaliza o dasharray para
// array de strings antes de expor a prop.
function lerDasharray(valor: unknown): [number, number] {
  const partes = Array.isArray(valor) ? valor : String(valor).trim().split(/[\s,]+/);
  return [Number(partes[0]), Number(partes[1])];
}

function arco(getByTestId: (id: string) => { props: { strokeDasharray?: unknown } }): number {
  const [preenchido, total] = lerDasharray(getByTestId('ring-progress').props.strokeDasharray);
  return preenchido / total;
}

function anunciado(getByLabelText: (l: string) => { props: { accessibilityValue?: { now?: number } } }, label: string) {
  return getByLabelText(label).props.accessibilityValue?.now;
}

/** Filho em render prop que grava cada quadro que o anel desenhou. */
function gravador() {
  const quadros: RingFrame[] = [];
  const filho = (q: RingFrame) => {
    quadros.push(q);
    return <RNText>{`fração ${q.fraction.toFixed(2)}`}</RNText>;
  };
  return { quadros, filho };
}

describe('Ring: estado counting (DESIGN.md secao 5, F4-21)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sem count, o anel e estatico: nasce no valor e nao agenda quadro nenhum', () => {
    const { quadros, filho } = gravador();
    const { getByTestId } = render(
      <Ring progress={0.5} size={100} accessibilityLabel="Nível 4">{filho}</Ring>,
    );
    expect(arco(getByTestId)).toBeCloseTo(0.5, 3);
    expect(jest.getTimerCount()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(DURACAO + FOLGA);
    });
    expect(arco(getByTestId)).toBeCloseTo(0.5, 3);
    // Fora da contagem o quadro e o proprio valor, com a fracao cheia. O
    // length antes do every: every de lista vazia passa sozinho.
    expect(quadros.length).toBeGreaterThan(0);
    expect(quadros.every((q) => q.progress === 0.5 && q.fraction === 1)).toBe(true);
  });

  it('com count, sai de from, passa por valor intermediario em ease-out e para no progress', () => {
    const onEnd = jest.fn();
    const { getByTestId } = render(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ from: 0.2, onEnd }} />,
    );
    expect(arco(getByTestId)).toBeCloseTo(0.2, 3);

    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    const meio = arco(getByTestId);
    // Ease-out: na metade do tempo ja passou da metade do caminho (0,5). Linear
    // daria no maximo 0,5; salto direto daria 0,8.
    expect(meio).toBeGreaterThan(0.2 + 0.6 * 0.5);
    expect(meio).toBeLessThan(0.79);
    expect(onEnd).not.toHaveBeenCalled();

    // Ainda contando um pouco antes do fim: a duracao e a do token.
    act(() => {
      jest.advanceTimersByTime(METADE - 50);
    });
    expect(arco(getByTestId)).toBeLessThan(0.8);
    expect(onEnd).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(50 + FOLGA);
    });
    expect(arco(getByTestId)).toBeCloseTo(0.8, 3);
    expect(onEnd).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('o render prop recebe a fracao andando junto com o arco', () => {
    const { quadros, filho } = gravador();
    render(
      <Ring progress={1} size={100} accessibilityLabel="Nível 4" count={{ from: 0 }}>{filho}</Ring>,
    );
    expect(quadros[quadros.length - 1]).toEqual({ progress: 0, fraction: 0 });

    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    const meio = quadros[quadros.length - 1];
    expect(meio.fraction).toBeGreaterThan(0);
    expect(meio.fraction).toBeLessThan(1);
    expect(meio.progress).toBeCloseTo(meio.fraction, 5);

    act(() => {
      jest.advanceTimersByTime(METADE + FOLGA);
    });
    expect(quadros[quadros.length - 1]).toEqual({ progress: 1, fraction: 1 });
  });

  it('o leitor de tela ouve o valor final durante a contagem inteira, nao o intermediario', () => {
    const { getByTestId, getByLabelText } = render(
      <Ring progress={0.3} size={100} accessibilityLabel="Nível 5" count={{ from: 0.9, to: 1 }} />,
    );
    expect(anunciado(getByLabelText, 'Nível 5')).toBe(30);

    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    expect(arco(getByTestId)).toBeGreaterThan(0.9);
    expect(anunciado(getByLabelText, 'Nível 5')).toBe(30);

    act(() => {
      jest.advanceTimersByTime(METADE + FOLGA);
    });
    // `to` e onde este trecho para; `progress` e o que o leitor de tela ouve.
    expect(arco(getByTestId)).toBeCloseTo(1, 3);
    expect(anunciado(getByLabelText, 'Nível 5')).toBe(30);
  });

  it('um trecho novo recomeca do from, sem nenhum quadro repetindo o fim do trecho anterior', () => {
    const primeiro = jest.fn();
    const segundo = jest.fn();
    const { quadros, filho } = gravador();
    const { getByTestId, rerender } = render(
      <Ring progress={0.3} size={100} accessibilityLabel="X" count={{ from: 0.9, to: 1, onEnd: primeiro }}>
        {filho}
      </Ring>,
    );
    act(() => {
      jest.advanceTimersByTime(DURACAO + FOLGA);
    });
    expect(arco(getByTestId)).toBeCloseTo(1, 3);
    expect(primeiro).toHaveBeenCalledTimes(1);

    const desde = quadros.length;
    rerender(
      <Ring progress={0.3} size={100} accessibilityLabel="X" count={{ from: 0, onEnd: segundo }}>
        {filho}
      </Ring>,
    );
    expect(arco(getByTestId)).toBeCloseTo(0, 3);
    // Sem isto, o primeiro render do trecho novo ainda usaria a fracao cheia
    // do trecho velho e desenharia o fim (0,3) antes de voltar ao zero.
    expect(quadros.slice(desde).length).toBeGreaterThan(0);
    expect(quadros.slice(desde).every((q) => q.fraction === 0 && q.progress === 0)).toBe(true);

    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    expect(arco(getByTestId)).toBeGreaterThan(0);
    expect(arco(getByTestId)).toBeLessThan(0.3);

    act(() => {
      jest.advanceTimersByTime(METADE + FOLGA);
    });
    expect(arco(getByTestId)).toBeCloseTo(0.3, 3);
    expect(segundo).toHaveBeenCalledTimes(1);
    expect(primeiro).toHaveBeenCalledTimes(1);
  });

  it('trocar so o onEnd no meio nao reinicia a contagem, e o fim chama o onEnd mais novo', () => {
    const velho = jest.fn();
    const novo = jest.fn();
    const { getByTestId, rerender } = render(
      <Ring progress={0.8} size={100} accessibilityLabel="X" count={{ from: 0.2, onEnd: velho }} />,
    );
    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    const meio = arco(getByTestId);
    expect(meio).toBeGreaterThan(0.5);

    rerender(<Ring progress={0.8} size={100} accessibilityLabel="X" count={{ from: 0.2, onEnd: novo }} />);
    expect(arco(getByTestId)).toBeCloseTo(meio, 5);

    act(() => {
      jest.advanceTimersByTime(METADE + FOLGA);
    });
    expect(arco(getByTestId)).toBeCloseTo(0.8, 3);
    expect(novo).toHaveBeenCalledTimes(1);
    expect(velho).not.toHaveBeenCalled();
  });

  it('com reduce motion, aparece direto no valor final, sem quadro intermediario, e avisa o fim', () => {
    mockReducedMotion = true;
    const onEnd = jest.fn();
    const { quadros, filho } = gravador();
    const { getByTestId } = render(
      <Ring progress={0.8} size={100} accessibilityLabel="Nível 4" count={{ from: 0.2, onEnd }}>
        {filho}
      </Ring>,
    );
    expect(arco(getByTestId)).toBeCloseTo(0.8, 3);
    expect(quadros.length).toBeGreaterThan(0);
    expect(quadros.every((q) => q.progress === 0.8 && q.fraction === 1)).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    expect(arco(getByTestId)).toBeCloseTo(0.8, 3);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('desmontar no meio da contagem cancela o quadro e nao avisa fim', () => {
    const onEnd = jest.fn();
    const { unmount } = render(
      <Ring progress={0.8} size={100} accessibilityLabel="X" count={{ from: 0.2, onEnd }} />,
    );
    act(() => {
      jest.advanceTimersByTime(METADE);
    });
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    act(() => {
      jest.advanceTimersByTime(DURACAO);
    });
    expect(onEnd).not.toHaveBeenCalled();
  });
});
