import type {
  Item, Offer, Review, Save, OsProject, Quest, QuestKind, LogEntry, LogKind, Stats, Profile, Settings, HistoryPoint,
} from './types';

export const KEY = 'perekup-react-final-v7';
const LEGACY_KEYS = ['perekup-react-final-v6'];

export const PC_PARTS = [
  ['cpu', 'Процессор', 12500, 'CPU'],
  ['gpu', 'Видеокарта', 23500, 'GPU'],
  ['ram', 'ОЗУ 16GB', 4200, 'RAM'],
  ['board', 'Материнская плата', 8500, 'BOARD'],
  ['ssd', 'SSD 500GB', 3900, 'SSD'],
  ['psu', 'Блок питания 650W', 5200, 'PSU'],
  ['case', 'Корпус Airflow', 4800, 'CASE'],
  ['cooler', 'Кулер Tower', 3500, 'COOLER'],
] as const;

export const SSD_CATALOG = [
  {name: 'Kingston NV2 500GB', brand: 'Kingston', speed: 3500, price: 3900, reliability: 72},
  {name: 'WD Blue SN580 1TB', brand: 'Western Digital', speed: 4150, price: 6200, reliability: 84},
  {name: 'Samsung 990 PRO 1TB', brand: 'Samsung', speed: 7450, price: 12500, reliability: 96},
  {name: 'Crucial P3 Plus 1TB', brand: 'Crucial', speed: 5000, price: 5600, reliability: 79},
  {name: 'NoName TurboSSD 1TB', brand: 'NoName', speed: 2800, price: 2600, reliability: 48},
];

export const CPU_CATALOG = [
  ['Intel Core i3-6100', 4500], ['Intel Core i5-9400F', 8500], ['AMD Ryzen 5 3600', 9000],
  ['AMD Ryzen 5 5600', 12500], ['Intel Core i5-12400F', 17500], ['AMD Ryzen 7 7800X3D', 36500],
  ['Intel Core i9-14900K', 48000],
] as const;

export const GPU_CATALOG = [
  ['GTX 1060 6GB', 9000], ['GTX 1660 Super', 15000], ['RTX 2060', 17000], ['RTX 3060 12GB', 23500],
  ['RTX 4060', 31000], ['RTX 4070 Super', 58000], ['RTX 4080 Super', 98000],
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  'Телефоны': '📱', 'Игры': '🎮', 'Ноутбуки': '💻', 'Аудио': '🎧', 'Техника': '🔌',
  'Носимые': '⌚', 'Комплектующие': '🧩', 'Процессоры': '🧠', 'Видеокарты': '🎛️', 'ПК': '🖥️',
};

export const ACHIEVEMENTS: {id: string; title: string; desc: string; icon: string}[] = [
  {id: 'first_sale', title: 'Первая сделка', desc: 'Продать первый товар', icon: '🤝'},
  {id: 'ten_sales', title: 'Оптовик', desc: 'Продать 10 товаров', icon: '📈'},
  {id: 'profit_50k', title: 'Плюс 50 000 ₽', desc: 'Заработать 50 000 ₽ за день', icon: '💰'},
  {id: 'capital_500k', title: 'Полмиллиона', desc: 'Довести капитал до 500 000 ₽', icon: '🏦'},
  {id: 'goal', title: 'Цель достигнута', desc: 'Дойти до цели капитала', icon: '🎯'},
  {id: 'repairer', title: 'Мастер на все руки', desc: 'Отремонтировать 5 устройств', icon: '🔧'},
  {id: 'honest', title: 'Честный продавец', desc: 'Репутация 4.8 и выше', icon: '⭐'},
  {id: 'black_deal', title: 'Ночной гость', desc: 'Сделка на чёрном рынке', icon: '🌙'},
  {id: 'pc_builder', title: 'Сборщик', desc: 'Собрать и продать ПК', icon: '🖥️'},
  {id: 'os_dev', title: 'Разработчик ОС', desc: 'Создать свою операционную систему', icon: '💻'},
  {id: 'logist', title: 'Логист', desc: 'Отправить 3 посылки', icon: '📦'},
  {id: 'banker', title: 'Вкладчик', desc: 'Держать 100 000 ₽ на вкладе', icon: '🏧'},
];

