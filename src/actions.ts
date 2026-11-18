import type {Item, Offer, Save, Source} from './types';
import {
  CPU_CATALOG, GPU_CATALOG, SSD_CATALOG, PC_PARTS,
  addQuestProgress, addXp, createOS, defaultQuests, makeItem, makeOffers,
  money, pushLog, reviewOf, sellProfit, snapshotHistory,
} from './game';

/* Все функции мутируют переданный черновик Save и возвращают текст для тоста
   (или null, если сообщать нечего). Побочных эффектов вне черновика нет. */

const HOURS_PER_DAY = 24;

export function buyRandomItem(x: Save, platform: 'market' | 'zono'): string {
  const it = makeItem(Math.floor(Math.random() * 9));
  const price = Math.round(it.base * (0.75 + Math.random() * 0.35));
  it.listPrice = price;
  it.purchasePrice = price;
  it.listedOn = platform;
  it.boughtDay = x.day;
  if (x.cash < price) return 'Не хватает денег';
  x.inventory.push(it);
  x.cash -= price;
  x.stats.bought++;
  addQuestProgress(x, 'buy', 1);
  addXp(x, 6);
  pushLog(x, `Куплен ${it.name} за ${money(price)} на ${platform === 'market' ? 'Market' : 'Zono'}`, 'money');
  return `Куплено: ${it.name} за ${money(price)}`;
}

export function buyOfficial(x: Save, kind: 'phone' | 'ssd' | 'cpu' | 'gpu'): string {
  let item: Item;
  if (kind === 'ssd') {
    const d = SSD_CATALOG[Math.floor(Math.random() * SSD_CATALOG.length)];
    item = {
      id: Date.now() + Math.random(), name: d.name, brand: d.brand, speed: d.speed,
      reliability: d.reliability, base: d.price, category: 'Комплектующие', condition: 'new',
      purchasePrice: Math.round(d.price * 1.05), warrantyDays: 10, warrantyUntil: x.day + 10,
    };
  } else if (kind === 'cpu') {
    const d = CPU_CATALOG[Math.floor(Math.random() * CPU_CATALOG.length)];
    item = {
      id: Date.now() + Math.random(), name: d[0], base: d[1], category: 'Процессоры', condition: 'new',
      purchasePrice: Math.round(d[1] * 1.05), warrantyDays: 10, warrantyUntil: x.day + 10, reliability: 90,
    };
  } else if (kind === 'gpu') {
    const d = GPU_CATALOG[Math.floor(Math.random() * GPU_CATALOG.length)];
    item = {
      id: Date.now() + Math.random(), name: d[0], base: d[1], category: 'Видеокарты', condition: 'new',
      purchasePrice: Math.round(d[1] * 1.05), warrantyDays: 10, warrantyUntil: x.day + 10, reliability: 88,
    };
  } else {
    const d = makeItem(Math.floor(Math.random() * 3));
    d.condition = 'new';
    d.defect = false;
    d.purchasePrice = Math.round(d.base * 1.05);
    d.warrantyDays = 10;
    d.warrantyUntil = x.day + 10;
    item = d;
  }
  const cost = item.purchasePrice ?? item.base;
  if (x.cash < cost) return 'Не хватает денег';
  x.cash -= cost;
  item.listedOn = 'official';
  item.boughtDay = x.day;
  x.inventory.push(item);
  x.stats.bought++;
  addQuestProgress(x, 'buy', 1);
  addXp(x, 8);
  pushLog(x, `Официальная покупка: ${item.name} за ${money(cost)} (гарантия 10 дней)`, 'money');
  return `Куплено с гарантией: ${item.name}`;
}

export function buyCatalogPart(x: Save, name: string, price: number, part: string): string {
  if (x.cash < price) return 'Не хватает денег';
  const ssd = SSD_CATALOG.find(v => v.name === name);
  const reliability = part === 'ssd' ? ssd?.reliability ?? 70 : 85;
  const it: Item = {
    id: Date.now() + Math.random(), name, base: price,
    category: part === 'ssd' ? 'Комплектующие' : part === 'cpu' ? 'Процессоры' : 'Видеокарты',
    condition: 'new', purchasePrice: price, pcPart: part, reliability, speed: ssd?.speed, brand: ssd?.brand,
    boughtDay: x.day,
  };
  let broken = false;
  if (reliability < 55 && Math.random() < 0.35) {
    it.broken = true;
    it.defect = true;
    broken = true;
  }
  x.cash -= price;
  x.pcParts[part] = it;
  x.stats.bought++;
  addXp(x, 10);
  pushLog(x, `${broken ? 'Брак!' : 'Установлено'}: ${name} в сборку за ${money(price)}`, broken ? 'bad' : 'money');
  return broken ? 'Покупка неудачная: комплектующая оказалась неисправной' : `${name} установлен в сборку`;
}

