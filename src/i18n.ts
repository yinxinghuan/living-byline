export type Locale = 'zh' | 'en'

export function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale')
  if (override === 'zh' || override === 'en') return override
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

const copy = {
  zh: {
    title: '活字世界',
    subtitle: 'LIVING BYLINE',
    level: '投影室',
    touch: '沿线划过套准点',
    trace: '署名套准路径',
    node: '套准点',
    drag: '依次划过 3 个亮点 · 完成后拖动观看',
    view: '套准完成 · 拖动观看',
    next: '进入下一投影室',
    replay: '再印一次',
    complete: '署名已经成形',
    printed: '由 ALTERU 印制',
    errorTitle: '投影没有对准',
    errorBody: '你的署名仍在这里。请重试加载 3D 投影室。',
    retry: '重试',
    levels: ['门廊', '折页剧场', '轨道印刷机'],
    stamps: ['门', '折', '印'],
  },
  en: {
    title: 'Living Byline',
    subtitle: 'LIVING BYLINE',
    level: 'CHAMBER',
    touch: 'Trace through the register points',
    trace: 'Byline registration path',
    node: 'Register point',
    drag: 'Trace 3 bright points · drag to view when complete',
    view: 'Registered · drag to view',
    next: 'Enter next chamber',
    replay: 'Print again',
    complete: 'Your byline is alive',
    printed: 'PRINTED WITH ALTERU',
    errorTitle: 'The projection slipped',
    errorBody: 'Your byline is still here. Retry the 3D projection room.',
    retry: 'Retry',
    levels: ['Threshold', 'Fold Theatre', 'Orbit Press'],
    stamps: ['TH', 'FD', 'OP'],
  },
} as const

export function t(locale: Locale) {
  return copy[locale]
}
