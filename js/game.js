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
  const MASTERED_POINTS        = 5;  // נקודות על מדינה שכבר שלטת בה

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
      score: 0,
      streak: 0,
      correctCount: 0,
      answers: [],
      finished: false,
      roundPrize: null,
      newlyMastered: [],
      prevMastered: getMasteredCount(profileName),
      roundStars: 0,
      badgePrize: null,
      discoveryBadges: [],
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

    const q            = state.questions[state.currentIndex];
    const correct      = answerId === q.country.id;
    let   points       = 0;
    let   bonusApplied = false;
    let   justMastered = false;

    if (state.isVerification) {
      // סיבוב בדיקה — אין רישום נקודות לשאלה, רק מעקב נכון/לא נכון
      if (correct) {
        state.streak++;
        state.correctCount++;
      } else {
        state.streak = 0;
      }
    } else {
      if (correct) {
        // בדוק streak לפני עדכון
        const prevStreak      = getCountryStreak(state.profileName, q.country.id);
        const alreadyMastered = prevStreak >= 3;

        // נקודות בסיס: 5 אם כבר שלטת, אחרת לפי רמת המדינה
        const levelDef = _getCountryLevelDef(q.country);
        points = alreadyMastered ? MASTERED_POINTS : levelDef.points;

        state.streak++;
        state.correctCount++;

        // עדכן streak בפרופיל
        recordCountryAnswer(state.profileName, q.country.id, true);

        // בדוק האם הגיע ל-mastery עכשיו (streak עבר מ-2 ל-3)
        if (!alreadyMastered && prevStreak === 2) {
          points       += levelDef.masteryBonus;
          bonusApplied  = true;
          justMastered  = true;
          state.newlyMastered.push(q.country);
        }

        state.score += points;
      } else {
        state.streak = 0;
        recordCountryAnswer(state.profileName, q.country.id, false);
      }
    }

    const answerRecord = {
      country:      q.country,
      chosen:       answerId,
      correct,
      bonusApplied,
      justMastered,
      points,
    };
    state.answers.push(answerRecord);

    return {
      correct,
      bonusApplied,
      justMastered,
      masteredCountry: justMastered ? q.country : null,
      points,
      prize:    null,
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
    const threshold = _getPassThreshold();
    return {
      profileName:    state.profileName,
      mode:           state.mode,
      level:          state.level,
      continent:      state.continent,
      score:          state.score,
      correctCount:   state.correctCount,
      total:          state.questions.length,
      answers:        state.answers,
      passed:         state.correctCount >= threshold,
      passThreshold:  threshold,
      roundPrize:      state.roundPrize,
      newlyMastered:   state.newlyMastered || [],
      levelUnlocked:   state.levelUnlocked || null,
      isVerification:  state.isVerification || false,
      roundStars:      state.roundStars || 0,
      badgePrize:      state.badgePrize || null,
      discoveryBadges: state.discoveryBadges || [],
    };
  }

  /**
   * Start a verification round from countries answered in a previous round.
   * @param {string} profileName
   * @param {Array} countries - array of country objects
   * @returns {object} first question data (or null if no countries)
   */
  function startVerificationRound(profileName, countries) {
    if (!countries || countries.length === 0) return null;

    const questions = countries.map(c => ({ country: c, choices: null }));

    state = {
      profileName,
      mode:           'A',
      level:          'easy',
      continent:      'all',
      questions,
      currentIndex:    0,
      score:           0,
      streak:          0,
      correctCount:    0,
      answers:         [],
      finished:        false,
      roundPrize:      null,
      newlyMastered:   [],
      prevMastered:    getMasteredCount(profileName),
      isVerification:  true,
      roundStars:      0,
      badgePrize:      null,
      discoveryBadges: [],
    };

    return currentQuestion();
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
   * Build country pool — יבשת OR רמה (לא שניהם)
   */
  function buildPool(profileName, continent, level) {
    let pool;
    if (continent !== 'all') {
      // מצב יבשת: כל המדינות ביבשת, ללא סינון רמה
      pool = COUNTRIES.filter(c => c.continent === continent);
    } else {
      // מצב רמה: רק priority הבלעדי של הרמה
      pool = getCountriesByLevel(level, 'all');
    }
    // רק מדינות שמורנדרות על המפה
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

  /** סף מעבר לפי רמה (או מצב יבשת) */
  function _getPassThreshold() {
    if (state.continent !== 'all') return 7; // מצב יבשת
    return LEVELS[state.level]?.passThreshold ?? 8;
  }

  /** נקודת הכניסה לרמת מדינה לפי priority */
  function _getCountryLevelDef(country) {
    for (const def of Object.values(LEVELS)) {
      if (country.priority >= def.minPriority && country.priority <= def.maxPriority) {
        return def;
      }
    }
    return LEVELS.easy;
  }

  /** Called internally when a round ends */
  function _onRoundEnd() {
    if (!state) return;

    // Track discovered countries for all round types
    const discoveredIds = state.questions.map(q => q.country.id);
    state.discoveryBadges = recordDiscovered(state.profileName, discoveredIds);

    // סיבוב בדיקה — לוגיקה נפרדת
    if (state.isVerification) {
      state.answers.forEach(a => {
        if (a.correct) markCountryVerified(state.profileName, a.country.id);
      });
      state.score      = state.correctCount * 30;
      state.roundPrize = state.correctCount > 0 ? addPoints(state.profileName, state.score) : null;
      state.levelUnlocked = checkNewLevelUnlock(state.profileName, state.prevMastered);
      return;
    }

    if (state.level !== 'all') markLevelCompleted(state.profileName, state.level);

    const threshold = _getPassThreshold();

    if (state.correctCount >= threshold) {
      const multiplier = state.correctCount === 10 ? 1.5
                       : state.correctCount === 9  ? 1.2
                       : 1.0;
      const finalPoints = Math.round(state.score * multiplier);
      state.score       = finalPoints;
      state.roundPrize  = addPoints(state.profileName, finalPoints);
    } else {
      state.score      = 0;
      state.roundPrize = null;
    }

    // Stars (only for level mode, not continent mode)
    const stars = calcRoundStars(state.correctCount, state.questions.length);
    state.roundStars = stars;
    if (state.continent === 'all' && stars > 0) {
      state.badgePrize = addLevelStars(state.profileName, state.level, stars);
    }

    // בדוק אם רמה חדשה נפתחה
    state.levelUnlocked = checkNewLevelUnlock(state.profileName, state.prevMastered);
  }

  /** Returns true if a verification round is currently in progress (not yet finished) */
  function isActiveVerification() {
    return !!(state && state.isVerification && !state.finished);
  }

  return {
    startGame,
    startVerificationRound,
    submitAnswer,
    nextQuestion,
    currentQuestion,
    getRoundSummary,
    getScore,
    getStreak,
    getProgress,
    isFinished,
    isActiveVerification,
  };
})();
