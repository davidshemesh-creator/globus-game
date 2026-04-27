// ============================================================
// גולה עולמי — משחק בירות
// Mode C: "של איזו מדינה הבירה X?" (multiple choice)
// Mode D: "מקם את הבירה X על המפה" (click-to-place, proximity scoring)
// ============================================================

const CAPITALS_GAME = (() => {
  const QUESTIONS_PER_ROUND = 10;
  let state = null;

  // ── Pool: filter by continent and/or level (priority) ─────
  function _buildPool(continent = 'all', level = 'easy') {
    const rendered = MAP.getRenderedIds();
    let pool = COUNTRIES
      .filter(c => rendered.has(c.id) && CAPITALS[c.id])
      .map(c => ({ ...c, ...CAPITALS[c.id] }));

    if (continent !== 'all') {
      pool = pool.filter(c => c.continent === continent);
    } else {
      const cfg = LEVELS[level];
      if (cfg) pool = pool.filter(c => c.priority >= cfg.minPriority && c.priority <= cfg.maxPriority);
    }
    return pool;
  }

  // ── Mode C: show capital name → pick country ───────────────
  function startModeC(profileName, continent = 'all', level = 'easy') {
    const pool = _buildPool(continent, level);
    if (pool.length < 4) return null;
    const selected  = _weightedSample(pool, profileName);
    const questions = selected.map(country => ({
      country,
      choices: _mcChoices(country, pool),
    }));
    state = _initState(profileName, 'C', questions);
    return _currentQ();
  }

  // ── Mode D: show country name → click capital location ─────
  function startModeD(profileName, continent = 'all', level = 'easy') {
    const pool = _buildPool(continent, level);
    if (pool.length < 1) return null;
    const selected  = _weightedSample(pool, profileName);
    const questions = selected.map(country => ({ country }));
    state = _initState(profileName, 'D', questions);
    return _currentQ();
  }

  // ── Submit Mode C (countryId chosen) ──────────────────────
  function submitModeC(countryId) {
    if (!state) return null;
    const q       = state.questions[state.currentIndex];
    const correct = countryId === q.country.id;
    const points  = correct ? 15 : 0;
    if (correct) { state.score += points; state.streak++; state.correctCount++; }
    else         { state.streak = 0; }
    state.answers.push({ country: q.country, correct, points });
    return { correct, points, question: _currentQ() };
  }

  // ── Submit Mode D (clicked lon/lat + countryId from map) ──
  // clickedLonLat = [lon, lat], clickedCountryId = numeric id or null (ocean)
  function submitModeD(clickedLonLat, clickedCountryId) {
    if (!state) return null;
    const q          = state.questions[state.currentIndex];
    const realCoords = q.country.capitalCoords;

    if (clickedCountryId !== q.country.id) {
      const distance = clickedLonLat ? _haversine(clickedLonLat, realCoords) : null;
      state.streak = 0;
      state.answers.push({ country: q.country, clickedLonLat, correct: false, points: 0, distance });
      return { correct: false, points: 0, distance, realCoords, clickedLonLat, question: _currentQ() };
    }

    const distance = _haversine(clickedLonLat, realCoords);
    const points   = _distanceToPoints(distance);
    state.score += points;
    state.correctCount++;
    state.streak++;
    state.answers.push({ country: q.country, clickedLonLat, correct: true, points, distance });
    return { correct: true, points, distance, realCoords, clickedLonLat, question: _currentQ() };
  }

  // ── Advance to next question ───────────────────────────────
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

  // ── Getters ────────────────────────────────────────────────
  function getScore()    { return state ? state.score    : 0; }
  function getStreak()   { return state ? state.streak   : 0; }
  function getMode()     { return state ? state.mode     : null; }
  function isFinished()  { return state ? state.finished : false; }
  function getProgress() {
    if (!state) return { current: 0, total: 0 };
    return { current: state.currentIndex + 1, total: state.questions.length };
  }
  function getRoundSummary() {
    if (!state) return null;
    return {
      mode:         state.mode,
      profileName:  state.profileName,
      score:        state.score,
      correctCount: state.correctCount,
      total:        state.questions.length,
      answers:      state.answers,
      roundPrize:   state.roundPrize,
    };
  }

  // ── Private helpers ────────────────────────────────────────
  function _initState(profileName, mode, questions) {
    return { profileName, mode, questions, currentIndex: 0, score: 0, streak: 0, correctCount: 0, answers: [], finished: false, roundPrize: null };
  }

  function _currentQ() {
    if (!state) return null;
    const q = state.questions[state.currentIndex];
    return { ...q, index: state.currentIndex, total: state.questions.length, isLast: state.currentIndex === state.questions.length - 1 };
  }

  function _mcChoices(correct, pool) {
    const same  = pool.filter(c => c.id !== correct.id && c.continent === correct.continent);
    const diff  = pool.filter(c => c.id !== correct.id && c.continent !== correct.continent);
    const wrongs = shuffle([...same, ...diff]).slice(0, 3);
    return shuffle([correct, ...wrongs]);
  }

  // Weighted sample without replacement (same logic as GAME module)
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

  function _haversine([lon1, lat1], [lon2, lat2]) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
               + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
               * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function _distanceToPoints(km) {
    if (km <= 50)  return 20;
    if (km <= 200) return 15;
    if (km <= 500) return 10;
    return 5;
  }

  function _onRoundEnd() {
    if (!state) return;
    state.roundPrize = addPoints(state.profileName, state.score);
  }

  return {
    startModeC, startModeD,
    submitModeC, submitModeD,
    nextQuestion,
    getScore, getStreak, getMode, getProgress, isFinished,
    getRoundSummary,
  };
})();