export function buyPCComponent(x: Save, part: string, price: number, source: 'Market' | 'Zono' | 'Чёрный рынок', night: boolean): string {
  if (source === 'Чёрный рынок' && !night) return 'Чёрный рынок открыт только ночью';
  const final = Math.round(price * (source === 'Zono' ? 0.97 : source === 'Чёрный рынок' ? 0.88 : 1));
  if (x.cash < final) return 'Не хватает денег';
  const label = PC_PARTS.find(p => p[0] === part)?.[1] ?? part;
  x.cash -= final;
  x.pcParts[part] = {
    id: Date.now() + Math.random(), name: label, category: 'ПК', base: final, condition: 'new',
    purchasePrice: final, pcPart: part, boughtDay: x.day,
    listedOn: source === 'Market' ? 'market' : source === 'Zono' ? 'zono' : 'black',
  };
  x.stats.bought++;
  addXp(x, 8);
  pushLog(x, `${label} куплен через ${source} за ${money(final)}`, 'money');
  return `${label}: покупка через ${source} за ${money(final)}`;
}

export function assemblePC(x: Save): string {
  const need = PC_PARTS.length;
  if (Object.keys(x.pcParts).length < need) return `Нужны все ${need} комплектующих (сейчас ${Object.keys(x.pcParts).length})`;
  const broken = Object.values(x.pcParts).filter(v => v.broken);
  if (broken.length) return `ПК не запускается: замените ${broken.map(b => b.name).join(', ')}`;
  const cost = Object.values(x.pcParts).reduce((a, b) => a + (b.purchasePrice ?? b.base), 0);
  const revenue = Math.round(cost * 1.25);
  x.cash += revenue;
  x.dailyProfit += revenue - cost;
  x.pcParts = {};
  x.stats.pcBuilt++;
  addQuestProgress(x, 'pc', 1);
  addXp(x, 60);
  pushLog(x, `ПК собран и продан: +${money(revenue - cost)} прибыли`, 'good');
  return `ПК собран и продан за ${money(revenue)}`;
}

export function sellItem(x: Save, id: number, price: number, market: 'normal' | 'black' = 'normal'): string {
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  const profit = sellProfit(i, price);
  x.cash += price;
  x.dailyProfit += profit;
  x.inventory = x.inventory.filter(a => a.id !== id);
  x.offers = x.offers.filter(o => o.itemId !== id);
  x.stats.sold++;
  x.stats.bestSale = Math.max(x.stats.bestSale, profit);
  if (market === 'black') x.stats.blackDeals++;
  addQuestProgress(x, 'sell', 1);
  addQuestProgress(x, 'profit', Math.max(0, profit));
  addXp(x, 12);
  pushLog(x, `${market === 'black' ? 'Сбыт' : 'Продажа'}: ${i.name} за ${money(price)} (${profit >= 0 ? '+' : ''}${money(profit)})`, profit >= 0 ? 'good' : 'bad');
  // Покупатель оставляет отзыв — оценка зависит от состояния товара.
  const roll = Math.random();
  const bad = i.defect || i.broken;
  const stars = bad ? (roll < 0.5 ? 2 : 3) : roll < 0.55 ? 5 : 4;
  if (market === 'normal') {
    x.reviews.push(reviewOf(i.listedOn === 'zono' ? 'zono' : 'market', stars, !!bad, x.day));
    x.reputation = Math.min(5, Math.max(1, x.reputation + (stars >= 4 ? 0.04 : -0.08)));
    addQuestProgress(x, 'review', 1);
  }
  return `Продано: ${i.name} за ${money(price)} · ${profit >= 0 ? '+' : ''}${money(profit)}`;
}

