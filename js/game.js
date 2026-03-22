// ============================================================
// גולה עולמי — לוגיקת משחק
// ============================================================

const GAME = (() => {

  // ── State ──────────────────────────────────────────────────
  let state = null;

  /*
   * state shape:
   * {
   *   profileName: string,
   *   mode: 'A' | 'B',          // A = click on map, B = choose from buttons
   *   level: 'easy'|'medium'|'hard'|'master',
   *   continent: string | 'all',
   *   questions: [ { country, choices } ],
   *   currentIndex: number,
   *   score: number,
   *   streak: number,
   *   correctCount: number,
   *   answers: [ { country, chosen, correct, bonusApplied } ],
   *   finished: boolean,
   * }
   */

  // ── Constants ──────────────────────────────────────────────
  const QUESTIONS_PER_ROUND    = 10;
  const STREAK_BONUS_THRESHOLD = 3;  // 3 correct in a row = bonus
  const STREAK_BONUS_POINTS    = 5;
  const ROUND_PASS_THRESHOLD   = 8;  // must get ≥8/10 to earn points

  // ── Public API ─────────────────────────────────────────────

  /**
   * Start a new game round.
   * @param {string} profileName
   * @param {'A'|'B'} mode
   * @param {string} continent  - continent key or 'all'
   * @param {string} level      - 'easy' | 'medium' | 'hard' | 'master'
   * @returns {object} first question data (or null if not enough countries)
   */
  function startGame(profileName, mode, continent, level) {
    const pool = buildPool(profileName, continent, level);

    if (pool.length < 4) return null; // not enough countries

    const questions = generateQuestions(pool, profileName, mode);

    state = {
      profileName,
      mode,
      level,
      continent,
      questions,
      currentIndex: 0,
      score: 0,        // display score (shown in HUD during game)
      streak: 0,
      correctCount: 0,
      answers: [],
      finished: false,
      roundPrize: null, // prize awarded at end of round (if threshold met)
    };

    return currentQuestion();
  }

  /**
   * Submit an answer.
   * @param {number|null} answerId  - chosen country ID (null = time-out / skip)
   * @returns {{ correct, bonusApplied, points, prize, question }}
   */
  function submitAnswer(answerId) {
    if (!state || state.finished) return null;

    const q         = state.questions[state.currentIndex];
    const correct   = answerId === q.country.id;
    const levelDef  = LEVELS[state.level];
    let   points    = 0;
    let   bonusApplied = false;

    if (correct) {
      points = levelDef.points;
      state.streak++;
      state.correctCount++;

      // streak bonus
      if (state.streak > 0 && state.streak % STREAK_BONUS_THRESHOLD === 0) {
        points += STREAK_BONUS_POINTS;
        bonusApplied = true;
      }
      state.score += points;
    } else {
      state.streak = 0;
    }

    // Record country attempt (spaced-repetition tracking — always)
    recordCountryAnswer(state.profileName, q.country.id, correct);
    // Note: addPoints() is deferred to end-of-round (_onRoundEnd),
    //       so prize is null here and shown on the summary screen instead.

    const answerRecord = {
      country:      q.country,
      chosen:       answerId,
      correct,
      bonusApplied,
      points,
    };
    state.answers.push(answerRecord);

    return {
      correct,
      bonusApplied,
      points,
      prize: null, // prizes shown at round end, not per-question
      question: currentQuestion(),
      chosenId: answerId,
    };
  }

  /**
   * Advance to next question.
   * @returns { question, isLast } or null if round is over
   */
  function nextQuestion() {
    if (!state) return null;
    state.currentIndex++;

    if (state.currentIndex >= state.questions.length) {
      state.finished = true;
      _onRoundEnd();
      return null;
    }

    return {
      question: currentQuestion(),
      isLast: state.currentIndex === state.questions.length - 1,
    };
  }

  /** Returns current question object (null if not running) */
  function currentQuestion() {
    if (!state) return null;
    const q = state.questions[state.currentIndex];
    return {
      ...q,
      index:   state.currentIndex,
      total:   state.questions.length,
      isLast:  state.currentIndex === state.questions.length - 1,
    };
  }

  /** Returns round summary (call after round is finished) */
  function getRoundSummary() {
    if (!state) return null;
    return {
      profileName:  state.profileName,
      mode:         state.mode,
      level:        state.level,
      continent:    state.continent,
      score:        state.score,
      correctCount: state.correctCount,
      total:        state.questions.length,
      answers:      state.answers,
      passed:       state.correctCount >= ROUND_PASS_THRESHOLD,
      roundPrize:   state.roundPrize,
    };
  }

  /** Returns current score */
  function getScore() { return state ? state.score : 0; }

  /** Returns current streak */
  function getStreak() { return state ? state.streak : 0; }

  /** Returns { current, total } question progress */
  function getProgress() {
    if (!state) return { current: 0, total: 0 };
    return { current: state.currentIndex + 1, total: state.questions.length };
  }

  function isFinished() { return state ? state.finished : false; }

  // ── Private helpers ────────────────────────────────────────

  /**
   * Build country pool for this round, filtered by continent + level,
   * then weighted by spaced-repetition (per profile).
   */
  function buildPool(profileName, continent, level) {
    // get countries matching level + continent
    let pool = getCountriesByLevel(level, continent);

    // only include countries that are rendered on the map (have a TopoJSON feature)
    const rendered = MAP.getRenderedIds();
    pool = pool.filter(c => rendered.has(c.id));

    return pool;
  }

  /**
   * Generate QUESTIONS_PER_ROUND questions, weighted by spaced repetition.
   * Each question: { country, choices (Mode B only) }
   */
  function generateQuestions(pool, profileName, mode) {
    // weighted selection without replacement
    const selected = weightedSampleWithoutReplacement(pool, profileName, QUESTIONS_PER_ROUND);

    return selected.map(country => {
      const choices = (mode === 'B')
        ? generateChoices(country, pool)
        : null; // Mode A: player clicks map directly

      return { country, choices };
    });
  }

  /**
   * Weighted sampling without replacement.
   * Countries the player struggles with appear more often.
   */
  function weightedSampleWithoutReplacement(pool, profileName, n) {
    const available = [...pool];
    const result    = [];
    const count     = Math.min(n, available.length);

    for (let i = 0; i < count; i++) {
      const weights = available.map(c => getCountryWeight(profileName, c.id));
      const total   = weights.reduce((s, w) => s + w, 0);
      let rand      = Math.random() * total;

      let chosen = available.length - 1;
      for (let j = 0; j < available.length; j++) {
        rand -= weights[j];
        if (rand <= 0) { chosen = j; break; }
      }

      result.push(available[chosen]);
      available.splice(chosen, 1);
    }

    return result;
  }

  /**
   * Generate 4 choices for Mode B:
   * - 1 correct answer
   * - 3 wrong answers, preferring same continent
   */
  function generateChoices(correct, pool) {
    const wrongs = getWrongChoices(correct, pool, 3);
    const choices = shuffle([correct, ...wrongs]);
    return choices;
  }

  /** Called internally when a round ends */
  function _onRoundEnd() {
    if (!state) return;
    markLevelCompleted(state.profileName, state.level);

    // Only award points if player passed the threshold (≥8/10 correct)
    if (state.correctCount >= ROUND_PASS_THRESHOLD) {
      // Bonus multiplier: 10/10 = ×1.5, 9/10 = ×1.2, 8/10 = ×1.0
      const multiplier = state.correctCount === 10 ? 1.5
                       : state.correctCount === 9  ? 1.2
                       : 1.0;
      const finalPoints = Math.round(state.score * multiplier);
      state.score       = finalPoints; // update display score too
      state.roundPrize  = addPoints(state.profileName, finalPoints);
    } else {
      // Did not pass — no points saved to profile
      state.score      = 0;
      state.roundPrize = null;
    }
  }

  return {
    startGame,
    submitAnswer,
    nextQuestion,
    currentQuestion,
    getRoundSummary,
    getScore,
    getStreak,
    getProgress,
    isFinished,
  };
})();
