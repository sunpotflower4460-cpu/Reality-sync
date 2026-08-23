export const STORAGE_KEY = 'realitysync:schedules:v1';

export const INITIAL_SCHEDULES = [
  { id: 1, time: '07:00', timeValue: 7, title: '朝のランニング', category: '運動', duration: 30, plannedStress: 40, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
  { id: 2, time: '09:00', timeValue: 9, title: '集中作業（企画書作成）', category: '仕事', duration: 120, plannedStress: 70, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
  { id: 3, time: '12:00', timeValue: 12, title: 'ランチ＆読書', category: '休憩', duration: 60, plannedStress: 10, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
  { id: 4, time: '14:00', timeValue: 14, title: 'ブレインストーミング', category: '仕事', duration: 90, plannedStress: 85, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
  { id: 5, time: '18:00', timeValue: 18, title: '夕食・リラックス', category: '休憩', duration: 60, plannedStress: 20, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
  { id: 6, time: '21:00', timeValue: 21, title: '英語学習', category: '自己啓発', duration: 60, plannedStress: 60, status: 'pending', actualTitle: '', actualCategory: null, mood: null, actualStress: null },
];

const VALID_RECORD_MODES = new Set(['as_planned', 'changed', 'skipped']);
const VALID_MOODS = new Set(['good', 'normal', 'bad']);

const clampStress = (value) => Math.min(100, Math.max(0, Number(value)));

export function applyRecord(schedule, record) {
  if (!schedule) {
    return { ok: false, error: '記録対象の予定が見つかりません。' };
  }

  const recordMode = VALID_RECORD_MODES.has(record.recordMode)
    ? record.recordMode
    : 'as_planned';
  const mood = VALID_MOODS.has(record.mood) ? record.mood : 'normal';
  const actualStress = clampStress(record.actualStress);
  const actualTitle = String(record.actualTitle ?? '').trim();
  const actualCategory = String(record.actualCategory ?? 'その他').trim() || 'その他';

  if (recordMode === 'changed' && !actualTitle) {
    return { ok: false, error: '予定を変更した場合は、代わりに行ったことを入力してください。' };
  }

  return {
    ok: true,
    schedule: {
      ...schedule,
      status: recordMode,
      actualTitle:
        recordMode === 'changed'
          ? actualTitle
          : recordMode === 'as_planned'
            ? schedule.title
            : 'スキップ',
      actualCategory: recordMode === 'changed' ? actualCategory : null,
      mood,
      actualStress,
    },
  };
}

export function calculateStats(schedules) {
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const total = safeSchedules.length;
  const completed = safeSchedules.filter((schedule) => schedule.status === 'as_planned').length;
  const changed = safeSchedules.filter((schedule) => schedule.status === 'changed').length;
  const skipped = safeSchedules.filter((schedule) => schedule.status === 'skipped').length;
  const pending = safeSchedules.filter((schedule) => schedule.status === 'pending').length;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const categories = {};

  const ensureCategory = (category) => {
    if (!categories[category]) categories[category] = { ideal: 0, actual: 0 };
  };

  safeSchedules.forEach((schedule) => {
    ensureCategory(schedule.category);
    categories[schedule.category].ideal += schedule.duration;

    if (schedule.status === 'as_planned') {
      categories[schedule.category].actual += schedule.duration;
      return;
    }

    if (schedule.status === 'changed') {
      const actualCategory = schedule.actualCategory || 'その他';
      ensureCategory(actualCategory);
      categories[actualCategory].actual += schedule.duration;
      return;
    }

    if (schedule.status === 'skipped') {
      ensureCategory('休息・スキップ');
      categories['休息・スキップ'].actual += schedule.duration;
    }
  });

  return { total, completed, changed, skipped, pending, completionRate, categories };
}

function isScheduleArray(value) {
  return Array.isArray(value) && value.every((schedule) => (
    schedule &&
    typeof schedule.id === 'number' &&
    typeof schedule.title === 'string' &&
    typeof schedule.category === 'string' &&
    typeof schedule.duration === 'number' &&
    typeof schedule.plannedStress === 'number'
  ));
}

export function loadSchedules(storage = globalThis?.localStorage) {
  if (!storage) return INITIAL_SCHEDULES;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_SCHEDULES;
    const parsed = JSON.parse(raw);
    return isScheduleArray(parsed) ? parsed : INITIAL_SCHEDULES;
  } catch {
    return INITIAL_SCHEDULES;
  }
}

export function saveSchedules(schedules, storage = globalThis?.localStorage) {
  if (!storage) return false;

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(schedules));
    return true;
  } catch {
    return false;
  }
}
