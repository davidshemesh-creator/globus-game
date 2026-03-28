// ============================================================
// גולה עולמי — ניהול פרופילים (Firebase Firestore)
// ============================================================

const AVATAR_OPTIONS = [
  '🌺', '🚀', '⭐', '🦁', '🐬', '🦋',
  '🎮', '🌈', '🐼', '🐯', '🦊', '🐧',
  '🦄', '🐸', '🦅', '🎯', '🏆', '🌍',
  '🎸', '🦖', '🐉', '🎨', '🏄', '🧙',
];

// ── In-memory cache ─────────────────────────────────────────
let _profilesCache = [];

// ── Firebase init ───────────────────────────────────────────
// Call once on app start. Loads profiles and sets up real-time listener.
async function initProfiles() {
  return new Promise((resolve, reject) => {
    let resolved = false;
    db.collection('profiles')
      .orderBy('points', 'desc')
      .onSnapshot(
        snap => {
          _profilesCache = snap.docs.map(d => d.data());
          if (!resolved) {
            resolved = true;
            resolve();
          } else {
            // Live update — notify app to refresh profiles screen
            document.dispatchEvent(new CustomEvent('profiles-updated'));
          }
        },
        err => {
          console.error('Firestore snapshot error:', err);
          if (!resolved) { resolved = true; reject(err); }
        }
      );
  });
}

// ── Firestore write helpers ─────────────────────────────────
function _saveProfile(profile) {
  db.collection('profiles').doc(profile.name)
    .set(profile)
    .catch(e => console.error('Firestore write error:', e));
}

function _deleteProfileFromDB(name) {
  db.collection('profiles').doc(name)
    .delete()
    .catch(e => console.error('Firestore delete error:', e));
}

// ── Public API (same signatures as localStorage version) ────

function loadProfiles() {
  // Return cache, sorted by points descending
  return [..._profilesCache].sort((a, b) => b.points - a.points);
}

// Kept for compatibility — Firestore writes happen per-operation
function saveProfiles(profiles) {
  _profilesCache = [...profiles];
}

function getProfile(name) {
  return _profilesCache.find(p => p.name === name) || null;
}

function createProfile(name, avatar, pin) {
  if (_profilesCache.find(p => p.name === name)) return null;
  const newProfile = {
    name,
    avatar,
    pin: pin || '',
    points: 0,
    countriesLearned: {},
    prizesEarned: [],
    levelsCompleted: [],
    continentsPassed: false
  };
  _profilesCache.push(newProfile);
  _saveProfile(newProfile);
  return newProfile;
}

function deleteProfile(name) {
  _profilesCache = _profilesCache.filter(p => p.name !== name);
  _deleteProfileFromDB(name);
}

function editProfile(oldName, newName, newAvatar, newPin) {
  const p = _profilesCache.find(p => p.name === oldName);
  if (!p) return null;
  if (newName !== oldName && _profilesCache.find(pr => pr.name === newName)) return null;

  if (newName !== oldName) {
    // Name changed → delete old doc, create new one
    _deleteProfileFromDB(oldName);
  }
  p.name   = newName;
  p.avatar = newAvatar;
  if (newPin !== undefined) p.pin = newPin;
  _saveProfile(p);
  return p;
}

function checkPin(name, enteredPin) {
  const p = _profilesCache.find(p => p.name === name);
  if (!p) return false;
  if (!p.pin) return true; // no PIN set → free entry
  return enteredPin === p.pin || enteredPin === ADMIN_PIN;
}

function resetProfile(name) {
  const p = _profilesCache.find(p => p.name === name);
  if (!p) return;
  p.points           = 0;
  p.countriesLearned = {};
  p.prizesEarned     = [];
  p.levelsCompleted  = [];
  p.continentsPassed = false;
  _saveProfile(p);
}

function addPoints(profileName, delta) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return null;
  const prevPoints = p.points;
  p.points += delta;
  const newPrize = checkMilestone(prevPoints, p.points, p.prizesEarned);
  if (newPrize) p.prizesEarned.push(newPrize.points);
  _saveProfile(p);
  return newPrize;
}

