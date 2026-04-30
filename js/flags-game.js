// ============================================================
// גולה עולמי — משחק דגלים
// Mode E: "של איזו מדינה הדגל?" (multiple choice)
// ============================================================

const FLAGS_GAME = (() => {
  const QUESTIONS_PER_ROUND = 10;
  let state = null;

  function _buildPool(continent = 'all', level = 'easy') {
    let pool = COUNTRIES.filter(c => c.iso2);
    if (continent !== 'all') {
      pool = pool.filter(c => c.continent === continent);
    } else {
      const cfg = LEVELS[level];
      if (cfg) pool = pool.filter(c => c.priority >= cfg.minPriority && c.priority <= cfg.maxPriority);
    }
    return pool;
  }

  function start(profileName, continent = 'all', level = 'easy') {
    const pool = _buildPool(continent, level);
    if (pool.length < 4) return null;
    const selected = _weightedSample(pool, profileName);
    const questions = selected.map(country => ({
      country,
      choices: _mcChoices(country, pool),
    }));
    state = _initState(profileName, questions, continent, level);
    return _currentQ();
  }

  function submit(countryId) {
    if (!state) return null;
    const q = state.questions[state.currentIndex];
    const correct = countryId === q.country.id;
    const points = correct ? 25 : 0;
    if (correct) { state.score += points; state.streak++; state.correctCount++; }
    else { state.streak = 0; }
    state.answers.push({ country: q.country, correct, points });
    return { correct, points, question: _currentQ() };
  }

  function nextQuestion() {
    if (!state) return null;
    state.currentIndex++;
    if (state.currentIndex >= state.questions.length) {
      state.finished = true;
      _onRoundEnd();
      return null;
    }
    return { question: _currentQ(), isLast: state.currentIndex === state.questions.length - 1 };
  }

  function getScore()    { return state ? state.score    : 0; }
  function getStreak()   { return state ? state.streak   : 0; }
  function isFinished()  { return state ? state.finished : false; }
  function getProgress() {
    if (!state) return { current: 0, total: 0 };
    return { current: state.currentIndex + 1, total: state.questions.length };
  }
  function getRoundSummary() {
    if (!state) return null;
    return {
      mode:            'E',
      profileName:     state.profileName,
      level:           state.level,
      continent:       state.continent,
      score:           state.score,
      correctCount:    state.correctCount,
      total:           state.questions.length,
      answers:         state.answers,
      roundPrize:      state.roundPrize,
      roundStars:      state.roundStars || 0,
      badgePrize:      state.badgePrize || null,
      discoveryBadges: state.discoveryBadges || [],
    };
  }

  // ── Private helpers ────────────────────────────────────────

  function _initState(profileName, questions, continent, level) {
    return { profileName, questions, continent, level, currentIndex: 0, score: 0, streak: 0, correctCount: 0, answers: [], finished: false, roundPrize: null, roundStars: 0, badgePrize: null, discoveryBadges: [] };
  }

  function _currentQ() {
    if (!state) return null;
    const q = state.questions[state.currentIndex];
    return { ...q, index: state.currentIndex, total: state.questions.length, isLast: state.currentIndex === state.questions.length - 1 };
  }

  function _mcChoices(correct, pool) {
    const same   = pool.filter(c => c.id !== correct.id && c.continent === correct.continent);
    const diff   = pool.filter(c => c.id !== correct.id && c.continent !== correct.continent);
    const wrongs = shuffle([...same, ...diff]).slice(0, 3);
    return shuffle([correct, ...wrongs]);
  }

  function _weightedSample(pool, profileName) {
    const n         = Math.min(QUESTIONS_PER_ROUND, pool.length);
    const available = [...pool];
    const result    = [];
    for (let i = 0; i < n; i++) {
      const weights = available.map(c => getCountryWeight(profileName, c.id));
      const total   = weights.reduce((s, w) => s + w, 0);
      let rand      = Math.random() * total;
      let chosen    = available.length - 1;
      for (let j = 0; j < available.length; j++) {
        rand -= weights[j];
        if (rand <= 0) { chosen = j; break; }
      }
      result.push(available[chosen]);
      available.splice(chosen, 1);
    }
    return result;
  }

  function _onRoundEnd() {
    if (!state) return;
    const multiplier = state.correctCount === 10 ? 1.5
                     : state.correctCount === 9  ? 1.2 : 1.0;
    state.score      = Math.round(state.score * multiplier);
    state.roundPrize = addPoints(state.profileName, state.score);

    const stars = calcRoundStars(state.correctCount, state.questions.length);
    state.roundStars = stars;
    if (state.continent === 'all' && stars > 0) {
      state.badgePrize = addGameStars(state.profileName, 'E', state.level, stars);
    }

    const discoveredIds = state.questions.map(q => q.country.id);
    state.discoveryBadges = recordDiscovered(state.profileName, discoveredIds);
  }

  return { start, submit, nextQuestion, getScore, getStreak, getProgress, isFinished, getRoundSummary };
})();