export const LEVEL_TITLES = [
  'Новичок', 'Лоточник', 'Барыга', 'Перекуп', 'Коммерсант',
  'Оптовик', 'Магнат', 'Акула рынка', 'Легенда рынка',
];

/** Порог XP для уровня n (1-based): 1 -> 0, 2 -> 100, 3 -> 300 ... */
export function xpForLevel(level: number): number {
  return Math.round(50 * (level - 1) * level);
}

export function levelInfo(xp: number) {
  let level = 1;
  while (level < 99 && xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - cur);
  return {
    level,
    title: LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 2))],
    into: xp - cur,
    span,
    next,
    pct: Math.min(100, Math.round(((xp - cur) / span) * 100)),
  };
}

let seed = 1000;
const id = () => seed++;
export function money(n: number) {
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}
export function shortMoney(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + ' млн ₽';
  if (abs >= 10_000) return Math.round(n / 1000) + ' тыс ₽';
  return money(n);
}

const names = ['iPhone 13', 'iPhone 12', 'Samsung Galaxy S23', 'PS5', 'MacBook Air', 'AirPods Pro', 'Dyson', 'Nintendo Switch', 'Apple Watch'];
const cats = ['Телефоны', 'Телефоны', 'Телефоны', 'Игры', 'Ноутбуки', 'Аудио', 'Техника', 'Игры', 'Носимые'];

export function makeItem(i = 0): Item {
  const base = [32000, 25000, 48000, 42000, 65000, 18000, 35000, 30000, 22000][i % 9];
  return {
    id: id(), name: names[i % 9], category: cats[i % 9], base,
    condition: 'used', defect: Math.random() < 0.28,
    purchasePrice: Math.round(base * 0.75), reliability: 75,
  };
}

export function defaultQuests(day: number): Quest[] {
  const pool: Omit<Quest, 'id' | 'progress' | 'day' | 'claimed'>[] = [
    {kind: 'buy', title: 'Закупка', desc: 'Купить 2 товара', target: 2, reward: 1500, xp: 25},
    {kind: 'sell', title: 'Реализация', desc: 'Продать 2 товара', target: 2, reward: 2200, xp: 35},
    {kind: 'profit', title: 'Дневная касса', desc: 'Заработать 8 000 ₽ за день', target: 8000, reward: 3000, xp: 45},
    {kind: 'review', title: 'Хорошая репутация', desc: 'Получить 1 отзыв', target: 1, reward: 900, xp: 15},
    {kind: 'repair', title: 'Мастерская', desc: 'Отремонтировать 1 устройство', target: 1, reward: 1200, xp: 20},
  ];
  return pool.map((q, i) => ({...q, id: `d${day}-${i}`, progress: 0, day, claimed: false}));
}

export function initialSave(): Save {
  // Стартовые товары сразу выставляются на Market: без listedOn они не попадают
  // ни в один список площадки и их невозможно продать.
  const startItems = [makeItem(0), makeItem(3)].map(i => ({...i, listedOn: 'market' as const, boughtDay: 1}));
  return {
    cash: 50000, day: 1, hour: 12, goal: 100000, mode: '30d',
    inventory: startItems,
    reviews: [], offers: [], shipments: [], pcParts: {}, wanted: 0, promoUsed: [],
    reputation: 5, dailyProfit: 0, bizIncome: 0, deposit: 0, loan: 0, returns: 0, osProjects: [],
    settings: {autosave: true, theme: 'auto', reduceMotion: false, compact: false},
    xp: 0, achievements: [], quests: defaultQuests(1), log: [], history: [{day: 1, cash: 50000, profit: 0}],
    stats: emptyStats(),
    profile: {nick: 'Перекуп', bio: ''},
  };
}