function recordCountryAnswer(profileName, countryId, correct) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return;
  const key = String(countryId);
  if (!p.countriesLearned[key]) p.countriesLearned[key] = { correct: 0, wrong: 0, streak: 0 };
  if (correct) {
    p.countriesLearned[key].correct++;
    p.countriesLearned[key].streak = (p.countriesLearned[key].streak || 0) + 1;
  } else {
    p.countriesLearned[key].wrong++;
    p.countriesLearned[key].streak = 0; // איפוס רצף בטעות
  }
  _saveProfile(p);
}

function markLevelCompleted(profileName, level) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return;
  if (!p.levelsCompleted.includes(level)) p.levelsCompleted.push(level);
  _saveProfile(p);
}

function isLevelUnlocked(profileName, level) {
  const def = LEVELS[level];
  if (!def || def.unlockAt === 0) return true;
  return getMasteredCount(profileName) >= def.unlockAt;
}

// מחזיר רמה שנפתחה חדש — אחרי עדכון mastered, לפני ואחרי
function checkNewLevelUnlock(profileName, prevMastered) {
  const newMastered = getMasteredCount(profileName);
  for (const [key, def] of Object.entries(LEVELS)) {
    if (def.unlockAt > 0 && prevMastered < def.unlockAt && newMastered >= def.unlockAt) {
      return { levelKey: key, def };
    }
  }
  return null;
}

function isMasterUnlocked(profileName) {
  return isLevelUnlocked(profileName, 'master');
}

function checkMilestone(prevPoints, newPoints, alreadyEarned = []) {
  for (const prize of PRIZES) {
    if (prevPoints < prize.points && newPoints >= prize.points && !alreadyEarned.includes(prize.points)) {
      return prize;
    }
  }
  return null;
}

// מספר מדינות שהושגה שליטה בהן (3 ברציפות או verified)
function getMasteredCount(profileName) {
  const p = getProfile(profileName);
  if (!p) return 0;
  return Object.values(p.countriesLearned).filter(d => (d.streak || 0) >= 3 || d.verified === true).length;
}

function setContinentsPassed(profileName) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return;
  p.continentsPassed = true;
  _saveProfile(p);
}

function hasContinentsPassed(profileName) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return false;
  return p.continentsPassed === true;
}

function markCountryVerified(profileName, countryId) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return;
  const key = String(countryId);
  if (!p.countriesLearned[key]) p.countriesLearned[key] = { correct: 0, wrong: 0, streak: 0 };
  p.countriesLearned[key].verified = true;
  _saveProfile(p);
}

// תאימות אחורה
function getCountriesLearnedCount(profileName) {
  return getMasteredCount(profileName);
}

// רצף נוכחי של מדינה ספציפית
function getCountryStreak(profileName, countryId) {
  const p = getProfile(profileName);
  if (!p) return 0;
  const data = p.countriesLearned[String(countryId)];
  return data ? (data.streak || 0) : 0;
}

// נתוני שליטה לפי יבשת
function getMasteredByContinent(profileName, continentKey) {
  const p = getProfile(profileName);
  const countries = COUNTRIES.filter(c => c.continent === continentKey);
  if (!p) return { mastered: 0, total: countries.length };
  const mastered = countries.filter(c => {
    const d = p.countriesLearned[String(c.id)];
    return d && (d.streak || 0) >= 3;
  }).length;
  return { mastered, total: countries.length };
}

function getCountryWeight(profileName, countryId) {
  const p = getProfile(profileName);
  if (!p) return 1;
  const data = p.countriesLearned[String(countryId)];
  if (!data)                      return 1.2; // מעולם לא נראה
  if ((data.streak || 0) >= 3)    return 0.1; // שלטת — נדיר
  if (data.wrong > data.correct)  return 1.8; // מתקשה
  if (data.correct >= 1)          return 1.0; // בלמידה
  return 1.2;
}

function getNextPrize(profileName) {
  const p = getProfile(profileName);
  if (!p) return null;
  return PRIZES.find(pr => p.points < pr.points) || null;
}
