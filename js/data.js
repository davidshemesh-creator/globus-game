// ============================================================
// גולה עולמי — נתוני מדינות
// ============================================================

const CONTINENTS = {
  'north-america': { nameHe: 'אמריקה הצפונית', color: '#FB923C', dark: '#EA580C' },
  'south-america': { nameHe: 'אמריקה הדרומית', color: '#34D399', dark: '#059669' },
  'europe':        { nameHe: 'אירופה',          color: '#60A5FA', dark: '#2563EB' },
  'africa':        { nameHe: 'אפריקה',          color: '#FBBF24', dark: '#D97706' },
  'asia':          { nameHe: 'אסיה',            color: '#F472B6', dark: '#DB2777' },
  'oceania':       { nameHe: 'אוקיאניה',        color: '#2DD4BF', dark: '#0D9488' },
};

// דגל מתוך קוד ISO 2
function getFlagEmoji(iso2) {
  if (!iso2) return '🏳️';
  return [...iso2.toUpperCase()].map(c =>
    String.fromCodePoint(c.charCodeAt(0) + 127397)
  ).join('');
}

// id = קוד ISO מספרי (תואם TopoJSON world-atlas)
const COUNTRIES = [
  // ── PRIORITY 5 — ידועות מאוד ──
  { id: 376,  iso2: 'IL', nameHe: 'ישראל',              continent: 'asia',          priority: 5 },
  { id: 840,  iso2: 'US', nameHe: 'ארצות הברית',        continent: 'north-america', priority: 5 },
  { id: 643,  iso2: 'RU', nameHe: 'רוסיה',              continent: 'europe',        priority: 5 },
  { id: 156,  iso2: 'CN', nameHe: 'סין',                continent: 'asia',          priority: 5 },
  { id: 76,   iso2: 'BR', nameHe: 'ברזיל',              continent: 'south-america', priority: 5 },
  { id: 818,  iso2: 'EG', nameHe: 'מצרים',              continent: 'africa',        priority: 5 },
  { id: 400,  iso2: 'JO', nameHe: 'ירדן',               continent: 'asia',          priority: 5 },
  { id: 760,  iso2: 'SY', nameHe: 'סוריה',              continent: 'asia',          priority: 5 },
  { id: 422,  iso2: 'LB', nameHe: 'לבנון',              continent: 'asia',          priority: 5 },
  { id: 682,  iso2: 'SA', nameHe: 'ערב הסעודית',        continent: 'asia',          priority: 5 },
  { id: 276,  iso2: 'DE', nameHe: 'גרמניה',             continent: 'europe',        priority: 5 },
  { id: 250,  iso2: 'FR', nameHe: 'צרפת',               continent: 'europe',        priority: 5 },
  { id: 826,  iso2: 'GB', nameHe: 'בריטניה',            continent: 'europe',        priority: 5 },
  { id: 392,  iso2: 'JP', nameHe: 'יפן',                continent: 'asia',          priority: 5 },
  { id: 356,  iso2: 'IN', nameHe: 'הודו',               continent: 'asia',          priority: 5 },
  { id: 36,   iso2: 'AU', nameHe: 'אוסטרליה',           continent: 'oceania',       priority: 5 },
  { id: 124,  iso2: 'CA', nameHe: 'קנדה',               continent: 'north-america', priority: 5 },
  { id: 380,  iso2: 'IT', nameHe: 'איטליה',             continent: 'europe',        priority: 5 },
  { id: 724,  iso2: 'ES', nameHe: 'ספרד',               continent: 'europe',        priority: 5 },
  { id: 484,  iso2: 'MX', nameHe: 'מקסיקו',             continent: 'north-america', priority: 5 },
  // ── PRIORITY 4 — ידועות ──
  { id: 792,  iso2: 'TR', nameHe: 'טורקיה',             continent: 'asia',          priority: 4 },
  { id: 364,  iso2: 'IR', nameHe: 'איראן',              continent: 'asia',          priority: 4 },
  { id: 368,  iso2: 'IQ', nameHe: 'עיראק',              continent: 'asia',          priority: 4 },
  { id: 4,    iso2: 'AF', nameHe: 'אפגניסטן',           continent: 'asia',          priority: 4 },
  { id: 586,  iso2: 'PK', nameHe: 'פקיסטן',             continent: 'asia',          priority: 4 },
  { id: 566,  iso2: 'NG', nameHe: 'ניגריה',             continent: 'africa',        priority: 4 },
  { id: 710,  iso2: 'ZA', nameHe: 'דרום אפריקה',        continent: 'africa',        priority: 4 },
  { id: 32,   iso2: 'AR', nameHe: 'ארגנטינה',           continent: 'south-america', priority: 4 },
  { id: 410,  iso2: 'KR', nameHe: 'קוריאה הדרומית',     continent: 'asia',          priority: 4 },
  { id: 360,  iso2: 'ID', nameHe: 'אינדונזיה',          continent: 'asia',          priority: 4 },
  { id: 528,  iso2: 'NL', nameHe: 'הולנד',              continent: 'europe',        priority: 4 },
  { id: 56,   iso2: 'BE', nameHe: 'בלגיה',              continent: 'europe',        priority: 4 },
  { id: 752,  iso2: 'SE', nameHe: 'שוודיה',             continent: 'europe',        priority: 4 },
  { id: 578,  iso2: 'NO', nameHe: 'נורווגיה',           continent: 'europe',        priority: 4 },
  { id: 756,  iso2: 'CH', nameHe: 'שווייץ',             continent: 'europe',        priority: 4 },
  { id: 40,   iso2: 'AT', nameHe: 'אוסטריה',            continent: 'europe',        priority: 4 },
  { id: 620,  iso2: 'PT', nameHe: 'פורטוגל',            continent: 'europe',        priority: 4 },
  { id: 300,  iso2: 'GR', nameHe: 'יוון',               continent: 'europe',        priority: 4 },
  { id: 616,  iso2: 'PL', nameHe: 'פולין',              continent: 'europe',        priority: 4 },
  { id: 804,  iso2: 'UA', nameHe: 'אוקראינה',           continent: 'europe',        priority: 4 },
  { id: 764,  iso2: 'TH', nameHe: 'תאילנד',             continent: 'asia',          priority: 4 },
  { id: 704,  iso2: 'VN', nameHe: 'וייטנאם',            continent: 'asia',          priority: 4 },
  { id: 608,  iso2: 'PH', nameHe: 'הפיליפינים',         continent: 'asia',          priority: 4 },
  { id: 458,  iso2: 'MY', nameHe: 'מלזיה',              continent: 'asia',          priority: 4 },
  { id: 404,  iso2: 'KE', nameHe: 'קניה',               continent: 'africa',        priority: 4 },
  { id: 231,  iso2: 'ET', nameHe: 'אתיופיה',            continent: 'africa',        priority: 4 },
  { id: 12,   iso2: 'DZ', nameHe: "אלג'יריה",           continent: 'africa',        priority: 4 },
  { id: 504,  iso2: 'MA', nameHe: 'מרוקו',              continent: 'africa',        priority: 4 },
  { id: 192,  iso2: 'CU', nameHe: 'קובה',               continent: 'north-america', priority: 4 },
  { id: 170,  iso2: 'CO', nameHe: 'קולומביה',           continent: 'south-america', priority: 4 },
  { id: 152,  iso2: 'CL', nameHe: "צ'ילה",              continent: 'south-america', priority: 4 },
  { id: 604,  iso2: 'PE', nameHe: 'פרו',                continent: 'south-america', priority: 4 },
  { id: 554,  iso2: 'NZ', nameHe: 'ניו זילנד',          continent: 'oceania',       priority: 4 },
  { id: 414,  iso2: 'KW', nameHe: 'כווית',              continent: 'asia',          priority: 4 },
  { id: 784,  iso2: 'AE', nameHe: 'איחוד האמירויות',    continent: 'asia',          priority: 4 },
  { id: 634,  iso2: 'QA', nameHe: 'קטר',                continent: 'asia',          priority: 4 },
  // ── PRIORITY 3 — מוכרות בינוני ──
  { id: 48,   iso2: 'BH', nameHe: 'בחריין',             continent: 'asia',          priority: 3 },
  { id: 512,  iso2: 'OM', nameHe: 'עומאן',              continent: 'asia',          priority: 3 },
  { id: 887,  iso2: 'YE', nameHe: 'תימן',               continent: 'asia',          priority: 3 },
  { id: 860,  iso2: 'UZ', nameHe: 'אוזבקיסטן',          continent: 'asia',          priority: 3 },
  { id: 398,  iso2: 'KZ', nameHe: 'קזחסטן',             continent: 'asia',          priority: 3 },
  { id: 104,  iso2: 'MM', nameHe: 'מיאנמר',             continent: 'asia',          priority: 3 },
  { id: 116,  iso2: 'KH', nameHe: 'קמבודיה',            continent: 'asia',          priority: 3 },
  { id: 418,  iso2: 'LA', nameHe: 'לאוס',               continent: 'asia',          priority: 3 },
  { id: 50,   iso2: 'BD', nameHe: 'בנגלדש',             continent: 'asia',          priority: 3 },
  { id: 144,  iso2: 'LK', nameHe: 'סרי לנקה',           continent: 'asia',          priority: 3 },
  { id: 524,  iso2: 'NP', nameHe: 'נפאל',               continent: 'asia',          priority: 3 },
  { id: 702,  iso2: 'SG', nameHe: 'סינגפור',            continent: 'asia',          priority: 3 },
  { id: 408,  iso2: 'KP', nameHe: 'קוריאה הצפונית',     continent: 'asia',          priority: 3 },
  { id: 496,  iso2: 'MN', nameHe: 'מונגוליה',           continent: 'asia',          priority: 3 },
  { id: 268,  iso2: 'GE', nameHe: 'גאורגיה',            continent: 'asia',          priority: 3 },
  { id: 51,   iso2: 'AM', nameHe: 'ארמניה',             continent: 'asia',          priority: 3 },
  { id: 31,   iso2: 'AZ', nameHe: "אזרבייג'ן",          continent: 'asia',          priority: 3 },
  { id: 642,  iso2: 'RO', nameHe: 'רומניה',             continent: 'europe',        priority: 3 },
  { id: 348,  iso2: 'HU', nameHe: 'הונגריה',            continent: 'europe',        priority: 3 },
  { id: 203,  iso2: 'CZ', nameHe: "צ'כיה",              continent: 'europe',        priority: 3 },
  { id: 703,  iso2: 'SK', nameHe: 'סלובקיה',            continent: 'europe',        priority: 3 },
  { id: 191,  iso2: 'HR', nameHe: 'קרואטיה',            continent: 'europe',        priority: 3 },
  { id: 688,  iso2: 'RS', nameHe: 'סרביה',              continent: 'europe',        priority: 3 },
  { id: 100,  iso2: 'BG', nameHe: 'בולגריה',            continent: 'europe',        priority: 3 },
  { id: 208,  iso2: 'DK', nameHe: 'דנמרק',              continent: 'europe',        priority: 3 },
  { id: 246,  iso2: 'FI', nameHe: 'פינלנד',             continent: 'europe',        priority: 3 },
  { id: 372,  iso2: 'IE', nameHe: 'אירלנד',             continent: 'europe',        priority: 3 },
  { id: 288,  iso2: 'GH', nameHe: 'גנה',                continent: 'africa',        priority: 3 },
  { id: 834,  iso2: 'TZ', nameHe: 'טנזניה',             continent: 'africa',        priority: 3 },
  { id: 434,  iso2: 'LY', nameHe: 'לוב',                continent: 'africa',        priority: 3 },
  { id: 788,  iso2: 'TN', nameHe: 'תוניסיה',            continent: 'africa',        priority: 3 },
  { id: 508,  iso2: 'MZ', nameHe: 'מוזמביק',            continent: 'africa',        priority: 3 },
  { id: 24,   iso2: 'AO', nameHe: 'אנגולה',             continent: 'africa',        priority: 3 },
  { id: 729,  iso2: 'SD', nameHe: 'סודן',               continent: 'africa',        priority: 3 },
  { id: 862,  iso2: 'VE', nameHe: 'ונצואלה',            continent: 'south-america', priority: 3 },
  { id: 218,  iso2: 'EC', nameHe: 'אקוודור',            continent: 'south-america', priority: 3 },
  { id: 68,   iso2: 'BO', nameHe: 'בוליביה',            continent: 'south-america', priority: 3 },
  { id: 600,  iso2: 'PY', nameHe: 'פרגוואי',            continent: 'south-america', priority: 3 },
  { id: 858,  iso2: 'UY', nameHe: 'אורוגוואי',          continent: 'south-america', priority: 3 },
  { id: 320,  iso2: 'GT', nameHe: 'גואטמלה',            continent: 'north-america', priority: 3 },
  { id: 340,  iso2: 'HN', nameHe: 'הונדורס',            continent: 'north-america', priority: 3 },
  { id: 591,  iso2: 'PA', nameHe: 'פנמה',               continent: 'north-america', priority: 3 },
  { id: 188,  iso2: 'CR', nameHe: 'קוסטה ריקה',         continent: 'north-america', priority: 3 },
  { id: 598,  iso2: 'PG', nameHe: 'פפואה גינאה החדשה',  continent: 'oceania',       priority: 3 },
  // ── PRIORITY 2 — פחות מוכרות ──
  { id: 762,  iso2: 'TJ', nameHe: "טג'יקיסטן",          continent: 'asia',          priority: 2 },
  { id: 795,  iso2: 'TM', nameHe: 'טורקמניסטן',         continent: 'asia',          priority: 2 },
  { id: 417,  iso2: 'KG', nameHe: 'קירגיזסטן',          continent: 'asia',          priority: 2 },
  { id: 96,   iso2: 'BN', nameHe: 'ברוניי',             continent: 'asia',          priority: 2 },
  { id: 626,  iso2: 'TL', nameHe: 'טימור-לסטה',         continent: 'asia',          priority: 2 },
  { id: 64,   iso2: 'BT', nameHe: 'בהוטן',              continent: 'asia',          priority: 2 },
  { id: 112,  iso2: 'BY', nameHe: 'בלארוס',             continent: 'europe',        priority: 2 },
  { id: 428,  iso2: 'LV', nameHe: 'לטביה',              continent: 'europe',        priority: 2 },
  { id: 440,  iso2: 'LT', nameHe: 'ליטא',               continent: 'europe',        priority: 2 },
  { id: 233,  iso2: 'EE', nameHe: 'אסטוניה',            continent: 'europe',        priority: 2 },
  { id: 807,  iso2: 'MK', nameHe: 'צפון מקדוניה',       continent: 'europe',        priority: 2 },
  { id: 8,    iso2: 'AL', nameHe: 'אלבניה',             continent: 'europe',        priority: 2 },
  { id: 70,   iso2: 'BA', nameHe: 'בוסניה',             continent: 'europe',        priority: 2 },
  { id: 499,  iso2: 'ME', nameHe: 'מונטנגרו',           continent: 'europe',        priority: 2 },
  { id: 705,  iso2: 'SI', nameHe: 'סלובניה',            continent: 'europe',        priority: 2 },
  { id: 352,  iso2: 'IS', nameHe: 'איסלנד',             continent: 'europe',        priority: 2 },
  { id: 442,  iso2: 'LU', nameHe: 'לוקסמבורג',          continent: 'europe',        priority: 2 },
  { id: 196,  iso2: 'CY', nameHe: 'קפריסין',            continent: 'europe',        priority: 2 },
  { id: 498,  iso2: 'MD', nameHe: 'מולדובה',            continent: 'europe',        priority: 2 },
  { id: 384,  iso2: 'CI', nameHe: 'חוף השנהב',          continent: 'africa',        priority: 2 },
  { id: 120,  iso2: 'CM', nameHe: 'קמרון',              continent: 'africa',        priority: 2 },
  { id: 180,  iso2: 'CD', nameHe: 'קונגו קינשסה',        continent: 'africa',        priority: 2 },
  { id: 466,  iso2: 'ML', nameHe: 'מאלי',               continent: 'africa',        priority: 2 },
  { id: 854,  iso2: 'BF', nameHe: 'בורקינה פאסו',       continent: 'africa',        priority: 2 },
  { id: 686,  iso2: 'SN', nameHe: 'סנגל',               continent: 'africa',        priority: 2 },
  { id: 562,  iso2: 'NE', nameHe: "ניז'ר",              continent: 'africa',        priority: 2 },
  { id: 148,  iso2: 'TD', nameHe: "צ'אד",               continent: 'africa',        priority: 2 },
  { id: 706,  iso2: 'SO', nameHe: 'סומליה',             continent: 'africa',        priority: 2 },
  { id: 450,  iso2: 'MG', nameHe: 'מדגסקר',             continent: 'africa',        priority: 2 },
  { id: 894,  iso2: 'ZM', nameHe: 'זמביה',              continent: 'africa',        priority: 2 },
  { id: 716,  iso2: 'ZW', nameHe: 'זימבבואה',           continent: 'africa',        priority: 2 },
  { id: 800,  iso2: 'UG', nameHe: 'אוגנדה',             continent: 'africa',        priority: 2 },
  { id: 646,  iso2: 'RW', nameHe: 'רואנדה',             continent: 'africa',        priority: 2 },
  { id: 454,  iso2: 'MW', nameHe: 'מלאווי',             continent: 'africa',        priority: 2 },
  { id: 516,  iso2: 'NA', nameHe: 'נמיביה',             continent: 'africa',        priority: 2 },
  { id: 72,   iso2: 'BW', nameHe: 'בוצואנה',            continent: 'africa',        priority: 2 },
  { id: 478,  iso2: 'MR', nameHe: 'מאוריטניה',          continent: 'africa',        priority: 2 },
  { id: 558,  iso2: 'NI', nameHe: 'ניקרגואה',           continent: 'north-america', priority: 2 },
  { id: 222,  iso2: 'SV', nameHe: 'אל סלוודור',         continent: 'north-america', priority: 2 },
  { id: 84,   iso2: 'BZ', nameHe: 'בליז',               continent: 'north-america', priority: 2 },
  { id: 214,  iso2: 'DO', nameHe: 'הרפובליקה הדומיניקנית', continent: 'north-america', priority: 2 },
  { id: 332,  iso2: 'HT', nameHe: 'האיטי',              continent: 'north-america', priority: 2 },
  { id: 388,  iso2: 'JM', nameHe: "ג'מייקה",            continent: 'north-america', priority: 2 },
  { id: 740,  iso2: 'SR', nameHe: 'סורינאם',            continent: 'south-america', priority: 2 },
  { id: 328,  iso2: 'GY', nameHe: 'גיאנה',              continent: 'south-america', priority: 2 },
  { id: 242,  iso2: 'FJ', nameHe: "פיג'י",              continent: 'oceania',       priority: 2 },
  // ── PRIORITY 1 — אזוטריות ──
  { id: 108,  iso2: 'BI', nameHe: 'בורונדי',            continent: 'africa',        priority: 1 },
  { id: 226,  iso2: 'GQ', nameHe: 'גינאה המשוונית',     continent: 'africa',        priority: 1 },
  { id: 266,  iso2: 'GA', nameHe: 'גבון',               continent: 'africa',        priority: 1 },
  { id: 178,  iso2: 'CG', nameHe: 'קונגו ברזוויל',      continent: 'africa',        priority: 1 },
  { id: 426,  iso2: 'LS', nameHe: 'לסוטו',              continent: 'africa',        priority: 1 },
  { id: 232,  iso2: 'ER', nameHe: 'אריתריאה',           continent: 'africa',        priority: 1 },
  { id: 262,  iso2: 'DJ', nameHe: "ג'יבוטי",            continent: 'africa',        priority: 1 },
  { id: 324,  iso2: 'GN', nameHe: 'גינאה',              continent: 'africa',        priority: 1 },
  { id: 624,  iso2: 'GW', nameHe: 'גינאה-ביסאו',        continent: 'africa',        priority: 1 },
  { id: 694,  iso2: 'SL', nameHe: 'סיירה לאונה',        continent: 'africa',        priority: 1 },
  { id: 430,  iso2: 'LR', nameHe: 'ליבריה',             continent: 'africa',        priority: 1 },
  { id: 270,  iso2: 'GM', nameHe: 'גמביה',              continent: 'africa',        priority: 1 },
  { id: 728,  iso2: 'SS', nameHe: 'דרום סודן',          continent: 'africa',        priority: 1 },
  { id: 748,  iso2: 'SZ', nameHe: 'אסוואטיני',          continent: 'africa',        priority: 1 },
  { id: 140,  iso2: 'CF', nameHe: 'רפובליקה אפריקאית המרכזית', continent: 'africa', priority: 1 },
  { id: 768,  iso2: 'TG', nameHe: 'טוגו',               continent: 'africa',        priority: 1 },
  { id: 204,  iso2: 'BJ', nameHe: 'בנין',               continent: 'africa',        priority: 1 },
  { id: 674,  iso2: 'SM', nameHe: 'סן מרינו',           continent: 'europe',        priority: 1 },
  { id: 20,   iso2: 'AD', nameHe: 'אנדורה',             continent: 'europe',        priority: 1 },
  { id: 585,  iso2: 'PW', nameHe: 'פלאו',               continent: 'oceania',       priority: 1 },
  { id: 583,  iso2: 'FM', nameHe: 'מיקרונזיה',          continent: 'oceania',       priority: 1 },
  { id: 520,  iso2: 'NR', nameHe: 'נאורו',              continent: 'oceania',       priority: 1 },
  { id: 882,  iso2: 'WS', nameHe: 'סמואה',              continent: 'oceania',       priority: 1 },
  { id: 776,  iso2: 'TO', nameHe: 'טונגה',              continent: 'oceania',       priority: 1 },
  { id: 548,  iso2: 'VU', nameHe: 'ונואטו',             continent: 'oceania',       priority: 1 },
  { id: 90,   iso2: 'SB', nameHe: 'איי שלמה',           continent: 'oceania',       priority: 1 },
];

