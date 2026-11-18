/**
 * Проверка игровой логики в Node: собираем чистые модули через esbuild и
 * прогоняем ключевые сценарии. Запуск: node verify.mjs
 */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';

mkdirSync('.verify', {recursive: true});

await build({
  entryPoints: ['src/game.ts', 'src/actions.ts', 'src/storage.ts'],
  outdir: '.verify',
  format: 'esm',
  bundle: true,
  platform: 'neutral',
  logLevel: 'warning',
});

const G = await import(pathToFileURL('.verify/game.js').href);
const A = await import(pathToFileURL('.verify/actions.js').href);
const S = await import(pathToFileURL('.verify/storage.js').href);

let passed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

const fresh = () => G.initialSave();

console.log('\n— время и дни —');

test('+2 часа внутри дня не меняет день', () => {
  const s = fresh();
  s.hour = 12;
  A.advanceTime(s, 2);
  assert.equal(s.day, 1);
  assert.equal(s.hour, 14);
});

test('переход через полночь увеличивает день', () => {
  const s = fresh();
  s.hour = 23;
  A.advanceTime(s, 2);
  assert.equal(s.day, 2);
  assert.equal(s.hour, 1);
});

test('+24 часа тоже переводит день (регресс)', () => {
  const s = fresh();
  s.hour = 12;
  A.advanceTime(s, 24);
  assert.equal(s.day, 2, 'день должен стать 2');
  assert.equal(s.hour, 12);
});

test('история пишет прибыль закрывающегося дня, а не нули (регресс)', () => {
  const s = fresh();
  s.dailyProfit = 7000;
  A.advanceTime(s, 24);
  const point = s.history.find(h => h.day === 1);
  assert.ok(point, 'точка дня 1 должна существовать');
  assert.equal(point.profit, 7000, `прибыль дня 1 = ${point.profit}`);
  assert.equal(s.dailyProfit, 0, 'новый день начинается с нуля');
});

test('доставленные посылки живут один день, потом исчезают', () => {
  const s = fresh();
  s.shipments = [{id: 1, item: 'PS5', status: 'В пути', days: 1}];
  A.advanceTime(s, 24);
  assert.equal(s.shipments.length, 1);
  assert.equal(s.shipments[0].status, 'Доставлено');
  A.advanceTime(s, 24);
  assert.equal(s.shipments.length, 0, 'доставленное должно исчезнуть');
});

test('вклад и бизнес начисляются в новый день', () => {
  const s = fresh();
  s.deposit = 100000;
  s.bizIncome = 1200;
  const before = s.cash;
  A.advanceTime(s, 24);
  assert.equal(s.cash, before + 200 + 1200);
});

test('кредит списывает 1% в день', () => {
  const s = fresh();
  s.loan = 10000;
  const before = s.cash;
  A.advanceTime(s, 24);
  assert.equal(s.cash, before - 100);
});

console.log('\n— торговля —');

test('покупка списывает деньги и добавляет товар', () => {
  const s = fresh();
  s.cash = 500000; // случайный лот может стоить дороже стартовых 50 000
  const before = s.cash;
  const msg = A.buyRandomItem(s, 'market');
  assert.ok(!msg.includes('Не хватает'), msg);
  assert.equal(s.inventory.length, 3);
  assert.ok(s.cash < before);
  assert.equal(s.stats.bought, 1);
});

test('покупка без денег отклоняется', () => {
  const s = fresh();
  s.cash = 10;
  const msg = A.buyRandomItem(s, 'market');
  assert.equal(msg, 'Не хватает денег');
  assert.equal(s.inventory.length, 2);
});

test('продажа начисляет деньги и считает прибыль', () => {
  const s = fresh();
  const item = s.inventory[0];
  const price = item.listPrice ?? item.base;
  const before = s.cash;
  A.sellItem(s, item.id, price);
  assert.equal(s.cash, before + price);
  assert.equal(s.inventory.length, 1);
  assert.equal(s.stats.sold, 1);
  assert.equal(s.dailyProfit, price - item.purchasePrice);
});

test('продажа несуществующего товара не меняет состояние', () => {
  const s = fresh();
  const before = s.cash;
  const msg = A.sellItem(s, 999999, 1000);
  assert.equal(msg, 'Товар не найден');
  assert.equal(s.cash, before);
});

test('предложения покупателей приходят и принимаются', () => {
  const s = fresh();
  const item = s.inventory[0];
  A.requestOffers(s, item.id, 'market');
  const offers = s.offers.filter(o => o.itemId === item.id);
  assert.equal(offers.length, 3);
  const best = offers.reduce((a, b) => (a.price > b.price ? a : b));
  const before = s.cash;
  A.acceptOffer(s, best);
  assert.equal(s.cash, before + best.price);
  assert.equal(s.inventory.length, 1);
  assert.equal(s.offers.filter(o => o.itemId === item.id).length, 0, 'прочие предложения снимаются');
});

