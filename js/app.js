// ============================================================
// גולה עולמי — בקר האפליקציה (ניהול מסכים + אירועים)
// ============================================================

const APP = (() => {

  // ── Screen registry ────────────────────────────────────────
  const SCREENS = ['screen-loading', 'screen-profiles', 'screen-dashboard', 'screen-game-select', 'screen-setup',
                   'screen-game', 'screen-summary', 'screen-prize', 'screen-continents', 'screen-explore'];

  // ── App state ──────────────────────────────────────────────
  let currentProfile     = null; // profile object
  let pendingPrize       = null; // prize object waiting to be shown
  let gameSetup          = { mode: 'B', continent: 'all', level: 'easy' };
  let lastFeedback       = null; // result from submitAnswer
  let _editingProfileName = null; // null = adding mode, string = editing mode

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    _bindGlobalEvents();
    _initFeedbackDrag();

    // Show loading while Firestore connects
    showScreen('screen-loading');

    try {
      await initProfiles();
    } catch (e) {
      console.error('Failed to load profiles:', e);
      document.getElementById('loading-error')?.classList.remove('hidden');
      return;
    }

    // Real-time: refresh leaderboard if someone else plays
    document.addEventListener('profiles-updated', () => {
      if (!document.getElementById('screen-profiles')?.classList.contains('hidden')) {
        renderProfilesScreen();
      }
    });

    showScreen('screen-profiles');
    renderProfilesScreen();
  }

  // ── Feedback overlay helpers ────────────────────────────────
  function _showFeedbackOverlay() {
    const el = document.getElementById('screen-feedback');
    if (!el) return;
    // Reset card to center position before showing
    const card = el.querySelector('.feedback-card');
    if (card) {
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.margin = '';
    }
    el.classList.remove('hidden');
  }

  function _hideFeedbackOverlay() {
    document.getElementById('screen-feedback')?.classList.add('hidden');
  }

  // ── Drag logic for feedback card ────────────────────────────
  function _initFeedbackDrag() {
    const card = document.querySelector('.feedback-card');
    if (!card) return;

    let dragging = false, startX, startY, origLeft, origTop;

    function onStart(e) {
      if (e.target.closest('button')) return;
      const pt = e.touches ? e.touches[0] : e;
      const rect = card.getBoundingClientRect();
      dragging = true;
      startX = pt.clientX;
      startY = pt.clientY;
      origLeft = rect.left;
      origTop  = rect.top;
      card.style.position = 'fixed';
      card.style.left = origLeft + 'px';
      card.style.top  = origTop  + 'px';
      card.style.margin = '0';
      e.preventDefault();
    }

    function onMove(e) {
      if (!dragging) return;
      const pt = e.touches ? e.touches[0] : e;
      card.style.left = (origLeft + pt.clientX - startX) + 'px';
      card.style.top  = (origTop  + pt.clientY - startY) + 'px';
      e.preventDefault();
    }

    function onEnd() { dragging = false; }

    card.addEventListener('mousedown', onStart);
    card.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup',  onEnd);
    document.addEventListener('touchend', onEnd);
  }

  // ── Screen management ──────────────────────────────────────
  function showScreen(id) {
    SCREENS.forEach(s => {
      const el = document.getElementById(s);
      if (el) el.classList.toggle('hidden', s !== id);
    });
  }

  // ── PROFILES SCREEN ────────────────────────────────────────
  const RANK_MEDALS = ['🥇', '🥈', '🥉'];

  function renderProfilesScreen() {
    const profiles = loadProfiles(); // already sorted by points desc
    const grid     = document.getElementById('profiles-grid');
    if (!grid) return;

    grid.innerHTML = '';

    profiles.forEach((p, idx) => {
      const rankDisplay = idx < 3
        ? `<span class="rank-medal">${RANK_MEDALS[idx]}</span>`
        : `<span class="rank-num">#${idx + 1}</span>`;

      const card = _el('div', 'profile-card profile-card--with-progress', `
        <div class="profile-card-top">
          ${rankDisplay}
          <span class="profile-avatar">${p.avatar}</span>
          <div class="profile-card-info">
            <span class="profile-name">${p.name}</span>
            <span class="profile-pts">${p.points} נקודות</span>
          </div>
          <div class="profile-card-actions">
            <button class="btn-profile-action btn-profile-edit" title="ערוך">✏️</button>
            <button class="btn-profile-action btn-profile-delete" title="מחק">🗑️</button>
          </div>
        </div>
        ${_getContinentProgressHTML(p)}
      `);

      // click on card body → select profile
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-profile-action')) _selectProfile(p.name);
      });

      card.querySelector('.btn-profile-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        _showEditProfileModal(p.name);
      });

      card.querySelector('.btn-profile-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`למחוק את הפרופיל של ${p.name}?\nכל הנקודות והנתונים יימחקו.`)) {
          deleteProfile(p.name);
          renderProfilesScreen();
        }
      });

      grid.appendChild(card);
    });

    // Add profile button
    const addBtn = _el('button', 'profile-card profile-card--add', `
      <span class="profile-avatar">➕</span>
      <span class="profile-name">הוסף ילד</span>
    `);
    addBtn.addEventListener('click', _showAddProfileModal);
    grid.appendChild(addBtn);
  }

  function _selectProfile(name) {
    currentProfile = getProfile(name);
    showScreen('screen-dashboard');
    renderDashboard();
  }

  function _showAddProfileModal() {
    _editingProfileName = null;
    const modal = document.getElementById('modal-add-profile');
    if (!modal) return;
    document.querySelector('#modal-add-profile .modal-title').textContent = 'ילד/ה חדש/ה';
    document.getElementById('btn-add-profile-confirm').textContent = 'הוסף';
    document.getElementById('new-profile-name').value = '';
    modal.classList.remove('hidden');
    _renderAvatarPicker(null);
  }

  function _showEditProfileModal(name) {
    _editingProfileName = name;
    const p = getProfile(name);
    if (!p) return;
    const modal = document.getElementById('modal-add-profile');
    if (!modal) return;
    document.querySelector('#modal-add-profile .modal-title').textContent = 'עריכת פרופיל';
    document.getElementById('btn-add-profile-confirm').textContent = 'שמור';
    document.getElementById('new-profile-name').value = p.name;
    modal.classList.remove('hidden');
    _renderAvatarPicker(p.avatar);
  }

  function _renderAvatarPicker(selectedAvatar = null) {
    const picker = document.getElementById('avatar-picker');
    if (!picker) return;
    picker.innerHTML = '';
    AVATAR_OPTIONS.forEach(emoji => {
      const btn = _el('button', 'avatar-option', emoji);
      if (selectedAvatar ? emoji === selectedAvatar : false) btn.classList.add('selected');
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      picker.appendChild(btn);
    });
    // if no pre-selection, select first
    if (!selectedAvatar) picker.querySelector('.avatar-option')?.classList.add('selected');
  }

  // ── DASHBOARD ──────────────────────────────────────────────
  function renderDashboard() {
    if (!currentProfile) return;
    const p = getProfile(currentProfile.name); // fresh from storage

    _setText('dash-name',    p.name);
    _setText('dash-avatar',  p.avatar);
    _setText('dash-points',  `${p.points} נקודות`);
    _setText('dash-countries', `${getCountriesLearnedCount(p.name)} מדינות`);

    // next prize bar
    const next = getNextPrize(p.name);
    if (next) {
      const prev = _prevPrize(p.points, next);
      const pct  = prev ? Math.round(((p.points - prev) / (next.points - prev)) * 100) : Math.round((p.points / next.points) * 100);
      _setText('dash-next-prize', `${next.emoji} ${next.prize} — ${next.points} נקודות`);
      const bar = document.getElementById('dash-prize-bar');
      if (bar) bar.style.width = Math.min(pct, 100) + '%';
    } else {
      _setText('dash-next-prize', '🏆 כל הפרסים הושגו!');
    }

  }

  function _getContinentProgressHTML(p) {
    const CONT_META = [
      { key: 'europe',        label: 'אירופה',       color: '#60A5FA' },
      { key: 'asia',          label: 'אסיה',         color: '#F472B6' },
      { key: 'africa',        label: 'אפריקה',       color: '#FBBF24' },
      { key: 'north-america', label: 'אמ׳ צפונית',  color: '#FB923C' },
      { key: 'south-america', label: 'אמ׳ דרומית',  color: '#34D399' },
      { key: 'oceania',       label: 'אוקיאניה',     color: '#2DD4BF' },
    ];

    const learnedByContinent = {};
    Object.entries(p.countriesLearned || {}).forEach(([id, data]) => {
      if (data.correct >= 1) {
        const country = getCountryById(Number(id));
        if (country) learnedByContinent[country.continent] = (learnedByContinent[country.continent] || 0) + 1;
      }
    });

    const rows = CONT_META.map(({ key, label, color }) => {
      const total   = COUNTRIES.filter(c => c.continent === key).length;
      const learned = learnedByContinent[key] || 0;
      const pct     = total > 0 ? Math.round((learned / total) * 100) : 0;
      return `<div class="cont-prog-row">
        <span class="cont-prog-label">${label}</span>
        <div class="cont-prog-track">
          <div class="cont-prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="cont-prog-count">${learned}/${total}</span>
      </div>`;
    }).join('');

    return `<div class="continent-progress-list profile-cont-progress">${rows}</div>`;
  }

  function _prevPrize(currentPoints, nextPrize) {
    // find the prize just below currentPoints
    const idx = PRIZES.findIndex(p => p === nextPrize);
    return idx > 0 ? PRIZES[idx - 1].points : 0;
  }

  // ── SETUP SCREEN ───────────────────────────────────────────
  function renderSetupScreen() {
    // show mode name in header
    const modeLabel = gameSetup.mode === 'B' ? '🗺 זהה מדינות' : '🔍 מצא מדינות';
    _setText('setup-screen-title', modeLabel);
    document.querySelectorAll('[data-continent]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.continent === gameSetup.continent);
    });
    document.querySelectorAll('[data-level]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.level === gameSetup.level);
    });

    // disable master if locked
    if (currentProfile && !isMasterUnlocked(currentProfile.name)) {
      const masterBtn = document.querySelector('[data-level="master"]');
      if (masterBtn) {
        masterBtn.disabled = true;
        masterBtn.classList.add('locked');
      }
    }
  }

  // ── GAME SCREEN ────────────────────────────────────────────
  async function startGameRound() {
    showScreen('screen-game');
    _setText('game-profile-name', currentProfile.name);
    _setText('game-profile-avatar', currentProfile.avatar);

    // init map
    await MAP.init('map-container');
    if (gameSetup.continent !== 'all') MAP.zoomToContinent(gameSetup.continent);

    const q = GAME.startGame(
      currentProfile.name,
      gameSetup.mode,
      gameSetup.continent,
      gameSetup.level
    );

    if (!q) {
      alert('לא נמצאו מספיק מדינות לרמה זו');
      showScreen('screen-setup');
      return;
    }

    renderQuestion(q);
  }

  function renderQuestion(q) {
    _updateProgress();
    _updateScore();
    _updateStreak();

    if (gameSetup.mode === 'B') {
      // Mode B: country highlighted on map → player picks name from 4 buttons
      MAP.highlight(q.country.id);
      MAP.zoomToContinent(q.country.continent); // auto-zoom so highlighted country is visible
      _setText('question-text', 'מה שם המדינה המסומנת?');
      _setText('question-flag', '🌍');
      MAP.disableClick();
      renderChoiceButtons(q);
      document.getElementById('choice-buttons').classList.remove('hidden');
    } else {
      // Mode A: name + flag shown → player clicks country on full map
      MAP.resetColors();
      _setText('question-text', `איפה נמצאת ${q.country.nameHe}?`);
      _setText('question-flag', getFlagEmoji(q.country.iso2));
      document.getElementById('choice-buttons').classList.add('hidden');
      MAP.enableClick((clickedId) => _handleMapClick(clickedId, q));
    }
  }

  function renderChoiceButtons(q) {
    const container = document.getElementById('choice-buttons');
    if (!container) return;
    container.innerHTML = '';

    q.choices.forEach(choice => {
      const btn = _el('button', 'choice-btn', choice.nameHe);
      btn.dataset.countryId = choice.id;
      btn.addEventListener('click', () => _handleChoiceClick(choice.id, q));
      container.appendChild(btn);
    });
  }

  function _handleChoiceClick(chosenId, q) {
    _disableChoiceButtons();
    MAP.disableClick();
    const result = GAME.submitAnswer(chosenId);
    lastFeedback  = result;

    // colour choice buttons: correct=green, chosen-wrong=red
    document.querySelectorAll('.choice-btn').forEach(btn => {
      const id = Number(btn.dataset.countryId);
      if (id === q.country.id)               btn.classList.add('btn-correct');
      else if (id === chosenId && !result.correct) btn.classList.add('btn-wrong');
    });

    // flash map
    MAP.flashResult(q.country.id, result.correct ? null : chosenId);

    // show feedback after brief flash
    setTimeout(() => showFeedbackScreen(result), 900);
  }

  function _handleMapClick(clickedId, q) {
    MAP.disableClick();
    _disableChoiceButtons();
    const result = GAME.submitAnswer(clickedId);
    lastFeedback  = result;

    // flash map
    MAP.flashResult(q.country.id, result.correct ? null : clickedId);

    setTimeout(() => showFeedbackScreen(result), 900);
  }

  function _disableChoiceButtons() {
    document.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
  }

  function _updateProgress() {
    const prog  = GAME.getProgress();
    _setText('progress-text', `${prog.current} / ${prog.total}`);
    const bar = document.getElementById('progress-bar');
    if (bar) bar.style.width = Math.round(((prog.current - 1) / prog.total) * 100) + '%';
  }

  function _updateScore() {
    _setText('score-display', `${GAME.getScore()} נק׳`);
  }

  function _updateStreak() {
    const streak = GAME.getStreak();
    const el     = document.getElementById('streak-display');
    if (!el) return;
    if (streak >= 3) {
      el.textContent = `🔥 ${streak}`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

  // ── FEEDBACK SCREEN ────────────────────────────────────────
  function showFeedbackScreen(result) {
    _showFeedbackOverlay();

    const { correct, bonusApplied, points, question } = result;
    const country = question.country;

    _setText('feedback-icon',    correct ? '✅' : '❌');
    _setText('feedback-title',   correct ? 'נכון!' : 'לא נכון');
    _setText('feedback-flag',    getFlagEmoji(country.iso2));
    _setText('feedback-country', country.nameHe);
    _setText('feedback-continent', CONTINENTS[country.continent]?.nameHe || '');
    _setText('feedback-points',  correct ? `+${points} נקודות` : '');

    const bonusEl = document.getElementById('feedback-bonus');
    if (bonusEl) {
      bonusEl.classList.toggle('hidden', !bonusApplied);
      bonusEl.textContent = `🔥 בונוס רצף +${5}!`;
    }

    // Next button (prizes are now shown at end-of-round, not per-question)
    const isLastQ = question.isLast;
    const nextBtn = document.getElementById('btn-feedback-next');
    if (nextBtn) {
      nextBtn.textContent = isLastQ ? 'סיכום סיבוב' : 'השאלה הבאה ←';
      nextBtn.onclick = () => {
        _hideFeedbackOverlay();
        if (isLastQ) {
          GAME.nextQuestion();
          showSummaryScreen();
        } else {
          const next = GAME.nextQuestion();
          showScreen('screen-game');
          if (next) renderQuestion(next.question);
        }
      };
    }
  }

  // ── SUMMARY SCREEN ─────────────────────────────────────────
  function showSummaryScreen() {
    showScreen('screen-summary');
    const summary = GAME.getRoundSummary();
    if (!summary) return;

    const pct = Math.round((summary.correctCount / summary.total) * 100);

    _setText('summary-correct', `${summary.correctCount} / ${summary.total}`);
    _setText('summary-pct',     `${pct}%`);

    // rating
    let rating = '⭐';
    if (pct >= 90) rating = '🏆';
    else if (pct >= 70) rating = '⭐⭐⭐';
    else if (pct >= 50) rating = '⭐⭐';
    _setText('summary-rating', rating);

    // Points display — show earned points or "did not pass" message
    if (summary.passed) {
      const multiplierNote = summary.correctCount === 10 ? ' ×1.5 🔥' : summary.correctCount === 9 ? ' ×1.2 ⭐' : '';
      _setText('summary-score', `${summary.score} נקודות${multiplierNote}`);
    } else {
      _setText('summary-score', 'לא הגעת ל-8/10 — אין נקודות הפעם');
    }

    // answers list
    const list = document.getElementById('summary-answers');
    if (list) {
      list.innerHTML = '';
      summary.answers.forEach(a => {
        const item = _el('div', `summary-answer-item ${a.correct ? 'correct' : 'wrong'}`,
          `<span>${getFlagEmoji(a.country.iso2)}</span>
           <span>${a.country.nameHe}</span>
           <span>${a.correct ? '✓' : '✗'}</span>`
        );
        list.appendChild(item);
      });
    }

    // If a prize was earned this round, store and auto-show it after 1.5s
    if (summary.roundPrize) {
      pendingPrize = summary.roundPrize;
      setTimeout(() => {
        if (pendingPrize) {
          showPrizeScreen(pendingPrize, 'home');
          pendingPrize = null;
        }
      }, 1500);
    } else {
      pendingPrize = null;
    }
  }

  // ── PRIZE SCREEN ───────────────────────────────────────────
  // destination: 'play-again' | 'home' (where to go after prize)
  function showPrizeScreen(prize, destination = 'home') {
    showScreen('screen-prize');
    _setText('prize-emoji',       prize.emoji);
    _setText('prize-achievement', prize.achievement);
    _setText('prize-name',        prize.prize);
    _setText('prize-points',      `${prize.points} נקודות`);

    // confetti-style animation trigger
    const el = document.getElementById('screen-prize');
    if (el) {
      el.classList.remove('prize-animate');
      void el.offsetWidth; // reflow
      el.classList.add('prize-animate');
    }

    const continueBtn = document.getElementById('btn-prize-continue');
    if (continueBtn) {
      continueBtn.onclick = () => {
        if (destination === 'play-again') {
          startGameRound();
        } else {
          currentProfile = getProfile(currentProfile.name); // refresh points
          showScreen('screen-dashboard');
          renderDashboard();
        }
      };
    }
  }

  // ── EXPLORE MAP SCREEN ─────────────────────────────────────
  async function startExploreScreen() {
    showScreen('screen-explore');
    // reset info bar
    const infoEl = document.getElementById('explore-info-content');
    if (infoEl) {
      infoEl.className = 'explore-hint';
      infoEl.innerHTML = 'לחץ על מדינה לפרטים 👆';
    }
    await MAP.init('explore-map-container');
    MAP.colorByContinents();
    MAP.addLabels();
    MAP.enableExploreInteraction(
      (id, country) => _updateExploreInfo(country),   // hover
      (id)          => { const c = getCountryById(id); if (c) _updateExploreInfo(c); } // click
    );
  }

  function _updateExploreInfo(country) {
    const el = document.getElementById('explore-info-content');
    if (!el) return;
    const flag      = getFlagEmoji(country.iso2);
    const contName  = CONTINENTS[country.continent]?.nameHe || '';
    const contColor = CONTINENTS[country.continent]?.color  || '#94A3B8';
    el.className = '';
    el.innerHTML = `
      <div class="explore-country-info">
        <span class="explore-flag">${flag}</span>
        <span class="explore-name">${country.nameHe}</span>
        <span class="explore-continent" style="border-color:${contColor};color:${contColor}">${contName}</span>
      </div>
    `;
  }

  // ── GLOBAL EVENTS ──────────────────────────────────────────
  function _bindGlobalEvents() {

    // ----- Profile screen -----
    _on('btn-add-profile-confirm', 'click', () => {
      const name   = document.getElementById('new-profile-name')?.value.trim();
      const avatar = document.querySelector('.avatar-option.selected')?.textContent || '⭐';
      if (!name) return;

      if (_editingProfileName) {
        // edit mode
        const result = editProfile(_editingProfileName, name, avatar);
        if (!result) { alert('שם זה כבר קיים'); return; }
        // update currentProfile reference if this is the active profile
        if (currentProfile && currentProfile.name === _editingProfileName) {
          currentProfile = result;
        }
      } else {
        // add mode
        const created = createProfile(name, avatar);
        if (!created) { alert('שם זה כבר קיים'); return; }
      }

      document.getElementById('modal-add-profile')?.classList.add('hidden');
      renderProfilesScreen();
    });

    _on('btn-add-profile-cancel', 'click', () => {
      document.getElementById('modal-add-profile')?.classList.add('hidden');
    });

    // ----- Dashboard -----
    _on('btn-play', 'click', () => {
      showScreen('screen-game-select');
    });

    // ----- Game selection -----
    _on('btn-gamesel-back', 'click', () => {
      showScreen('screen-dashboard');
      renderDashboard();
    });

    _on('btn-game-mode-b', 'click', () => {
      gameSetup.mode = 'B';
      showScreen('screen-setup');
      renderSetupScreen();
    });

    _on('btn-game-mode-a', 'click', () => {
      gameSetup.mode = 'A';
      showScreen('screen-setup');
      renderSetupScreen();
    });

    _on('btn-game-continents', 'click', async () => {
      showScreen('screen-continents');
      _setText('cont-profile-badge', `${currentProfile.avatar} ${currentProfile.name}`);
      await CONTINENTS_GAME.start(currentProfile.name);
    });

    _on('btn-back-to-profiles', 'click', () => {
      showScreen('screen-profiles');
      renderProfilesScreen();
    });

    // ----- Continents game -----
    _on('btn-cont-quit', 'click', () => {
      showScreen('screen-dashboard');
      renderDashboard();
    });

    _on('btn-cont-again', 'click', async () => {
      document.getElementById('cont-result')?.classList.add('hidden');
      await CONTINENTS_GAME.start(currentProfile.name);
    });

    _on('btn-cont-home', 'click', () => {
      document.getElementById('cont-result')?.classList.add('hidden');
      const prize = CONTINENTS_GAME.getLastPrize();
      currentProfile = getProfile(currentProfile.name);
      showScreen('screen-dashboard');
      renderDashboard();
      if (prize) {
        setTimeout(() => showPrizeScreen(prize, 'home'), 300);
      }
    });

    _on('btn-reset-profile', 'click', () => {
      if (!currentProfile) return;
      if (confirm(`לאפס את כל הנתונים של ${currentProfile.name}? (נקודות, מדינות, פרסים)`)) {
        resetProfile(currentProfile.name);
        currentProfile = getProfile(currentProfile.name);
        renderDashboard();
      }
    });

    // Mode toggle
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameSetup.mode = btn.dataset.mode;
        document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === gameSetup.mode));
      });
    });

    // Continent toggle
    document.querySelectorAll('[data-continent]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameSetup.continent = btn.dataset.continent;
        document.querySelectorAll('[data-continent]').forEach(b => b.classList.toggle('active', b.dataset.continent === gameSetup.continent));
      });
    });

    // Level toggle
    document.querySelectorAll('[data-level]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        gameSetup.level = btn.dataset.level;
        document.querySelectorAll('[data-level]').forEach(b => b.classList.toggle('active', b.dataset.level === gameSetup.level));
      });
    });

    // ----- Setup → Start -----
    _on('btn-start-game', 'click', () => {
      startGameRound();
    });

    _on('btn-back-to-dashboard', 'click', () => {
      showScreen('screen-game-select');
    });

    // ----- Zoom controls (game) -----
    _on('btn-zoom-in',    'click', () => MAP.zoomIn());
    _on('btn-zoom-out',   'click', () => MAP.zoomOut());
    _on('btn-zoom-reset', 'click', () => MAP.zoomReset());

    // ----- Explore map -----
    _on('btn-explore-map',        'click', () => startExploreScreen());
    _on('btn-explore-back',       'click', () => {
      MAP.disableClick();
      MAP.removeLabels();
      showScreen('screen-dashboard');
      renderDashboard();
    });
    _on('btn-explore-zoom-in',    'click', () => MAP.zoomIn());
    _on('btn-explore-zoom-out',   'click', () => MAP.zoomOut());
    _on('btn-explore-zoom-reset', 'click', () => MAP.zoomReset());

    // ----- In-game back (confirm) -----
    _on('btn-game-quit', 'click', () => {
      if (confirm('לצאת מהסיבוב? ההתקדמות תאבד.')) {
        _hideFeedbackOverlay();
        MAP.disableClick();
        showScreen('screen-dashboard');
        renderDashboard();
      }
    });

    // ----- Summary buttons -----
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      pendingPrize = null; // cancel auto-show if user clicks first
      startGameRound();
    });

    document.getElementById('btn-summary-home')?.addEventListener('click', () => {
      pendingPrize = null; // cancel auto-show if user clicks first
      currentProfile = getProfile(currentProfile.name); // refresh
      showScreen('screen-dashboard');
      renderDashboard();
    });
  }

  // ── Utility ────────────────────────────────────────────────
  function _el(tag, classes, html = '') {
    const el = document.createElement(tag);
    el.className = classes;
    el.innerHTML = html;
    return el;
  }

  function _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function _on(id, event, handler) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, handler);
  }

  return { init };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => APP.init());
