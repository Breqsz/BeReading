import { render } from '@testing-library/react-native';
import { StreakWeek } from '../../../src/features/home/StreakWeek';
import type { WeekDay } from '../../../src/game/streak';

const dias: WeekDay[] = [
  { date: '2026-09-07', letter: 'S', read: true, isToday: false },
  { date: '2026-09-08', letter: 'T', read: true, isToday: false },
  { date: '2026-09-09', letter: 'Q', read: true, isToday: false },
  { date: '2026-09-10', letter: 'Q', read: true, isToday: false },
  { date: '2026-09-11', letter: 'S', read: false, isToday: true },
  { date: '2026-09-12', letter: 'S', read: false, isToday: false },
  { date: '2026-09-13', letter: 'D', read: false, isToday: false },
];

describe('StreakWeek', () => {
  it('mostra a frase da sequencia', () => {
    const { getByText } = render(<StreakWeek days={dias} streakText="4 dias seguidos. Lê hoje e vira 5." />);
    expect(getByText('4 dias seguidos. Lê hoje e vira 5.')).toBeTruthy();
  });

  it('renderiza as sete letras da semana, uma por dia', () => {
    const { getAllByText } = render(<StreakWeek days={dias} streakText="x" />);
    // "S" aparece duas vezes (segunda e sabado) e "Q" duas vezes: soma 7 letras ao todo.
    const letras = ['S', 'T', 'Q', 'D'].flatMap((l) => getAllByText(l));
    expect(letras.length).toBe(7);
  });

  it('marca o dia de hoje de forma distinguivel dos outros nao lidos', () => {
    const { getByTestId } = render(<StreakWeek days={dias} streakText="x" />);
    // O dia de hoje (indice 4, sexta) nao foi lido mas e' hoje: testID proprio.
    expect(getByTestId('week-day-today')).toBeTruthy();
  });
});