test('гарантийный возврат только при подтверждённой поломке', () => {
  const s = fresh();
  s.cash = 500000; // телефон с гарантией может стоить дороже стартовых 50 000
  A.buyOfficial(s, 'phone');
  const item = s.inventory[s.inventory.length - 1];
  assert.equal(item.listedOn, 'official', 'покупка должна пройти');
  assert.equal(A.returnWarranty(s, item.id), 'Поломка не подтверждена — возврат невозможен');
  item.broken = true;
  const before = s.cash;
  const msg = A.returnWarranty(s, item.id);
  assert.ok(msg.startsWith('Возврат подтверждён'), msg);
  assert.equal(s.cash, before + (item.purchasePrice ?? item.base));
  assert.equal(s.returns, 1);
});

test('гарантия истекает по дню', () => {
  const s = fresh();
  s.cash = 500000;
  A.buyOfficial(s, 'ssd');
  const item = s.inventory[s.inventory.length - 1];
  assert.equal(item.listedOn, 'official');
  item.broken = true;
  s.day = (item.warrantyUntil ?? 0) + 1;
  assert.equal(A.returnWarranty(s, item.id), 'Гарантия закончилась');
});

test('ремонт восстанавливает товар и списывает 1200', () => {
  const s = fresh();
  const item = s.inventory[0];
  item.broken = true;
  item.defect = true;
  const before = s.cash;
  A.repairItem(s, item.id);
  assert.equal(item.broken, false);
  assert.equal(item.defect, false);
  assert.equal(s.cash, before - 1200);
  assert.equal(s.stats.repaired, 1);
});

test('ремонт без денег отклоняется', () => {
  const s = fresh();
  s.cash = 100;
  const item = s.inventory[0];
  item.broken = true;
  // money() вставляет неразрывный пробел (U+00A0) как разделитель тысяч,
  // поэтому ожидание строим тем же форматтером, а не литералом.
  assert.equal(A.repairItem(s, item.id), `Не хватает ${G.money(1200)}`);
  assert.equal(item.broken, true);
});

console.log('\n— PC Lab и чёрный рынок —');

test('ПК собирается только из 8 деталей', () => {
  const s = fresh();
  const msg = A.assemblePC(s);
  assert.ok(msg.includes('Нужны все 8'), msg);
});

test('ПК с неисправной деталью не собирается', () => {
  const s = fresh();
  s.cash = 10_000_000;
  for (const [id, , price] of G.PC_PARTS) A.buyPCComponent(s, id, price, 'Market', false);
  s.pcParts.cpu.broken = true;
  const msg = A.assemblePC(s);
  assert.ok(msg.includes('ПК не запускается'), msg);
  assert.equal(Object.keys(s.pcParts).length, 8, 'детали остаются на месте');
});

test('ПК продаётся с наценкой 25%', () => {
  const s = fresh();
  s.cash = 10_000_000;
  for (const [id, , price] of G.PC_PARTS) A.buyPCComponent(s, id, price, 'Market', false);
  const cost = Object.values(s.pcParts).reduce((a, b) => a + b.purchasePrice, 0);
  const before = s.cash;
  A.assemblePC(s);
  assert.equal(s.cash, before + Math.round(cost * 1.25));
  assert.equal(Object.keys(s.pcParts).length, 0);
  assert.equal(s.stats.pcBuilt, 1);
});

test('чёрный рынок днём закрыт', () => {
  const s = fresh();
  s.hour = 12;
  assert.ok(A.blackBuy(s, false).includes('только ночью'));
  assert.equal(s.inventory.length, 2);
});

test('чёрный рынок ночью повышает розыск, штраф его сбрасывает', () => {
  const s = fresh();
  s.hour = 23;
  A.blackBuy(s, true);
  assert.equal(s.wanted, 1);
  assert.equal(A.payFine(s), `Штраф ${G.money(1500)} оплачен`);
  assert.equal(s.wanted, 0);
});

console.log('\n— банк, ОС, задания —');

test('вклад и снятие работают', () => {
  const s = fresh();
  const before = s.cash;
  A.depositMoney(s, 1000);
  assert.equal(s.cash, before - 1000);
  assert.equal(s.deposit, 1000);
  A.withdrawMoney(s, 1000);
  assert.equal(s.cash, before);
  assert.equal(s.deposit, 0);
});

test('снятие больше вклада отклоняется', () => {
  const s = fresh();
  assert.equal(A.withdrawMoney(s, 1000), 'На вкладе недостаточно средств');
});