export function acceptOffer(x: Save, offer: Offer): string {
  const i = x.inventory.find(a => a.id === offer.itemId);
  if (!i) return 'Товар уже продан';
  const profit = sellProfit(i, offer.price);
  x.cash += offer.price;
  x.dailyProfit += profit;
  x.inventory = x.inventory.filter(a => a.id !== offer.itemId);
  x.offers = x.offers.filter(a => a.itemId !== offer.itemId);
  x.stats.sold++;
  x.stats.bestSale = Math.max(x.stats.bestSale, profit);
  addQuestProgress(x, 'sell', 1);
  addQuestProgress(x, 'profit', Math.max(0, profit));
  addXp(x, 14);
  pushLog(x, `${offer.buyer} купил ${i.name} за ${money(offer.price)} (${profit >= 0 ? '+' : ''}${money(profit)})`, 'good');
  const stars = i.defect || i.broken ? 3 : 5;
  x.reviews.push(reviewOf(offer.platform, stars, !!i.defect, x.day));
  x.reputation = Math.min(5, Math.max(1, x.reputation + (stars >= 4 ? 0.05 : -0.05)));
  addQuestProgress(x, 'review', 1);
  return `Сделка с ${offer.buyer}: ${money(offer.price)}`;
}

export function requestOffers(x: Save, itemId: number, platform: 'market' | 'zono'): string {
  const i = x.inventory.find(a => a.id === itemId);
  if (!i) return 'Товар не найден';
  x.offers = x.offers.filter(o => o.itemId !== itemId);
  const offers = makeOffers(i, x, platform);
  x.offers.push(...offers);
  addXp(x, 3);
  return `Получено предложений: ${offers.length} · лучшее ${money(Math.max(...offers.map(o => o.price)))}`;
}

export function returnWarranty(x: Save, id: number): string {
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  if (i.listedOn !== 'official' || !i.warrantyUntil || i.warrantyUntil < x.day) return 'Гарантия закончилась';
  if (!i.broken && !i.defect) return 'Поломка не подтверждена — возврат невозможен';
  const back = i.purchasePrice || i.base;
  x.cash += back;
  x.inventory = x.inventory.filter(a => a.id !== id);
  x.returns++;
  x.reputation = Math.max(1, x.reputation - 0.05);
  addXp(x, 5);
  pushLog(x, `Возврат по гарантии: ${i.name}, вернули ${money(back)}`, 'money');
  return `Возврат подтверждён: ${money(back)}`;
}

export function repairItem(x: Save, id: number, cost = 1200): string {
  const a = x.inventory.find(z => z.id === id);
  if (!a) return 'Товар не найден';
  if (!a.defect && !a.broken) return 'Этот товар исправен';
  if (x.cash < cost) return `Не хватает ${money(cost)}`;
  a.broken = false;
  a.defect = false;
  x.cash -= cost;
  x.dailyProfit -= cost;
  x.stats.repaired++;
  addQuestProgress(x, 'repair', 1);
  addXp(x, 15);
  pushLog(x, `Ремонт ${a.name} за ${money(cost)}`, 'money');
  return `${a.name} отремонтирован за ${money(cost)}`;
}

export function createOsProject(x: Save, name: string, kernel: string, features: string[]): string {
  if (!name.trim()) return 'Введите название ОС';
  if (x.osProjects.some(o => o.name.toLowerCase() === name.trim().toLowerCase())) return 'ОС с таким названием уже есть';
  const cost = 5000;
  if (x.cash < cost) return `Разработка стоит ${money(cost)}`;
  x.cash -= cost;
  x.osProjects.push(createOS(name, kernel, features, x.day));
  x.stats.osCreated++;
  addQuestProgress(x, 'os', 1);
  addXp(x, 40);
  pushLog(x, `Создана ОС ${name.trim()} (${kernel})`, 'good');
  return `ОС «${name.trim()}» создана за ${money(cost)}`;
}

export function upgradeOs(x: Save, name: string): string {
  const o = x.osProjects.find(p => p.name === name);
  if (!o) return 'ОС не найдена';
  const cost = 3000 * (Number(o.version) || 1);
  if (x.cash < cost) return `Обновление стоит ${money(cost)}`;
  x.cash -= cost;
  o.version = (Number(o.version) + 0.1).toFixed(1);
  o.users += Math.round(120 + Math.random() * 400);
  const income = Math.round(o.users * 0.6);
  x.cash += income;
  x.dailyProfit += income;
  addXp(x, 20);
  pushLog(x, `ОС ${o.name} обновлена до v${o.version}: +${money(income)} с ${o.users} пользователей`, 'money');
  return `${o.name} v${o.version}: доход ${money(income)}`;
}

export function shipItem(x: Save, id: number): string {
  const i = x.inventory.find(z => z.id === id);
  if (!i) return 'Товар не найден';
  x.shipments.push({id: Date.now(), item: i.name, status: 'В пути', days: 1});
  x.inventory = x.inventory.filter(z => z.id !== id);
  x.offers = x.offers.filter(o => o.itemId !== id);
  x.stats.shipped++;
  addQuestProgress(x, 'ship', 1);
  addXp(x, 8);
  pushLog(x, `${i.name} передан в ShipGo`, 'info');
  return `${i.name} отправлен`;
}

