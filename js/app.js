// ============================================================
// גולה עולמי — בקר האפליקציה (ניהול מסכים + אירועים)
// ============================================================

const APP = (() => {

  // ── Screen registry ────────────────────────────────────────
  const SCREENS = ['screen-loading', 'screen-profiles', 'screen-dashboard', 'screen-game-select', 'screen-setup',
                   'screen-game', 'screen-summary', 'screen-prize', 'screen-continents', 'screen-explore'];

  // ── App state ──────────────────────────────────────────────
  let currentProfile       = null; // profile object
  let pendingPrize         = null; // prize object waiting to be shown
  let gameSetup            = { mode: 'B', continent: 'all', level: 'easy' };
  let lastFeedback         = null; // result from submitAnswer
  let _editingProfileName  = null; // null = adding mode, string = editing mode
  let _verifyPrevScore     = 0;   // points earned in round before verification (for deduction on exit)
  let _verifyCountries     = [];  // countries for retry if verification fails

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

  function _getPlayerTitle(points) {
    const earned = [...PRIZES].reverse().find(pr => points >= pr.points);
    return earned ? earned.achievement : 'חוקר מתחיל';
  }

  function renderProfilesScreen() {
    const profiles = loadProfiles(); // already sorted by points desc
    const grid     = document.getElementById('profiles-grid');
    if (!grid) return;

    grid.innerHTML = '';

    profiles.forEach((p, idx) => {
      const rankClass  = idx < 3 ? ` rank-${idx + 1}` : '';
      const medalEmoji = idx < 3 ? RANK_MEDALS[idx] : p.avatar;

      const title = _getPlayerTitle(p.points);
      const earnedPrizes = PRIZES.filter(pr => (p.prizesEarned || []).includes(pr.points));
      const prizeBadges = earnedPrizes.map(pr =>
        `<span class="prize-badge" title="${pr.achievement}">${pr.emoji}</span>`
      ).join('');
      const card = _el('div', `profile-card${rankClass}`, `
        <span class="profile-medal">${medalEmoji}</span>
        <div class="profile-card-info">
          <div class="profile-name">${p.name}</div>
          <div class="profile-title">${title}</div>
          <div class="profile-meta">
            <span class="profile-badge">${p.points} נקודות</span>
            <button class="profile-badge badge-countries" title="לחץ לפירוט">${getMasteredCount(p.name)} מדינות 👆</button>
          </div>
          ${prizeBadges ? `<div class="profile-prizes">${prizeBadges}</div>` : ''}
        </div>
        <div class="profile-card-right">
          <span class="rank-num">#${idx + 1}</span>
          <div class="profile-card-actions">
            <button class="btn-profile-action btn-profile-edit" title="ערוך">✏️</button>
            <button class="btn-profile-action btn-profile-delete" title="מחק">🗑️</button>
          </div>
        </div>
      `);

      // click on card body → select profile (ignore action buttons and countries badge)
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-profile-action') && !e.target.closest('.badge-countries')) _selectProfile(p.name);
      });

      card.querySelector('.badge-countries').addEventListener('click', (e) => {
        e.stopPropagation();
        _showCountriesModal(p.name);
      });

      card.querySelector('.btn-profile-edit').addEventListener('click', (e) => {
        e.stopPropagation();
        if (p.pin) {
          _showPinModal(p.name, 'enter', () => _showEditProfileModal(p.name));
        } else {
          _showEditProfileModal(p.name);
        }
      });

      card.querySelector('.btn-profile-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`למחוק את הפרופיל של ${p.name}?\nכל הנקודות והנתונים יימחקו.`)) return;
        if (p.pin) {
          _showPinModal(p.name, 'delete', () => {
            deleteProfile(p.name);
            renderProfilesScreen();
          });
        } else {
          deleteProfile(p.name);
          renderProfilesScreen();
        }
      });

      grid.appendChild(card);
    });

    // Add profile button
    const addBtn = _el('button', 'profile-card profile-card--add', `
      <span>＋</span>
      <span class="profile-name">הוסף ילד</span>
    `);
    addBtn.addEventListener('click', _showAddProfileModal);
    grid.appendChild(addBtn);
  }

  function _showCountriesModal(profileName) {
    const p = getProfile(profileName);
    if (!p) return;

    const CONT_ORDER  = ['europe', 'asia', 'africa', 'north-america', 'south-america', 'oceania'];
    const CONT_COLORS = { europe:'#60A5FA', asia:'#F472B6', africa:'#FBBF24', 'north-america':'#FB923C', 'south-america':'#34D399', oceania:'#2DD4BF' };
    const CONT_NAMES  = { europe:'אירופה', asia:'אסיה', africa:'אפריקה', 'north-america':'אמריקה הצפונית', 'south-america':'אמריקה הדרומית', oceania:'אוקיאניה' };

    const isMastered = c => {
      const d = p.countriesLearned[String(c.id)];
      return d && ((d.streak || 0) >= 3 || d.verified === true);
    };

    const totalMastered = COUNTRIES.filter(isMastered).length;

    let html = `
      <div class="sheet-title-block">
        <h2 class="sheet-title">המדינות של ${p.name} 🌍</h2>
        <p class="sheet-subtitle">${totalMastered} מתוך ${COUNTRIES.length} מדינות</p>
      </div>`;

    CONT_ORDER.forEach(key => {
      const all = COUNTRIES.filter(c => c.continent === key)
                           .sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'));
      const known   = all.filter(c =>  isMastered(c));
      const unknown = all.filter(c => !isMastered(c));

      const pct = all.length ? Math.round((known.length / all.length) * 100) : 0;
      html += `
        <div class="cont-section">
          <div class="cont-section-header">
            <span class="cont-dot" style="background:${CONT_COLORS[key]}"></span>
            <span class="cont-section-name">${CONT_NAMES[key]}</span>
            <span class="cont-section-count">${known.length} מתוך ${all.length}</span>
          </div>
          <div class="cont-progress-bar">
            <div class="cont-progress-fill" style="width:${pct}%;background:${CONT_COLORS[key]}"></div>
          </div>
          <div class="cont-countries-wrap">
            ${known.map(c => `<span class="country-chip" style="border-color:${CONT_COLORS[key]}">${getFlagEmoji(c.iso2)} ${c.nameHe}</span>`).join('')}
            ${unknown.map(c => `<span class="country-chip country-chip--unknown">${getFlagEmoji(c.iso2)} ${c.nameHe}</span>`).join('')}
          </div>
        </div>`;
    });

    document.getElementById('countries-sheet-content').innerHTML = html;
    document.getElementById('modal-countries').classList.remove('hidden');
  }

  function _selectProfile(name) {
    const p = getProfile(name);
    if (p && p.pin) {
      _showPinModal(name, 'enter', () => {
        currentProfile = getProfile(name);
        showScreen('screen-dashboard');
        renderDashboard();
      });
    } else {
      currentProfile = getProfile(name);
      showScreen('screen-dashboard');
      renderDashboard();
    }
  }

  // ── PIN modal ───────────────────────────────────────────────
  // mode: 'enter' | 'delete'
  function _showPinModal(profileName, mode, onSuccess) {
    const modal    = document.getElementById('modal-pin');
    const input    = document.getElementById('pin-entry-input');
    const errorEl  = document.getElementById('pin-error');
    const nameEl   = document.getElementById('pin-modal-name');
    const avatarEl = document.getElementById('pin-modal-avatar');
    const confirmBtn = document.getElementById('btn-pin-confirm');
    if (!modal) return;

    const p = getProfile(profileName);
    nameEl.textContent   = p ? p.name   : profileName;
    avatarEl.textContent = p ? p.avatar : '🌍';
    input.value = '';
    errorEl.classList.add('hidden');
    confirmBtn.textContent = mode === 'delete' ? 'מחק' : 'כניסה';
    if (mode === 'delete') confirmBtn.classList.replace('btn-primary', 'btn-danger');
    else                   { confirmBtn.classList.remove('btn-danger'); confirmBtn.classList.add('btn-primary'); }

    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);

    // one-time confirm handler
    const doConfirm = () => {
      const entered = input.value.trim();
      if (!checkPin(profileName, entered)) {
        errorEl.classList.remove('hidden');
        input.value = '';
        input.focus();
        return;
      }
      modal.classList.add('hidden');
      cleanup();
      onSuccess();
    };

    const doCancel = () => {
      modal.classList.add('hidden');
      cleanup();
    };

    const onKey = (e) => { if (e.key === 'Enter') doConfirm(); };

    confirmBtn.addEventListener('click', doConfirm);
    document.getElementById('btn-pin-cancel').addEventListener('click', doCancel);
    input.addEventListener('keydown', onKey);

    function cleanup() {
      confirmBtn.removeEventListener('click', doConfirm);
      document.getElementById('btn-pin-cancel')?.removeEventListener('click', doCancel);
      input.removeEventListener('keydown', onKey);
    }
  }

  function _showAddProfileModal() {
    _editingProfileName = null;
    const modal = document.getElementById('modal-add-profile');
    if (!modal) return;
    document.querySelector('#modal-add-profile .modal-title').textContent = 'ילד/ה חדש/ה';
    document.getElementById('btn-add-profile-confirm').textContent = 'הוסף';
    document.getElementById('new-profile-name').value = '';
    document.getElementById('new-profile-pin').value  = '';
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
    document.getElementById('new-profile-pin').value  = ''; // leave blank = keep existing
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

    _setText('dash-name',      p.name);
    _setText('dash-avatar',    p.avatar);
    _setText('dash-points',    p.points.toLocaleString());
    _setText('dash-countries', `${getMasteredCount(p.name)}`);
    _setText('dash-title',     _getPlayerTitle(p.points));
    const prizesEl = document.getElementById('dash-prizes');
    if (prizesEl) {
      const earned = PRIZES.filter(pr => (p.prizesEarned || []).includes(pr.points));
      prizesEl.innerHTML = earned.map(pr =>
        `<span class="prize-badge" title="${pr.achievement}">${pr.emoji}</span>`
      ).join('');
    }

    // lock/unlock game buttons based on continents passed
    const passed = hasContinentsPassed(p.name);
    const btnB = document.getElementById('btn-game-mode-b');
    const btnA = document.getElementById('btn-game-mode-a');
    if (btnB) btnB.classList.toggle('locked', !passed);
    if (btnA) btnA.classList.toggle('locked', !passed);

    // next prize bar with milestones
    const next = getNextPrize(p.name);
    if (next) {
      _setText('dash-next-prize', `${next.emoji} ${next.prize} — ${next.points} נק׳`);
    } else {
      _setText('dash-next-prize', '🏆 כל הפרסים הושגו!');
    }
    const MAX_PTS = PRIZES[PRIZES.length - 1].points;
    const barPct  = Math.min(Math.round((p.points / MAX_PTS) * 100), 100);
    const bar = document.getElementById('dash-prize-bar');
    if (bar) bar.style.width = barPct + '%';
    // render milestone dots
    const track = document.getElementById('prize-bar-track');
    if (track) {
      track.querySelectorAll('.milestone').forEach(el => el.remove());
      PRIZES.forEach(pr => {
        const pos = Math.round((pr.points / MAX_PTS) * 100);
        let cls = 'future';
        if ((p.prizesEarned || []).includes(pr.points)) cls = 'earned';
        else if (next && next.points === pr.points) cls = 'next';
        const m = document.createElement('div');
        m.className = `milestone ${cls}`;
        m.style.right = pos + '%';
        m.innerHTML = `<div class="milestone-dot"></div>
          <div class="milestone-below">
            <span class="milestone-emoji">${pr.emoji}</span>
            <span class="milestone-pts">${pr.points.toLocaleString()}</span>
          </div>`;
        track.appendChild(m);
      });
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

    const rows = CONT_META.map(({ key, label, color }) => {
      const { mastered, total } = getMasteredByContinent(p.name, key);
      const pct  = total > 0 ? Math.round((mastered / total) * 100) : 0;
      const star = (mastered === total && total > 0) ? ' ⭐' : '';
      return `<div class="cont-prog-row">
        <span class="cont-prog-label">${label}${star}</span>
        <div class="cont-prog-track">
          <div class="cont-prog-fill" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="cont-prog-count">${mastered}/${total}</span>
      </div>`;
    }).join('');

    return `<div class="continent-progress-list profile-cont-progress">${rows}</div>`;
  }

  function _prevPrize(currentPoints, nextPrize) {
    // find the prize just below currentPoints
    const idx = PRIZES.findIndex(p => p === nextPrize);
    return idx > 0 ? PRIZES[idx - 1].points : 0;
  }

  // ── GAME SELECT SCREEN ─────────────────────────────────────
  function renderGameSelectScreen() {
    const passed = currentProfile && hasContinentsPassed(currentProfile.name);
    const btnB   = document.getElementById('btn-game-mode-b');
    const btnA   = document.getElementById('btn-game-mode-a');
    const hintB  = document.getElementById('hint-lock-mode-b');
    const hintA  = document.getElementById('hint-lock-mode-a');

    if (!passed) {
      if (btnB) { btnB.classList.add('locked');    btnB.title = '🔒 צלח יבשות קודם'; }
      if (btnA) { btnA.classList.add('locked');    btnA.title = '🔒 צלח יבשות קודם'; }
      if (hintB) hintB.classList.remove('hidden');
      if (hintA) hintA.classList.remove('hidden');
    } else {
      if (btnB) { btnB.classList.remove('locked'); btnB.title = ''; }
      if (btnA) { btnA.classList.remove('locked'); btnA.title = ''; }
      if (hintB) hintB.classList.add('hidden');
      if (hintA) hintA.classList.add('hidden');
    }
  }

  // ── SETUP SCREEN ───────────────────────────────────────────
  function renderSetupScreen() {
    const modeLabel = gameSetup.mode === 'B' ? '🗺 זהה מדינות' : '🔍 מצא מדינות';
    _setText('setup-screen-title', modeLabel);

    // יבשות
    document.querySelectorAll('[data-continent]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.continent === gameSetup.continent);
    });

    const continentChosen = gameSetup.continent !== 'all';
    const levelGrid = document.getElementById('level-grid');
    const levelMsg  = document.getElementById('levels-disabled-msg');

    if (continentChosen) {
      // בחרו יבשת — מסתירים רמות, מראים הודעה
      if (levelGrid) levelGrid.classList.add('hidden');
      if (levelMsg)  levelMsg.classList.remove('hidden');
      document.querySelectorAll('[data-level]').forEach(btn => btn.classList.remove('active'));
    } else {
      // בחרו רמה — מראים רמות, מסתירים הודעה
      if (levelGrid) levelGrid.classList.remove('hidden');
      if (levelMsg)  levelMsg.classList.add('hidden');
      document.querySelectorAll('[data-level]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.level === gameSetup.level);
        const locked = currentProfile && !isLevelUnlocked(currentProfile.name, btn.dataset.level);
        btn.disabled = !!locked;
        btn.classList.toggle('locked', !!locked);
        btn.title = locked ? `נדרשות ${LEVELS[btn.dataset.level].unlockAt} מדינות` : '';
      });
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
      el.classList.add('active-streak');
    } else {
      el.classList.add('hidden');
      el.classList.remove('active-streak');
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
      if (result.justMastered) {
        bonusEl.classList.remove('hidden');
        bonusEl.textContent = `⭐ שלטת על ${result.masteredCountry?.nameHe}! +${result.points - (LEVELS[gameSetup.level]?.points ?? 15)} בונוס!`;
      } else {
        bonusEl.classList.add('hidden');
      }
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
    const scoreEl = document.getElementById('summary-score');
    if (summary.passed) {
      const multiplierNote = summary.correctCount === 10 ? ' ×1.5 🔥' : summary.correctCount === 9 ? ' ×1.2 ⭐' : '';
      _setText('summary-score', `${summary.score} נקודות${multiplierNote}`);
      scoreEl?.classList.remove('failed'); scoreEl?.classList.add('passed');
    } else {
      _setText('summary-score', `לא הגעת ל-${summary.passThreshold}/10 — אין נקודות הפעם`);
      scoreEl?.classList.remove('passed'); scoreEl?.classList.add('failed');
    }

    // הצג מדינות שהשגת שליטה עליהן
    if (summary.newlyMastered && summary.newlyMastered.length > 0) {
      const masteredNames = summary.newlyMastered.map(c => c.nameHe).join('، ');
      const masteredEl = document.getElementById('summary-mastered');
      if (masteredEl) {
        masteredEl.textContent = `⭐ שלטת על: ${masteredNames}`;
        masteredEl.classList.remove('hidden');
      }
    } else {
      document.getElementById('summary-mastered')?.classList.add('hidden');
    }

    // answers list
    const list = document.getElementById('summary-answers');
    if (list) {
      list.innerHTML = '';
      summary.answers.forEach(a => {
        const item = _el('div', `summary-answer-item ${a.correct ? 'correct' : 'wrong'}`,
          `<span class="answer-icon">${a.correct ? '✓' : '✗'}</span>
           <span class="answer-flag">${getFlagEmoji(a.country.iso2)}</span>
           <span class="answer-name">${a.country.nameHe}</span>`
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

    // פופאפ רמה חדשה שנפתחה (מופיע אחרי פרס אם יש)
    if (summary.levelUnlocked) {
      const delay = summary.roundPrize ? 3500 : 1500;
      setTimeout(() => _showLevelUnlockPopup(summary.levelUnlocked), delay);
    }

    // כותרת וסגנון מיוחד לסיבוב בדיקה
    if (summary.isVerification) {
      _setText('summary-rating', '🗺️');
      const titleEl = document.getElementById('summary-title');
      if (titleEl) titleEl.textContent = 'סיבוב בדיקה';
    }

    // כפתורי סיכום — תמיד מוסתרים בהתחלה, מוצגים לפי מצב
    const verBtnEl    = document.getElementById('btn-start-verification');
    const retryBtnEl  = document.getElementById('btn-retry-verification');
    const playAgainEl = document.getElementById('btn-play-again');
    const homeEl      = document.getElementById('btn-summary-home');
    verBtnEl?.classList.add('hidden');

    if (summary.isVerification) {
      // סיבוב בדיקה נגמר
      if (!summary.passed) {
        // נכשל — הצג רק "נסה שוב"
        retryBtnEl?.classList.remove('hidden');
        playAgainEl?.classList.add('hidden');
        homeEl?.classList.remove('hidden');
      } else {
        // עבר — הצג כפתורים רגילים
        retryBtnEl?.classList.add('hidden');
        playAgainEl?.classList.remove('hidden');
        homeEl?.classList.remove('hidden');
        _verifyPrevScore = 0;
        _verifyCountries = [];
      }
    } else if (summary.mode === 'B' && summary.correctCount >= 8) {
      // צריך סיבוב בדיקה — מציג כפתור חובה, מסתיר שאר הכפתורים
      retryBtnEl?.classList.add('hidden');
      playAgainEl?.classList.add('hidden');
      homeEl?.classList.add('hidden');

      _verifyPrevScore = summary.score;
      _verifyCountries = summary.answers.map(a => a.country);

      verBtnEl?.classList.remove('hidden');

      // הסתר ספירה לאחור אם הייתה
      document.getElementById('summary-verify-countdown')?.classList.add('hidden');
    } else {
      // סיבוב רגיל שלא הגיע ל-8 — כפתורים רגילים
      retryBtnEl?.classList.add('hidden');
      playAgainEl?.classList.remove('hidden');
      homeEl?.classList.remove('hidden');
    }
  }

  function _showLevelUnlockPopup(levelUnlocked) {
    const def   = levelUnlocked.def;
    const count = def.unlockAt;
    const msg   = `🎉 כל הכבוד!\nצלחת ${count} מדינות שלוש פעמים ברציפות.\nרמת "${def.nameHe}" נפתחה לך!`;
    alert(msg);
  }

  // ── CONFETTI ────────────────────────────────────────────────
  function _launchConfetti() {
    const screen = document.getElementById('screen-prize');
    if (!screen) return;
    // Remove old container if exists
    screen.querySelector('.confetti-container')?.remove();
    const container = document.createElement('div');
    container.className = 'confetti-container';
    const colors = ['#F59E0B','#0EA5E9','#10B981','#F472B6','#FB923C','#A78BFA','#FBBF24'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      p.style.left     = `${Math.random() * 100}%`;
      p.style.width    = `${6 + Math.random() * 8}px`;
      p.style.height   = `${6 + Math.random() * 8}px`;
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      p.style.animationDuration = `${1.8 + Math.random() * 2.2}s`;
      p.style.animationDelay   = `${Math.random() * 1.2}s`;
      container.appendChild(p);
    }
    screen.insertBefore(container, screen.firstChild);
    // Clean up after animation
    setTimeout(() => container.remove(), 5000);
  }

  // ── PRIZE SCREEN ───────────────────────────────────────────
  // destination: 'play-again' | 'home' (where to go after prize)
  function showPrizeScreen(prize, destination = 'home') {
    showScreen('screen-prize');
    _setText('prize-emoji',       prize.emoji);
    _setText('prize-achievement', prize.achievement);
    _setText('prize-name',        prize.prize);
    _setText('prize-points',      `${prize.points} נקודות`);

    // animation + confetti
    const el = document.getElementById('screen-prize');
    if (el) {
      el.classList.remove('prize-animate');
      void el.offsetWidth; // reflow
      el.classList.add('prize-animate');
    }
    _launchConfetti();

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
      const pin    = document.getElementById('new-profile-pin')?.value.trim();
      if (!name) return;
      if (pin && !/^\d{4}$/.test(pin)) { alert('PIN חייב להיות 4 ספרות'); return; }

      if (_editingProfileName) {
        // edit mode — pass pin only if entered (empty = keep existing)
        const result = editProfile(_editingProfileName, name, avatar, pin || undefined);
        if (!result) { alert('שם זה כבר קיים'); return; }
        if (currentProfile && currentProfile.name === _editingProfileName) {
          currentProfile = result;
        }
      } else {
        // add mode
        const created = createProfile(name, avatar, pin);
        if (!created) { alert('שם זה כבר קיים'); return; }
      }

      document.getElementById('modal-add-profile')?.classList.add('hidden');
      renderProfilesScreen();
    });

    _on('btn-add-profile-cancel', 'click', () => {
      document.getElementById('modal-add-profile')?.classList.add('hidden');
    });

    _on('stat-card-countries', 'click', () => {
      if (currentProfile) _showCountriesModal(currentProfile.name);
    });

    _on('btn-countries-close', 'click', () => {
      document.getElementById('modal-countries')?.classList.add('hidden');
    });
    document.getElementById('modal-countries')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-countries') document.getElementById('modal-countries').classList.add('hidden');
    });

    // ----- Dashboard -----
    _on('btn-play', 'click', () => {
      showScreen('screen-game-select');
      renderGameSelectScreen();
    });

    // ----- Game selection -----
    _on('btn-gamesel-back', 'click', () => {
      showScreen('screen-dashboard');
      renderDashboard();
    });

    _on('btn-game-mode-b', 'click', () => {
      if (!hasContinentsPassed(currentProfile.name)) {
        alert('🌍 קודם צריך לסיים משחק יבשות!\nפשוט בחר "מצא יבשות" וצלח לפחות 5/6.');
        return;
      }
      gameSetup.mode = 'B';
      showScreen('screen-setup');
      renderSetupScreen();
    });

    _on('btn-game-mode-a', 'click', () => {
      if (!hasContinentsPassed(currentProfile.name)) {
        alert('🌍 קודם צריך לסיים משחק יבשות!\nפשוט בחר "מצא יבשות" וצלח לפחות 5/6.');
        return;
      }
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

    // Continent toggle — בחירת יבשת מבטלת בחירת רמה
    document.querySelectorAll('[data-continent]').forEach(btn => {
      btn.addEventListener('click', () => {
        gameSetup.continent = btn.dataset.continent;
        if (gameSetup.continent !== 'all') {
          gameSetup.level = 'all'; // מצב יבשת — ללא סינון רמה
        } else if (gameSetup.level === 'all') {
          gameSetup.level = 'easy'; // חזרה ל-"הכל" → ברירת מחדל קלה
        }
        renderSetupScreen();
      });
    });

    // Level toggle — בחירת רמה מאפסת יבשת ל-"הכל"
    document.querySelectorAll('[data-level]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        gameSetup.level = btn.dataset.level;
        gameSetup.continent = 'all';
        renderSetupScreen();
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
      if (GAME.isActiveVerification()) {
        // Show custom warning modal — exiting costs the prev-round points
        _setText('modal-verify-pts', String(_verifyPrevScore));
        document.getElementById('modal-verify-exit')?.classList.remove('hidden');
      } else {
        if (confirm('לצאת מהסיבוב? ההתקדמות תאבד.')) {
          _hideFeedbackOverlay();
          MAP.disableClick();
          showScreen('screen-dashboard');
          renderDashboard();
        }
      }
    });

    // ----- Verification exit modal -----
    _on('btn-modal-continue', 'click', () => {
      document.getElementById('modal-verify-exit')?.classList.add('hidden');
    });

    _on('btn-modal-exit', 'click', async () => {
      document.getElementById('modal-verify-exit')?.classList.add('hidden');
      // Deduct the previous round's points since verification was abandoned
      if (_verifyPrevScore > 0) {
        await addPoints(currentProfile.name, -_verifyPrevScore);
        _verifyPrevScore = 0;
      }
      _hideFeedbackOverlay();
      MAP.disableClick();
      currentProfile = getProfile(currentProfile.name);
      showScreen('screen-dashboard');
      renderDashboard();
    });

    // ----- Summary buttons -----
    async function _launchVerification(countries) {
      // Save prev-round score for potential deduction on exit
      _verifyPrevScore = GAME.getRoundSummary()?.score || _verifyPrevScore;
      _verifyCountries = countries;

      showScreen('screen-game');
      _setText('game-profile-name',   currentProfile.name);
      _setText('game-profile-avatar', currentProfile.avatar);

      await MAP.init('map-container');

      gameSetup.mode = 'A'; // verification = click on map
      const q = GAME.startVerificationRound(currentProfile.name, countries);
      if (!q) { alert('שגיאה בטעינת סיבוב בדיקה'); return; }
      renderQuestion(q);
    }

    document.getElementById('btn-start-verification')?.addEventListener('click', async () => {
      if (_verifyCountries.length === 0) return;
      await _launchVerification(_verifyCountries);
    });

    document.getElementById('btn-retry-verification')?.addEventListener('click', async () => {
      if (_verifyCountries.length === 0) return;
      await _launchVerification(_verifyCountries);
    });

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
