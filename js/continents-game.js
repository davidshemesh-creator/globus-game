// ============================================================
// גולה עולמי — משחק זיהוי יבשות (לחיצה על המפה)
// ============================================================

const CONTINENTS_GAME = (() => {

  const CONT_DATA = {
    'europe':        { nameHe: 'אירופה' },
    'asia':          { nameHe: 'אסיה' },
    'africa':        { nameHe: 'אפריקה' },
    'north-america': { nameHe: 'אמריקה הצפונית' },
    'south-america': { nameHe: 'אמריקה הדרומית' },
    'oceania':       { nameHe: 'אוקיאניה' },
  };

  const POINTS           = 20;
  const MAP_CONTAINER_ID = 'cont-map-container';

  let sequence     = []; // shuffled continent keys
  let current      = 0;  // index into sequence
  let correctCount = 0;
  let locked       = false; // block clicks during feedback
  let profileName  = null;
  let _lastPrize   = null;

  // ── Public API ─────────────────────────────────────────────

  async function start(profile) {
    profileName  = profile;
    sequence     = _shuffle(Object.keys(CONT_DATA));
    current      = 0;
    correctCount = 0;
    locked       = false;
    _lastPrize   = null;

    document.getElementById('cont-result')?.classList.add('hidden');

    await MAP.init(MAP_CONTAINER_ID);
    MAP.disableZoom();
    MAP.renderAsContinents();
    MAP.enableContinentClick(_onContinentClick);

    _renderQuestion();
  }

  function getLastPrize() { return _lastPrize; }

  // ── Private ────────────────────────────────────────────────

  function _renderQuestion() {
    const key    = sequence[current];
    const nameEl = document.getElementById('cont-question-name');
    const progEl = document.getElementById('cont-progress');
    if (nameEl) nameEl.textContent = CONT_DATA[key].nameHe;
    if (progEl) progEl.textContent = `${current + 1} / 6`;
  }

  function _onContinentClick(continentKey) {
    if (locked) return;

    const targetKey = sequence[current];
    const correct   = continentKey === targetKey;

    locked = true;
    if (correct) {
      correctCount++;
      MAP.flashContinentResult(targetKey);
    } else {
      MAP.flashContinentResult(targetKey, continentKey);
    }

    setTimeout(() => {
      current++;
      if (current >= sequence.length) {
        _finish();
      } else {
        MAP.colorByContinents();
        MAP.enableContinentClick(_onContinentClick);
        _renderQuestion();
        locked = false;
      }
    }, 1300);
  }

  function _finish() {
    MAP.disableClick();

    const allCorrect = correctCount === 6;
    _lastPrize = allCorrect ? addPoints(profileName, POINTS) : null;

    const icon  = document.getElementById('cont-result-icon');
    const title = document.getElementById('cont-result-title');
    const text  = document.getElementById('cont-result-text');
    if (icon)  icon.textContent  = allCorrect ? '🏆' : '😔';
    if (title) title.textContent = allCorrect ? 'מושלם! 6/6 נכון!' : `${correctCount}/6 נכון`;
    if (text)  text.textContent  = allCorrect ? `+${POINTS} נקודות` : 'אין נקודות הפעם';

    document.getElementById('cont-result')?.classList.remove('hidden');
  }

  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  return { start, getLastPrize };
})();