export function depositMoney(x: Save, amount: number): string {
  if (x.cash < amount) return 'Не хватает денег';
  x.cash -= amount;
  x.deposit += amount;
  addQuestProgress(x, 'deposit', amount);
  addXp(x, 4);
  pushLog(x, `Вклад пополнен на ${money(amount)}`, 'money');
  return `Внесено ${money(amount)} (0,2% в день)`;
}

export function withdrawMoney(x: Save, amount: number): string {
  if (x.deposit < amount) return 'На вкладе недостаточно средств';
  x.deposit -= amount;
  x.cash += amount;
  pushLog(x, `Со вклада снято ${money(amount)}`, 'money');
  return `Снято ${money(amount)}`;
}

export function takeLoan(x: Save, amount: number): string {
  const limit = 50000 + Math.round(x.reputation * 10000);
  if (x.loan + amount > limit) return `Лимит кредита ${money(limit)} (репутация ${x.reputation.toFixed(1)})`;
  x.cash += amount;
  x.loan += amount;
  pushLog(x, `Кредит ${money(amount)} получен (1% в день)`, 'info');
  return `Кредит ${money(amount)} получен`;
}

export function repayLoan(x: Save, amount: number): string {
  const pay = Math.min(amount, x.loan);
  if (pay <= 0) return 'Кредит уже погашен';
  if (x.cash < pay) return 'Не хватает денег';
  x.cash -= pay;
  x.loan -= pay;
  pushLog(x, `Кредит погашен на ${money(pay)}`, 'money');
  return `Погашено ${money(pay)}`;
}

export function buyBusiness(x: Save): string {
  const cost = 25000;
  if (x.cash < cost) return `Нужно ${money(cost)}`;
  x.cash -= cost;
  x.bizIncome += 1200;
  addXp(x, 25);
  pushLog(x, `Открыт бизнес: +${money(1200)}/день`, 'good');
  return `Бизнес открыт: +${money(1200)} в день`;
}

export function blackBuy(x: Save, night: boolean): string {
  if (!night) return 'Чёрный рынок открыт только ночью (22:00–06:00)';
  const cost = 8000;
  if (x.cash < cost) return `Нужно минимум ${money(cost)}`;
  const it: Item = {
    ...makeItem(7), base: 25000, listPrice: 18000, purchasePrice: cost,
    listedOn: 'black' as Source, boughtDay: x.day,
  };
  x.cash -= cost;
  x.inventory.push(it);
  x.wanted = Math.min(5, x.wanted + 1);
  x.stats.bought++;
  addXp(x, 10);
  pushLog(x, `Тёмная закупка: ${it.name} за ${money(cost)}, розыск ${x.wanted}`, 'bad');
  return `Куплено на чёрном рынке. Розыск: ${x.wanted}`;
}

export function blackSell(x: Save, id: number, night: boolean): string {
  if (!night) return 'Чёрный рынок открыт только ночью';
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  const price = Math.round((i.listPrice ?? i.base) * 0.95);
  x.wanted = Math.min(5, x.wanted + (Math.random() < 0.3 ? 1 : 0));
  return sellItem(x, id, price, 'black');
}

export function payFine(x: Save): string {
  const fine = 1500 * x.wanted;
  if (!fine) return 'Штрафов нет';
  if (x.cash < fine) return `Не хватает ${money(fine)}`;
  x.cash -= fine;
  x.wanted = 0;
  pushLog(x, `Оплачен штраф ${money(fine)}`, 'money');
  return `Штраф ${money(fine)} оплачен`;
}

/** Ручное действие: попросить отзыв (раз в день на площадку). */
export function askReview(x: Save, platform: 'market' | 'zono'): string {
  const today = x.reviews.some(r => r.day === x.day && r.platform === platform && r.kind === 'player');
  if (today) return 'Сегодня отзыв на этой площадке уже оставлен';
  const stars = Math.random() < 0.6 ? 5 : 4;
  const r = reviewOf(platform, stars, false, x.day);
  r.kind = 'player';
  r.author = 'Вы';
  x.reviews.push(r);
  x.reputation = Math.min(5, x.reputation + 0.03);
  addQuestProgress(x, 'review', 1);
  addXp(x, 5);
  return `Отзыв добавлен: ${stars} ★`;
}

