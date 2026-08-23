import { BACKUP_FORMAT, BACKUP_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { normalizeExperiments } from './experiment.js';
import { normalizeReminderPreferences } from './reminder.js';
import { normalizeScheduleStore } from './storage.js';
import { normalizeTemplates } from './template.js';

function countSchedules(store) { return Object.values(store.days).reduce((sum, schedules) => sum + schedules.length, 0); }
function rawScheduleCount(days) { return Object.values(days).reduce((sum, schedules) => sum + schedules.length, 0); }
function experimentTrialCount(experiments) { return experiments.reduce((sum, experiment) => sum + (Array.isArray(experiment.trials) ? experiment.trials.length : 0), 0); }

export function createBackupPayload({ store, templates, experiments = [], reminderPreferences, exportedAt = new Date().toISOString() }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    scheduleStore: normalizeScheduleStore(store),
    templates: normalizeTemplates(templates),
    experiments: normalizeExperiments(experiments),
    reminderPreferences: normalizeReminderPreferences(reminderPreferences),
  };
}

export function serializeBackup(input) { return `${JSON.stringify(createBackupPayload(input), null, 2)}\n`; }

export function parseBackup(raw) {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, error: 'JSONとして読み込めませんでした。' }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, error: 'RealitySyncのバックアップ形式ではありません。' };
  if (parsed.format !== BACKUP_FORMAT) return { ok: false, error: 'RealitySyncのバックアップ識別子がありません。' };
  if (parsed.version !== BACKUP_VERSION) return { ok: false, error: 'このバックアップのバージョンにはまだ対応していません。' };
  if (!parsed.scheduleStore || typeof parsed.scheduleStore !== 'object' || Array.isArray(parsed.scheduleStore)) return { ok: false, error: '予定・実績データが見つかりません。' };
  if (!parsed.scheduleStore.days || typeof parsed.scheduleStore.days !== 'object' || Array.isArray(parsed.scheduleStore.days)) return { ok: false, error: '予定・実績データの構造が壊れています。' };
  if (!Array.isArray(parsed.templates)) return { ok: false, error: 'テンプレートデータの構造が壊れています。' };
  if (parsed.experiments !== undefined && !Array.isArray(parsed.experiments)) return { ok: false, error: '実験履歴の構造が壊れています。' };
  if (!parsed.reminderPreferences || typeof parsed.reminderPreferences !== 'object' || Array.isArray(parsed.reminderPreferences)) return { ok: false, error: 'リマインダー設定の構造が壊れています。' };

  for (const [dateKey, schedules] of Object.entries(parsed.scheduleStore.days)) {
    if (!isValidDateKey(dateKey) || !Array.isArray(schedules)) return { ok: false, error: '予定・実績データに不正な日付または日別データがあります。' };
  }

  const scheduleStore = normalizeScheduleStore(parsed.scheduleStore);
  if (scheduleStore.version !== parsed.scheduleStore.version) return { ok: false, error: '予定・実績データの保存バージョンに対応していません。' };
  if (countSchedules(scheduleStore) !== rawScheduleCount(parsed.scheduleStore.days)) return { ok: false, error: '予定・実績データに復元できない項目があります。' };

  const templates = normalizeTemplates(parsed.templates);
  if (templates.length !== parsed.templates.length) return { ok: false, error: 'テンプレートデータに復元できない項目があります。' };
  const rawExperiments = parsed.experiments ?? [];
  const experiments = normalizeExperiments(rawExperiments);
  if (experiments.length !== rawExperiments.length || experimentTrialCount(experiments) !== experimentTrialCount(rawExperiments)) {
    return { ok: false, error: '実験履歴に復元できない項目があります。' };
  }
  const reminderPreferences = normalizeReminderPreferences(parsed.reminderPreferences);

  return {
    ok: true,
    data: { scheduleStore, templates, experiments, reminderPreferences },
    summary: {
      dayCount: Object.keys(scheduleStore.days).length,
      scheduleCount: countSchedules(scheduleStore),
      templateCount: templates.length,
      experimentCount: experiments.length,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    },
  };
}