export function emptyStats(): Stats {
  return {bought: 0, sold: 0, repaired: 0, blackDeals: 0, pcBuilt: 0, osCreated: 0, shipped: 0, bestSale: 0, promoUsed: 0};
}

export function normalizeSave(raw: Partial<Save>): Save {
  const base = initialSave();
  const s: Save = {...base, ...raw};
  s.inventory = (raw.inventory || base.inventory).map(i => ({
    ...i,
    purchasePrice: i.purchasePrice ?? Math.round((i.listPrice ?? i.base) * 0.75),
    reliability: i.reliability ?? 75,
  }));
  s.reviews = raw.reviews || [];
  s.offers = raw.offers || [];
  s.shipments = raw.shipments || [];
  s.pcParts = raw.pcParts || {};
  s.promoUsed = raw.promoUsed || [];
  s.osProjects = (raw.osProjects || []).map(o => ({...o, users: o.users ?? 0}));
  s.settings = {...base.settings, ...(raw.settings || {})};
  s.achievements = raw.achievements || [];
  s.quests = raw.quests && raw.quests.length ? raw.quests : defaultQuests(s.day);
  s.log = (raw.log || []).slice(0, 120);
  s.stats = {...emptyStats(), ...(raw.stats || {})};
  s.profile = {...base.profile, ...(raw.profile || {})};
  s.xp = typeof raw.xp === 'number' ? raw.xp : 0;
  s.history = raw.history && raw.history.length ? raw.history.slice(-60) : [{day: s.day, cash: s.cash, profit: s.dailyProfit}];
  return s;
}

