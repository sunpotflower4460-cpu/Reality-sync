import { BACKUP_FORMAT, BACKUP_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { normalizeExperiments } from './experiment.js';
import { parseStoredExperimentsForPersistence } from './experimentStorage.js';
import { normalizeReminderPreferences, REMINDER_DELAY_OPTIONS } from './reminder.js';
import { normalizeScheduleStore, parseStoredScheduleStoreResult } from './storage.js';
import { normalizeTemplates, parseStoredTemplatesResult } from './template.js';

function countSchedules(store) { return Object.values(store.days).reduce((sum, schedules) => sum + schedules.length, 0); }

function experimentLineageValid(experiments) {
  const byId = new Map(experiments.map((experiment) => [experiment.id, experiment]));
  for (const experiment of experiments) {
    if (!experiment.parentExperimentId) continue;
    const parent = byId.get(experiment.parentExperimentId);
    if (!parent) return false;
    if ((parent.learningRootId || parent.id) !== (experiment.learningRootId || experiment.id)) return false;
    if ((experiment.learningVersion || 1) <= (parent.learningVersion || 1)) return false;
  }
  return true;
}

function reminderPreferencesPreserved(raw, normalized) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  if (raw.enabled !== undefined && typeof raw.enabled !== 'boolean') return false;
  if (raw.browserNotifications !== undefined && typeof raw.browserNotifications !== 'boolean') return false;
  if (raw.delayMinutes !== undefined) {
    if (raw.delayMinutes === null || (typeof raw.delayMinutes === 'string' && raw.delayMinutes.trim() === '')) return false;
    const delay = Number(raw.delayMinutes);
    if (!REMINDER_DELAY_OPTIONS.includes(delay) || normalized.delayMinutes !== delay) return false;
  }
  if (typeof raw.enabled === 'boolean' && normalized.enabled !== raw.enabled) return false;
  if (typeof raw.browserNotifications === 'boolean' && normalized.browserNotifications !== raw.browserNotifications) return false;
  return true;
}

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

  const scheduleResult = parseStoredScheduleStoreResult(JSON.stringify(parsed.scheduleStore));
  if (!scheduleResult.ok) {
    if (scheduleResult.unsupportedVersion !== null) return { ok: false, error: '予定・実績データの保存バージョンに対応していません。' };
    return { ok: false, error: '予定・実績データに復元できない項目があります。' };
  }
  const scheduleStore = scheduleResult.store;

  const templateResult = parseStoredTemplatesResult(JSON.stringify(parsed.templates));
  if (!templateResult.ok) return { ok: false, error: 'テンプレートデータに復元できない項目があります。' };
  const templates = templateResult.templates;

  const rawExperiments = parsed.experiments ?? [];
  const experimentResult = parseStoredExperimentsForPersistence(JSON.stringify(rawExperiments));
  if (!experimentResult.ok || !experimentLineageValid(experimentResult.experiments)) {
    return { ok: false, error: '実験履歴に復元できない項目があります。' };
  }
  const experiments = experimentResult.experiments;

  const reminderPreferences = normalizeReminderPreferences(parsed.reminderPreferences);
  if (!reminderPreferencesPreserved(parsed.reminderPreferences, reminderPreferences)) {
    return { ok: false, error: 'リマインダー設定に復元できない項目があります。' };
  }

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
