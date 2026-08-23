export const TABS = Object.freeze({
  PLAN: 'plan',
  TRACK: 'track',
  ANALYTICS: 'analytics',
});

export const STATUS = Object.freeze({
  PENDING: 'pending',
  AS_PLANNED: 'as_planned',
  CHANGED: 'changed',
  SKIPPED: 'skipped',
});

export const MOOD = Object.freeze({
  GOOD: 'good',
  NORMAL: 'normal',
  BAD: 'bad',
});

export const CATEGORIES = Object.freeze([
  '仕事',
  '運動',
  '休憩',
  '自己啓発',
  '趣味',
  '家事',
  'その他',
]);

export const STORAGE_VERSION = 2;
export const STORAGE_KEY = 'reality-sync:days:v2';
export const LEGACY_STORAGE_KEY = 'reality-sync:schedules:v1';
export const TEMPLATE_STORAGE_KEY = 'reality-sync:templates:v1';
