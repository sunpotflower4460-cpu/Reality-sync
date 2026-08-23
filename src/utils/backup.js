import { BACKUP_FORMAT, BACKUP_VERSION } from '../constants.js';
import { normalizeReminderPreferences } from './reminder.js';
import { normalizeScheduleStore } from './storage.js';
import { normalizeTemplates } from './template.js';

function countSchedules(store) {
  return Object.values(store.days).reduce((sum, schedules) => sum + schedules.length, 0);
}

export function createBackupPayload({ store, templates, reminderPreferences, exportedAt = new Date().toISOString() }) {
  const normalizedStore = normalizeScheduleStore(store);
  const normalizedTemplates = normalizeTemplates(templates);
  const normalizedReminders = normalizeReminderPreferences(reminderPreferences);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    scheduleStore: normalizedStore,
    templates: normalizedTemplates,
    reminderPreferences: normalizedReminders,
  };
}

export function serializeBackup(input) {
  return `${JSON.stringify(createBackupPayload(input), null, 2)}\n`;
}

export function parseBackup(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'JSONとして読み込めませんでした。' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'RealitySyncのバックアップ形式ではありません。' };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'RealitySyncのバックアップ識別子がありません。' };
  }
  if (parsed.version !== BACKUP_VERSION) {
    return { ok: false, error: 'このバックアップのバージョンにはまだ対応していません。' };
  }
  if (!parsed.scheduleStore || parsed.scheduleStore.version === undefined) {
    return { ok: false, error: '予定・実績データが見つかりません。' };
  }

  const scheduleStore = normalizeScheduleStore(parsed.scheduleStore);
  if (scheduleStore.version !== parsed.scheduleStore.version) {
    return { ok: false, error: '予定・実績データの保存バージョンに対応していません。' };
  }

  const templates = normalizeTemplates(parsed.templates);
  const reminderPreferences = normalizeReminderPreferences(parsed.reminderPreferences);
  const dayCount = Object.keys(scheduleStore.days).length;
  const scheduleCount = countSchedules(scheduleStore);

  return {
    ok: true,
    data: { scheduleStore, templates, reminderPreferences },
    summary: {
      dayCount,
      scheduleCount,
      templateCount: templates.length,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null,
    },
  };
}
