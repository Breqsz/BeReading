jest.mock('../../src/api/queries', () => ({
  getReadingSessions: jest.fn(),
  getMyAnswers: jest.fn(),
  getStudentBadges: jest.fn(),
  getStreak: jest.fn(),
}));

import { useProgressStore } from '../../src/stores/progressStore';
import {
  getReadingSessions,
  getMyAnswers,
  getStudentBadges,
  getStreak,
} from '../../src/api/queries';
import type { MyAnswer } from '../../src/api/queries';
import { totalXp, levelFor } from '../../src/game/xp';
import type { ReadingSession, Streak, Badge, StudentBadge } from '../../src/types/database';

const mockedGetReadingSessions = getReadingSessions as jest.Mock;
const mockedGetMyAnswers = getMyAnswers as jest.Mock;
const mockedGetStudentBadges = getStudentBadges as jest.Mock;
const mockedGetStreak = getStreak as jest.Mock;

const sessao = (pages_read: number): ReadingSession => ({
  id: `s-${pages_read}`,
  user_id: 'u1',
  book_id: 'b1',
  start_page: 1,
  end_page: pages_read,
  pages_read,
  read_at: '2026-09-13T12:00:00.000Z',
});

const resposta = (score: number | null, status: MyAnswer['evaluation_status'] = 'completed'): MyAnswer => ({
  id: `a-${Math.random()}`,
  question_id: 'q1',
  user_id: 'u1',
  answer_text: 'resposta',
  comprehension_score: score,
  ai_feedback: null,
  answered_at: '2026-09-13T12:00:00.000Z',
  evaluation_status: status,
  evaluated_at: '2026-09-13T12:00:00.000Z',
  question: { chapter_id: 'ch1' },
});

const badge: Badge = {
  id: 'bd1',
  name: 'Primeira leitura',
  description: 'Leu a primeira sessão',
  icon_url: null,
  criteria_type: 'total_sessions',
  criteria_value: 1,
};

const studentBadge = (id: string): StudentBadge & { badge: Badge } => ({
  id,
  user_id: 'u1',
  badge_id: badge.id,
  earned_at: '2026-09-13T12:00:00.000Z',
  badge,
});

const streak: Streak = {
  id: 'st1',
  user_id: 'u1',
  current_streak: 3,
  longest_streak: 5,
  last_read_date: '2026-09-13',
};

const INITIAL_STATE = {
  sessions: [] as ReadingSession[],
  answers: [] as MyAnswer[],
  badges: [] as (StudentBadge & { badge: Badge })[],
  streak: null as Streak | null,
  xp: 0,
  level: levelFor(0),
  previous: { xp: 0, level: levelFor(0) },
};

beforeEach(() => {
  jest.clearAllMocks();
  useProgressStore.setState(INITIAL_STATE);
});

describe('useProgressStore', () => {
  it('estado inicial é zerado', () => {
    const state = useProgressStore.getState();
    expect(state.sessions).toEqual([]);
    expect(state.answers).toEqual([]);
    expect(state.badges).toEqual([]);
    expect(state.streak).toBeNull();
    expect(state.xp).toBe(0);
    expect(state.level).toEqual(levelFor(0));
  });

  it('refresh busca e guarda sessões, respostas, conquistas e sequência', async () => {
    const sessions = [sessao(10)];
    const answers = [resposta(90)];
    const badges = [studentBadge('sb1')];
    mockedGetReadingSessions.mockResolvedValue(sessions);
    mockedGetMyAnswers.mockResolvedValue(answers);
    mockedGetStudentBadges.mockResolvedValue(badges);
    mockedGetStreak.mockResolvedValue(streak);

    await useProgressStore.getState().refresh('u1');

    const state = useProgressStore.getState();
    expect(state.sessions).toEqual(sessions);
    expect(state.answers).toEqual(answers);
    expect(state.badges).toEqual(badges);
    expect(state.streak).toEqual(streak);
    expect(mockedGetReadingSessions).toHaveBeenCalledWith('u1');
    expect(mockedGetMyAnswers).toHaveBeenCalledWith('u1');
    expect(mockedGetStudentBadges).toHaveBeenCalledWith('u1');
    expect(mockedGetStreak).toHaveBeenCalledWith('u1');
  });

  // O store NÃO pode reimplementar a conta de XP/nível — só chamar src/game/xp.
  it('XP e nível derivados batem com o que src/game/xp calcula para os mesmos dados', async () => {
    const sessions = [sessao(10), sessao(4)];
    const answers = [resposta(90), resposta(null, 'pending')];
    const badges = [studentBadge('sb1')];
    mockedGetReadingSessions.mockResolvedValue(sessions);
    mockedGetMyAnswers.mockResolvedValue(answers);
    mockedGetStudentBadges.mockResolvedValue(badges);
    mockedGetStreak.mockResolvedValue(streak);

    await useProgressStore.getState().refresh('u1');

    const xpEsperado = totalXp({ sessions, answers, badgeCount: badges.length });
    const state = useProgressStore.getState();
    expect(state.xp).toBe(xpEsperado);
    expect(state.level).toEqual(levelFor(xpEsperado));
  });

  describe('instantâneo anterior (previous)', () => {
    it('depois do primeiro refresh, previous guarda o que era atual antes dele', async () => {
      mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);

      await useProgressStore.getState().refresh('u1');

      const state = useProgressStore.getState();
      expect(state.previous).toEqual({ xp: 0, level: levelFor(0) });
      expect(state.xp).toBe(50); // 10 páginas × XP_PER_PAGE
    });

    it('um segundo refresh com XP maior avança previous para o valor anterior (não para 0)', async () => {
      mockedGetReadingSessions.mockResolvedValue([sessao(10)]);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);
      await useProgressStore.getState().refresh('u1'); // xp: 0 -> 50

      mockedGetReadingSessions.mockResolvedValue([sessao(10), sessao(20)]);
      await useProgressStore.getState().refresh('u1'); // xp: 50 -> 150

      const state = useProgressStore.getState();
      expect(state.previous.xp).toBe(50);
      expect(state.xp).toBe(150);
    });

    // O bug que o brief pede para evitar: um segundo refresh que não traz
    // XP novo não pode sobrescrever previous com o valor que acabou de virar
    // "atual" — isso apagaria o intervalo que a tela de conquista anima.
    it('um segundo refresh sem XP novo NÃO sobrescreve o instantâneo anterior', async () => {
      const sessions = [sessao(10)];
      mockedGetReadingSessions.mockResolvedValue(sessions);
      mockedGetMyAnswers.mockResolvedValue([]);
      mockedGetStudentBadges.mockResolvedValue([]);
      mockedGetStreak.mockResolvedValue(streak);

      await useProgressStore.getState().refresh('u1'); // xp: 0 -> 50
      expect(useProgressStore.getState().previous.xp).toBe(0);

      await useProgressStore.getState().refresh('u1'); // mesmos dados, xp continua 50

      const state = useProgressStore.getState();
      expect(state.xp).toBe(50);
      expect(state.previous.xp).toBe(0); // sobrevive ao segundo refresh
    });
  });
});
