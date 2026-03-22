// ============================================================
// גולה עולמי — ניהול פרופילים (Firebase Firestore)
// ============================================================

const AVATAR_OPTIONS = ['🌺', '🚀', '⭐', '🦁', '🐬', '🦋', '🎮', '🌈'];

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
    levelsCompleted: []
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
  if (!p.countriesLearned[key]) p.countriesLearned[key] = { correct: 0, wrong: 0 };
  if (correct) p.countriesLearned[key].correct++;
  else         p.countriesLearned[key].wrong++;
  _saveProfile(p);
}

function markLevelCompleted(profileName, level) {
  const p = _profilesCache.find(p => p.name === profileName);
  if (!p) return;
  if (!p.levelsCompleted.includes(level)) p.levelsCompleted.push(level);
  _saveProfile(p);
}

function isMasterUnlocked(profileName) {
  const p = getProfile(profileName);
  if (!p) return false;
  return p.levelsCompleted.includes('medium') && p.levelsCompleted.includes('hard');
}

function checkMilestone(prevPoints, newPoints, alreadyEarned = []) {
  for (const prize of PRIZES) {
    if (prevPoints < prize.points && newPoints >= prize.points && !alreadyEarned.includes(prize.points)) {
      return prize;
    }
  }
  return null;
}

function getCountriesLearnedCount(profileName) {
  const p = getProfile(profileName);
  if (!p) return 0;
  return Object.keys(p.countriesLearned).filter(k => p.countriesLearned[k].correct >= 1).length;
}

function getCountryWeight(profileName, countryId) {
  const p = getProfile(profileName);
  if (!p) return 1;
  const data = p.countriesLearned[String(countryId)];
  if (!data)              return 1.2;
  if (data.correct >= 3)  return 0.3;
  if (data.wrong > data.correct) return 1.8;
  return 1.0;
}

function getNextPrize(profileName) {
  const p = getProfile(profileName);
  if (!p) return null;
  return PRIZES.find(pr => p.points < pr.points) || null;
}
