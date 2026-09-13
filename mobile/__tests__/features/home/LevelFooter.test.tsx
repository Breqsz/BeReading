import { render } from '@testing-library/react-native';
import { LevelFooter } from '../../../src/features/home/LevelFooter';
import { levelFor } from '../../../src/game/xp';

describe('LevelFooter', () => {
  it('mostra nivel, titulo e a fracao de xp ate o proximo nivel', () => {
    const level = levelFor(1840); // nivel 4, Constante, faltam ate o 5
    const { getByText } = render(<LevelFooter level={level} xp={1840} />);
    expect(getByText(`Nível ${level.level} · ${level.title}`)).toBeTruthy();
    expect(getByText(`1.840 / ${String(level.next).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} XP`)).toBeTruthy();
  });

  it('no nivel maximo (sem proximo), mostra so o xp total', () => {
    const level = levelFor(999999); // muito alem do ultimo degrau
    expect(level.next).toBeNull();
    const { getByText } = render(<LevelFooter level={level} xp={999999} />);
    expect(getByText('999.999 XP')).toBeTruthy();
  });
});
