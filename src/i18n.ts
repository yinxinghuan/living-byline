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
    touch: '旋转场景，让文字重合',
    drag: '单指拖动 · 寻找唯一正确视角',
    near: '接近了 · 微调视角',
    hold: '保持这个视角',
    view: '视角已锁定 · 署名完整',
    next: '进入下一投影室',
    replay: '再印一次',
    complete: '署名已经成形',
    printed: '由 ALTERU 印制',
    errorTitle: '投影没有对准',
    errorBody: '你的署名仍在这里。请重试加载 3D 投影室。',
    retry: '重试',
    levels: ['拱门庭院', '折面剧场', '轨道雕塑'],
    stamps: ['门', '折', '印'],
  },
  en: {
    title: 'Living Byline',
    subtitle: 'LIVING BYLINE',
    level: 'CHAMBER',
    touch: 'Rotate until the type locks',
    drag: 'Drag with one finger · find the true viewpoint',
    near: 'Almost there · refine the angle',
    hold: 'Hold this viewpoint',
    view: 'View locked · byline resolved',
    next: 'Enter next chamber',
    replay: 'Print again',
    complete: 'Your byline is alive',
    printed: 'PRINTED WITH ALTERU',
    errorTitle: 'The projection slipped',
    errorBody: 'Your byline is still here. Retry the 3D projection room.',
    retry: 'Retry',
    levels: ['Arch Garden', 'Fold Theatre', 'Orbit Sculpture'],
    stamps: ['TH', 'FD', 'OP'],
  },
} as const

export function t(locale: Locale) {
  return copy[locale]
}