// אבני דרך לפרסים
const PRIZES = [
  { points: 100,  achievement: 'נוסע סקרן',    prize: 'ממתק',                  emoji: '🍬' },
  { points: 250,  achievement: 'מגלה דרכים',   prize: 'קולה',                  emoji: '🥤' },
  { points: 400,  achievement: 'אמן המפות',    prize: 'מקדונלדס',              emoji: '🍔' },
  { points: 700,  achievement: 'שגריר יבשות',  prize: 'חבילת סוכריות גומי',   emoji: '🐻' },
  { points: 1000, achievement: 'גיבור העולם',  prize: 'מה שתבחרו עד 100 ש"ח', emoji: '🎁' },
];

// רמות קושי
const LEVELS = {
  easy:   { nameHe: 'קלה',     minPriority: 5, maxPriority: 5, countLabel: '7 יבשות',    points: 10 },
  medium: { nameHe: 'בינונית', minPriority: 4, maxPriority: 5, countLabel: '~50 מדינות', points: 15 },
  hard:   { nameHe: 'קשה',     minPriority: 2, maxPriority: 5, countLabel: '~130 מדינות', points: 20 },
  master: { nameHe: 'מאסטר',   minPriority: 1, maxPriority: 5, countLabel: '195 מדינות', points: 25 },
};

// עזרים
function getCountryById(id) {
  const numId = Number(id);
  return COUNTRIES.find(c => c.id === numId);
}

function getCountriesByLevel(level, continent = 'all') {
  const cfg = LEVELS[level];
  return COUNTRIES.filter(c => {
    const inLevel = c.priority >= cfg.minPriority && c.priority <= cfg.maxPriority;
    const inContinent = continent === 'all' || c.continent === continent;
    return inLevel && inContinent;
  });
}

function getWrongChoices(correct, pool, count = 3) {
  // prefer same continent
  let sameContinent = pool.filter(c => c.id !== correct.id && c.continent === correct.continent);
  let diff = pool.filter(c => c.id !== correct.id && c.continent !== correct.continent);
  // shuffle
  sameContinent = shuffle(sameContinent);
  diff = shuffle(diff);
  const candidates = [...sameContinent, ...diff];
  return candidates.slice(0, count);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
