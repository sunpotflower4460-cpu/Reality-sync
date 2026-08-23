import { STATUS } from '../constants.js';

export const INITIAL_SCHEDULES = Object.freeze([
  { id: 1, time: '07:00', title: '朝のランニング', category: '運動', duration: 30, plannedStress: 40 },
  { id: 2, time: '09:00', title: '集中作業（企画書作成）', category: '仕事', duration: 120, plannedStress: 70 },
  { id: 3, time: '12:00', title: 'ランチ＆読書', category: '休憩', duration: 60, plannedStress: 10 },
  { id: 4, time: '14:00', title: 'ブレインストーミング', category: '仕事', duration: 90, plannedStress: 85 },
  { id: 5, time: '18:00', title: '夕食・リラックス', category: '休憩', duration: 60, plannedStress: 20 },
  { id: 6, time: '21:00', title: '英語学習', category: '自己啓発', duration: 60, plannedStress: 60 },
].map((schedule) => ({
  ...schedule,
  status: STATUS.PENDING,
  actualTitle: '',
  actualCategory: null,
  actualDuration: null,
  mood: null,
  actualStress: null,
})));