test('лимит кредита зависит от репутации', () => {
  const s = fresh();
  s.reputation = 5;
  assert.ok(A.takeLoan(s, 100000).startsWith('Кредит'), 'при репутации 5 лимит 100 000');
  s.loan = 0;
  s.reputation = 1;
  assert.ok(A.takeLoan(s, 100000).includes('Лимит'), 'при репутации 1 лимит меньше');
});

test('ОС создаётся, дубликат и отсутствие денег отклоняются', () => {
  const s = fresh();
  assert.equal(A.createOsProject(s, '', 'Hybrid', []), 'Введите название ОС');
  assert.ok(A.createOsProject(s, 'PerekupOS', 'Hybrid', ['тема']).startsWith('ОС «'));
  assert.equal(s.osProjects.length, 1);
  assert.equal(A.createOsProject(s, 'PerekupOS', 'Hybrid', []), 'ОС с таким названием уже есть');
  s.cash = 0;
  assert.ok(A.createOsProject(s, 'Other', 'Hybrid', []).includes('стоит'));
});

test('обновление ОС приносит доход с пользователей', () => {
  const s = fresh();
  A.createOsProject(s, 'NeoOS', 'Hybrid', ['a', 'b']);
  s.cash = 100000;
  const before = s.cash;
  const msg = A.upgradeOs(s, 'NeoOS');
  assert.ok(msg.includes('v1.1'), msg);
  assert.equal(s.osProjects[0].version, '1.1');
  assert.ok(s.osProjects[0].users > 0);
  assert.ok(s.cash > before - 3000, 'доход должен частично покрыть стоимость');
});

test('задание сдаётся только при выполнении и один раз', () => {
  const s = fresh();
  const q = s.quests[0];
  assert.equal(A.claimQuest(s, q.id), 'Задание ещё не выполнено');
  q.progress = q.target;
  const before = s.cash;
  assert.ok(A.claimQuest(s, q.id).startsWith('Награда'));
  assert.equal(s.cash, before + q.reward);
  assert.equal(A.claimQuest(s, q.id), 'Награда уже получена');
});

test('прогресс заданий растёт от покупок и продаж', () => {
  const s = fresh();
  s.cash = 500000; // случайный лот может стоить дороже стартовых 50 000
  const msg = A.buyRandomItem(s, 'market');
  assert.ok(!msg.includes('Не хватает'), msg);
  assert.equal(s.quests.find(q => q.kind === 'buy').progress, 1);
  const item = s.inventory[0];
  A.sellItem(s, item.id, item.listPrice ?? item.base);
  assert.equal(s.quests.find(q => q.kind === 'sell').progress, 1);
});

test('новый день выдаёт свежие задания', () => {
  const s = fresh();
  s.quests[0].progress = 99;
  s.quests[0].claimed = true;
  A.advanceTime(s, 24);
  assert.equal(s.quests[0].progress, 0);
  assert.equal(s.quests[0].claimed, false);
  assert.ok(s.quests[0].id.startsWith('d2'));
});

console.log('\n— уровни, достижения, фото —');

test('уровни растут по опыту', () => {
  assert.equal(G.levelInfo(0).level, 1);
  assert.equal(G.levelInfo(99).level, 1);
  assert.equal(G.levelInfo(100).level, 2);
  assert.equal(G.levelInfo(300).level, 3);
  assert.ok(G.levelInfo(100).pct >= 0 && G.levelInfo(100).pct <= 100);
});

test('достижения открываются по условиям', () => {
  const s = fresh();
  s.stats.sold = 10;
  s.cash = 600000;
  s.stats.pcBuilt = 1;
  const got = G.unlockAchievements(s);
  assert.ok(got.includes('Оптовик'), got.join(','));
  assert.ok(got.includes('Полмиллиона'));
  assert.ok(got.includes('Сборщик'));
  assert.equal(G.unlockAchievements(s).length, 0, 'повторно не выдаются');
});

test('фото прикрепляется и снимается', () => {
  const s = fresh();
  const id = s.inventory[0].id;
  A.attachPhoto(s, id, 'data:image/jpeg;base64,AAAA');
  assert.equal(s.inventory[0].photo, 'data:image/jpeg;base64,AAAA');
  A.attachPhoto(s, id, undefined);
  assert.equal(s.inventory[0].photo, undefined);
});

test('своя цена и заметка сохраняются', () => {
  const s = fresh();
  const id = s.inventory[0].id;
  A.setListPrice(s, id, 12345);
  assert.equal(s.inventory[0].listPrice, 12345);
  assert.equal(A.setListPrice(s, id, -5), 'Некорректная цена');
  A.setItemNote(s, id, 'скол');
  assert.equal(s.inventory[0].note, 'скол');
});

