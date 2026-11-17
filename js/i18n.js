const DICT = {
  ru: {
    title: 'Тени', tag: 'Поверни предмет, пока тень не совпадёт.',
    play: 'Играть', levels: 'Уровни', sound: 'Звук', music: 'Музыка', on: 'вкл', off: 'выкл',
    level: 'Уровень {n} из {m}', tilt: 'Наклон', hint: 'Подсказка',
    matched: 'Тень совпала', time: 'Время: {s} с', next: 'Дальше', toLevels: 'К списку уровней', retry: 'Ещё раз',
    start: 'Тяни пальцем по экрану, чтобы вращать',
    noMeter: 'Дальше без процентов: подгоняй на глаз',
    newTilt: 'Новое: ползунок наклона внизу',
    newRoom: 'Новая комната: {name}',
    goal: '{name}: подгони тень под контур',
    noReward: 'Награда не получена',
    hintOn: 'Пунктир на столе показывает нужное положение',
    'room.0': 'Чердак', 'room.1': 'Детская', 'room.2': 'Театр', 'room.3': 'Мастерская',
    'obj.angle': 'Уголок', 'obj.tee': 'Тавр', 'obj.stairs': 'Ступени', 'obj.tree': 'Дерево', 'obj.house': 'Домик',
    'obj.chair': 'Стул', 'obj.mushroom': 'Гриб', 'obj.arch': 'Арка', 'obj.table': 'Стол', 'obj.rocket': 'Ракета',
    'obj.lamp': 'Лампа', 'obj.cross': 'Крест', 'obj.frame': 'Рамка', 'obj.ladder': 'Лестница', 'obj.windmill': 'Мельница',
    'obj.bench': 'Скамейка', 'obj.castle': 'Замок', 'obj.cactus': 'Кактус', 'obj.letterE': 'Буква Е',
  },
  en: {
    title: 'Shadows', tag: 'Turn the object until its shadow fits.',
    play: 'Play', levels: 'Levels', sound: 'Sound', music: 'Music', on: 'on', off: 'off',
    level: 'Level {n} of {m}', tilt: 'Tilt', hint: 'Hint',
    matched: 'Shadow matched', time: 'Time: {s} s', next: 'Next', toLevels: 'Back to levels', retry: 'Retry',
    start: 'Drag across the screen to rotate',
    noMeter: 'No more percentages: match it by eye',
    newTilt: 'New: tilt slider below',
    newRoom: 'New room: {name}',
    goal: '{name}: fit the shadow to the outline',
    noReward: 'Reward not received',
    hintOn: 'The dashed outline on the table shows the right position',
    'room.0': 'Attic', 'room.1': 'Nursery', 'room.2': 'Theatre', 'room.3': 'Workshop',
    'obj.angle': 'Corner', 'obj.tee': 'T-beam', 'obj.stairs': 'Steps', 'obj.tree': 'Tree', 'obj.house': 'House',
    'obj.chair': 'Chair', 'obj.mushroom': 'Mushroom', 'obj.arch': 'Arch', 'obj.table': 'Table', 'obj.rocket': 'Rocket',
    'obj.lamp': 'Lamp', 'obj.cross': 'Cross', 'obj.frame': 'Frame', 'obj.ladder': 'Ladder', 'obj.windmill': 'Windmill',
    'obj.bench': 'Bench', 'obj.castle': 'Castle', 'obj.cactus': 'Cactus', 'obj.letterE': 'Letter E',
  },
};

const RU_LIKE = ['ru', 'be', 'kk', 'uk', 'uz', 'ky', 'tg', 'hy', 'az'];
let lang = 'ru';

export function setLang(code) {
  const c = String(code || 'ru').toLowerCase().slice(0, 2);
  lang = RU_LIKE.includes(c) ? 'ru' : 'en';
  document.documentElement.lang = lang;
  return lang;
}
export function getLang() { return lang; }

export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
  if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  return s;
}

export function applyStatic(root) {
  (root || document).querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.title = t('title');
}
