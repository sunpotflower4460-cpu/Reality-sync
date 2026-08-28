import { BACKUP_FORMAT, BACKUP_VERSION, EXPERIMENT_STORAGE_VERSION } from '../constants.js';
import { isValidDateKey } from './date.js';
import { normalizeExperiments } from './experiment.js';
import { parseStoredExperimentsForPersistence } from './experimentStorage.js';
import { normalizeReminderPreferences, parseStoredReminderPreferencesResult } from './reminder.js';
import { normalizeScheduleStore, parseStoredScheduleStoreResult } from './storage.js';
import { normalizeTemplates, parseStoredTemplatesResult } from './template.js';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const BACKUP_FIELDS = new Set([
  'format',
  'version',
  'exportedAt',
  'scheduleStore',
  'templates',
  'experiments',
  'reminderPreferences',
]);

function hasOnlyKeys(value, allowed) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.has(key));
}

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
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) {
    return { ok: false, error: 'バックアップファイルが大きすぎます。10MB以下のファイルを選択してください。' };
  }

  let parsed;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, error: 'JSONとして読み込めませんでした。' }; }
  if (!hasOnlyKeys(parsed, BACKUP_FIELDS)) return { ok: false, error: 'RealitySyncのバックアップ形式ではありません。' };
  if (parsed.format !== BACKUP_FORMAT) return { ok: false, error: 'RealitySyncのバックアップ識別子がありません。' };
  if (parsed.version !== BACKUP_VERSION) return { ok: false, error: 'このバックアップのバージョンにはまだ対応していません。' };
  if (parsed.exportedAt !== undefined && typeof parsed.exportedAt !== 'string') return { ok: false, error: 'バックアップの書き出し日時が壊れています。' };
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
  // A backup is itself a current, versioned format. Do not route its experiment
  // rows through the legacy bare-array compatibility path, which intentionally
  // canonicalizes old form-shaped numeric strings during one-time migration.
  const experimentResult = parseStoredExperimentsForPersistence(JSON.stringify({
    version: EXPERIMENT_STORAGE_VERSION,
    experiments: rawExperiments,
  }));
  if (!experimentResult.ok || !experimentLineageValid(experimentResult.experiments)) {
    return { ok: false, error: '実験履歴に復元できない項目があります。' };
  }
  const experiments = experimentResult.experiments;

  const reminderResult = parseStoredReminderPreferencesResult(JSON.stringify(parsed.reminderPreferences));
  if (!reminderResult.ok) {
    return { ok: false, error: 'リマインダー設定に復元できない項目があります。' };
  }
  const reminderPreferences = reminderResult.preferences;

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