console.log('\n— сохранение и миграция —');

test('normalizeSave восстанавливает старый формат v6', () => {
  const legacy = {
    cash: 12345, day: 7, hour: 5, goal: 100000,
    inventory: [{id: 1, name: 'iPhone 13', category: 'Телефоны', base: 32000, condition: 'used'}],
    reviews: [], offers: [], shipments: [], pcParts: {}, wanted: 0, promoUsed: [],
    reputation: 4.2, dailyProfit: 500, bizIncome: 0, deposit: 0, loan: 0, returns: 0, osProjects: [],
    settings: {autosave: true},
  };
  const s = G.normalizeSave(legacy);
  assert.equal(s.cash, 12345);
  assert.equal(s.inventory[0].purchasePrice, Math.round(32000 * 0.75), 'закупка восстанавливается');
  assert.equal(s.profile.nick, 'Перекуп', 'новое поле профиля появляется');
  assert.equal(s.stats.sold, 0, 'статистика инициализируется');
  assert.equal(s.settings.theme, 'auto');
  assert.ok(Array.isArray(s.quests) && s.quests.length > 0, 'задания создаются');
  assert.ok(s.history.length >= 1, 'история создаётся');
  assert.equal(s.xp, 0);
});

test('normalizeSave не падает на пустом объекте', () => {
  const s = G.normalizeSave({});
  assert.equal(s.cash, 50000);
  assert.equal(s.day, 1);
});

test('normalizeSave сохраняет фото и новые поля', () => {
  const s = G.normalizeSave({
    cash: 100, day: 2,
    inventory: [{id: 1, name: 'X', category: 'Аудио', base: 1000, condition: 'used', photo: 'data:image/jpeg;base64,ZZZ', note: 'царапина'}],
    profile: {nick: 'Богдан', bio: 'торгую техникой'},
    xp: 250, achievements: ['first_sale'],
  });
  assert.equal(s.inventory[0].photo, 'data:image/jpeg;base64,ZZZ');
  assert.equal(s.inventory[0].note, 'царапина');
  assert.equal(s.profile.nick, 'Богдан');
  assert.equal(s.xp, 250);
  assert.deepEqual(s.achievements, ['first_sale']);
  assert.equal(G.levelInfo(s.xp).level, 2);
});

test('parseSave принимает и файл, и строку из game_saves', () => {
  const {parseSave} = S;
  assert.equal(parseSave(JSON.stringify({cash: 7000, day: 3})).cash, 7000);
  assert.equal(parseSave(JSON.stringify({save_data: {cash: 8000, day: 4}})).cash, 8000, 'формат game_saves');
  assert.equal(parseSave(JSON.stringify({cash: 1, day: 1, profile: {nick: 'Богдан'}})).profile.nick, 'Богдан');
});

test('parseSave отклоняет мусор понятными ошибками', () => {
  const {parseSave} = S;
  assert.throws(() => parseSave('не json'), /JSON/);
  assert.throws(() => parseSave('null'), /формат/);
  assert.throws(() => parseSave('{"hello":1}'), /cash\/day/);
});

test('saveToText и saveFileName дают корректный файл', () => {
  const s = fresh();
  const text = S.saveToText(s);
  assert.equal(JSON.parse(text).cash, 50000, 'текст — валидный JSON');
  assert.match(S.saveFileName(s), /^perekup-day1-\d{4}-\d{2}-\d{2}\.json$/);
});

console.log('\n— длинная симуляция —');

test('30 дней без исключений, капитал и история согласованы', () => {
  const s = fresh();
  for (let i = 0; i < 30; i++) {
    A.advanceTime(s, 24);
    if (s.cash > 20000) A.buyRandomItem(s, 'market');
    const item = s.inventory[0];
    if (item) A.sellItem(s, item.id, item.listPrice ?? item.base);
  }
  assert.equal(s.day, 31);
  assert.ok(Number.isFinite(s.cash), 'капитал — число');
  assert.ok(s.history.length <= 60, 'история ограничена 60 точками');
  assert.equal(s.history[s.history.length - 1].day, 30, 'последняя точка — день 30');
  assert.ok(s.log.length <= 120, 'журнал ограничен');
  assert.ok(s.quests.every(q => q.day === 31), 'задания текущего дня');
});

test('журнал не растёт бесконечно', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) A.buyRandomItem(s, 'market');
  assert.ok(s.log.length <= 120);
  assert.ok(s.log[0].day >= 1);
});

console.log(`\n${passed} проверок пройдено${process.exitCode ? ', ЕСТЬ ОШИБКИ' : ', ошибок нет'}\n`);