export function claimQuest(x: Save, id: string): string {
  const q = x.quests.find(v => v.id === id);
  if (!q) return 'Задание не найдено';
  if (q.claimed) return 'Награда уже получена';
  if (q.progress < q.target) return 'Задание ещё не выполнено';
  q.claimed = true;
  x.cash += q.reward;
  x.dailyProfit += q.reward;
  addXp(x, q.xp);
  pushLog(x, `Награда за «${q.title}»: ${money(q.reward)}`, 'good');
  return `Награда: ${money(q.reward)} и ${q.xp} XP`;
}

export function attachPhoto(x: Save, id: number, photo: string | undefined): string {
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  if (photo) i.photo = photo;
  else delete i.photo;
  return photo ? 'Фото прикреплено к товару' : 'Фото убрано';
}

export function setItemNote(x: Save, id: number, note: string): string {
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  i.note = note;
  return 'Заметка сохранена';
}

export function setListPrice(x: Save, id: number, price: number): string {
  const i = x.inventory.find(a => a.id === id);
  if (!i) return 'Товар не найден';
  if (!Number.isFinite(price) || price <= 0) return 'Некорректная цена';
  i.listPrice = Math.round(price);
  return `Цена выставлена: ${money(price)}`;
}

const EVENTS: {text: string; cash?: number; rep?: number; kind: 'good' | 'bad' | 'info'}[] = [
  {text: 'Ажиотаж на рынке: спрос вырос', rep: 0.05, kind: 'good'},
  {text: 'Курьер задержался, покупатель поворчал', rep: -0.05, kind: 'bad'},
  {text: 'Реклама в местном чате сработала', cash: 1500, kind: 'good'},
  {text: 'Проверка документов — штраф за просрочку', cash: -900, kind: 'bad'},
  {text: 'Знакомый подогнал выгодный лот', cash: 2200, kind: 'good'},
  {text: 'Скачок цен на комплектующие', kind: 'info'},
];

/** Прокрутка времени. Возвращает сообщение о событиях дня. */
export function advanceTime(x: Save, hours = 2): string {
  const total = x.hour + hours;
  // Полные сутки (hours >= 24) тоже должны переводить день, поэтому проверяем
  // перенос через 24, а не сравнение часов.
  const newDay = total >= HOURS_PER_DAY;
  x.hour = ((total % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const messages: string[] = [];
  if (!newDay) {
    // события внутри дня
    if (Math.random() < 0.35) {
      const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      if (e.cash) x.cash += e.cash;
      if (e.rep) x.reputation = Math.min(5, Math.max(1, x.reputation + e.rep));
      pushLog(x, `${e.text}${e.cash ? ` (${e.cash > 0 ? '+' : ''}${money(e.cash)})` : ''}`, e.kind);
      messages.push(e.text);
    }
    return messages.join(' · ');
  }

  // ---- новый день ----
  const closingDay = x.day;
  const interest = Math.round(x.deposit * 0.002);
  x.cash += interest + x.bizIncome;

  // Доставленные посылки показываются один день и исчезают на следующем.
  x.shipments = x.shipments
    .filter(q => q.status !== 'Доставлено')
    .map(q => {
      const days = Math.max(0, q.days - 1);
      return days <= 0 ? {...q, days, status: 'Доставлено' as const} : {...q, days};
    });

  if (x.loan > 0) {
    const fee = Math.round(x.loan * 0.01);
    x.cash -= fee;
    messages.push(`проценты по кредиту ${money(fee)}`);
  }
  if (interest || x.bizIncome) messages.push(`доход ${money(interest + x.bizIncome)}`);

  // гарантийные поломки
  let broke = 0;
  x.inventory = x.inventory.map(i => {
    if (i.warrantyUntil && i.warrantyUntil >= x.day && !i.broken && Math.random() < 0.02) {
      broke++;
      return {...i, broken: true, defect: true};
    }
    return i;
  });
  if (broke) messages.push(`поломок по гарантии: ${broke}`);

  // Итог закрывающегося дня фиксируем ДО сброса прибыли, иначе график покажет нули.
  snapshotHistory(x, closingDay);

  x.day++;
  x.dailyProfit = 0;
  x.offers = x.offers.filter(o => o.expires >= x.day);
  x.quests = defaultQuests(x.day);
  pushLog(x, `Наступил день ${x.day}`, 'info');
  addXp(x, 10);
  return `День ${x.day}${messages.length ? ' · ' + messages.join(' · ') : ''}`;
}

export function setGoal(x: Save, goal: number): string {
  if (!Number.isFinite(goal) || goal <= 0) return 'Некорректная цель';
  x.goal = Math.round(goal);
  return `Цель: ${money(goal)}`;
}