export function loadLocal(): Save | null {
  try {
    const keys = [KEY, ...LEGACY_KEYS];
    for (const k of keys) {
      const x = JSON.parse(localStorage.getItem(k) || 'null');
      if (x && typeof x.cash === 'number') return normalizeSave(x);
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocal(s: Save) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem(KEY + '_backup', JSON.stringify({ts: Date.now(), data: s}));
  } catch {
    /* переполнение localStorage (много фото) — игнорируем, UI предупредит отдельно */
  }
}

export function makeOffers(item: Item, s: Save, platform: 'market' | 'zono'): Offer[] {
  const reviewBoost = Math.min(0.25, s.reviews.filter(r => r.platform === platform).length * 0.01);
  const repBoost = Math.max(0, (s.reputation - 3) * 0.03);
  const market = item.base * (item.defect ? 0.7 : 1);
  const buyers = ['Алексей', 'Мария', 'Дмитрий', 'Ольга', 'Тимур'];
  return [0, 1, 2].map((_, i) => ({
    id: id(), itemId: item.id,
    buyer: buyers[(i + Math.floor(Math.random() * 3)) % buyers.length],
    price: Math.max(100, Math.round(market * (0.88 + i * 0.08 + reviewBoost + repBoost))),
    platform, expires: s.day + 1,
  }));
}

export function reviewAverage(s: Save, p: 'market' | 'zono') {
  const a = s.reviews.filter(r => r.platform === p);
  return a.length ? a.reduce((x, r) => x + r.stars, 0) / a.length : 5;
}

export function createOS(name: string, kernel: string, features: string[], day: number): OsProject {
  return {name: name.trim() || 'MyOS', version: '1.0', kernel, features, createdDay: day, users: 0};
}

/** Оценка ОС: ядро + функции + версия → спрос и доход. */
export function osScore(o: OsProject): number {
  const kernelBonus = o.kernel === 'Hybrid' ? 12 : o.kernel === 'Microkernel' ? 9 : 7;
  return Math.min(100, Math.round(30 + kernelBonus + o.features.length * 6 + (Number(o.version) || 1) * 4));
}

export function makeLog(text: string, kind: LogKind, day: number, hour: number): LogEntry {
  return {id: id(), day, hour, text, kind};
}

export function pushLog(x: Save, text: string, kind: LogKind = 'info') {
  x.log = [makeLog(text, kind, x.day, x.hour), ...x.log].slice(0, 120);
}

export function addXp(x: Save, amount: number): string | null {
  const before = levelInfo(x.xp).level;
  x.xp += Math.max(0, Math.round(amount));
  const after = levelInfo(x.xp);
  if (after.level > before) {
    pushLog(x, `Новый уровень ${after.level}: ${after.title}`, 'good');
    return `Уровень ${after.level} — ${after.title}`;
  }
  return null;
}

export function addQuestProgress(x: Save, kind: QuestKind, amount: number) {
  for (const q of x.quests) {
    if (q.kind !== kind || q.claimed) continue;
    q.progress = Math.min(q.target, q.progress + amount);
  }
}

export function unlockAchievements(x: Save): string[] {
  const got: string[] = [];
  const has = (k: string) => x.achievements.includes(k);
  const give = (k: string) => {
    if (has(k)) return;
    x.achievements.push(k);
    const a = ACHIEVEMENTS.find(v => v.id === k);
    if (a) {
      got.push(a.title);
      pushLog(x, `Достижение: ${a.title}`, 'good');
    }
  };
  if (x.stats.sold >= 1) give('first_sale');
  if (x.stats.sold >= 10) give('ten_sales');
  if (x.dailyProfit >= 50000) give('profit_50k');
  if (x.cash >= 500000) give('capital_500k');
  if (x.cash >= x.goal) give('goal');
  if (x.stats.repaired >= 5) give('repairer');
  if (x.reputation >= 4.8) give('honest');
  if (x.stats.blackDeals >= 1) give('black_deal');
  if (x.stats.pcBuilt >= 1) give('pc_builder');
  if (x.stats.osCreated >= 1) give('os_dev');
  if (x.stats.shipped >= 3) give('logist');
  if (x.deposit >= 100000) give('banker');
  return got;
}

/** Записать точку истории. `day` позволяет зафиксировать закрывающийся день. */
export function snapshotHistory(x: Save, day = x.day) {
  const last = x.history[x.history.length - 1];
  const point: HistoryPoint = {day, cash: Math.round(x.cash), profit: Math.round(x.dailyProfit)};
  if (last && last.day === day) x.history[x.history.length - 1] = point;
  else x.history = [...x.history, point].slice(-60);
}

/**
 * История с добавленной точкой текущего дня. История хранит закрытые дни,
 * поэтому для графика текущий день нужно добавить отдельно — иначе линия
 * отстаёт на день и на первом дне график пустой.
 */
export function historyWithToday(s: Save): HistoryPoint[] {
  const point: HistoryPoint = {day: s.day, cash: Math.round(s.cash), profit: Math.round(s.dailyProfit)};
  const last = s.history[s.history.length - 1];
  if (!last) return [point];
  if (last.day === s.day) return [...s.history.slice(0, -1), point];
  return [...s.history, point].slice(-60);
}

export function sellProfit(i: Item, price: number): number {
  return price - (i.purchasePrice ?? Math.round((i.listPrice ?? i.base) * 0.75));
}

export function defaultProfile(): Profile {
  return {nick: 'Перекуп', bio: ''};
}

export function defaultSettings(): Settings {
  return {autosave: true, theme: 'auto', reduceMotion: false, compact: false};
}

export function reviewText(stars: number, defect: boolean): string {
  if (defect && stars <= 3) return 'Товар пришёл с дефектом, пришлось договариваться';
  if (stars >= 5) return 'Всё честно, товар как в описании. Рекомендую!';
  if (stars === 4) return 'Сделка прошла хорошо, небольшие задержки';
  return 'Ожидал большего, но продавец на связи';
}

export function stars(rating: number): string {
  const full = Math.round(rating);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

export function reviewOf(platform: 'market' | 'zono', starsCount: number, defect: boolean, day: number): Review {
  const authors = ['Алексей', 'Мария', 'Дмитрий', 'Ольга', 'Тимур', 'Ирина', 'Павел'];
  return {
    id: id(), platform, stars: starsCount, text: reviewText(starsCount, defect),
    author: authors[Math.floor(Math.random() * authors.length)], kind: 'bot', day,
  };
}
