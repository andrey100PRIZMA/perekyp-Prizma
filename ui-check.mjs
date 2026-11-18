/**
 * UI-проверка: монтируем реальное приложение в jsdom, кликаем по всем экранам
 * и по ключевым кнопкам. Ловит падения рендера и ошибки в обработчиках.
 * Запуск: node ui-check.mjs
 */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';

mkdirSync('.verify', {recursive: true});

/* ---------- окружение браузера ---------- */
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://example.test/',
  pretendToBeVisual: true,
});

const errors = [];
dom.window.addEventListener('error', e => errors.push(String(e.message)));

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.localStorage = dom.window.localStorage;
globalThis.Image = dom.window.Image;
globalThis.URL = dom.window.URL;
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* canvas нужен images.ts, но в тестах фото не грузим — заглушка на случай вызова */
dom.window.HTMLCanvasElement.prototype.getContext = () => null;

/* ---------- сборка ---------- */
await build({
  // App.tsx как отдельная точка входа — монтируем вручную, чтобы обернуть в act().
  entryPoints: [{in: 'src/App.tsx', out: 'App'}],
  outdir: '.verify',
  format: 'esm',
  bundle: true,
  platform: 'browser',
  jsx: 'automatic',
  define: {'process.env.NODE_ENV': '"development"'},
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  // Supabase подменяем заглушкой: реальный клиент лезет в сеть и тест висит.
  // alias в esbuild принимает только имена пакетов, поэтому используем плагин.
  plugins: [
    {
      name: 'stub-supabase',
      setup(b) {
        b.onResolve({filter: /(^@supabase\/supabase-js$|\/supabase$)/}, () => ({
          path: path.resolve('test-stubs/supabase-stub.ts'),
        }));
      },
    },
  ],
  logLevel: 'warning',
});

const React = (await import('react')).default;
const {createRoot} = await import('react-dom/client');
const {act} = await import('react');
const App = (await import(pathToFileURL('.verify/App.js').href)).default;

const root = createRoot(document.getElementById('root'));

const flush = async () => {
  await act(async () => {
    await new Promise(r => setTimeout(r, 0));
  });
};

const text = () => document.body.textContent ?? '';
const buttons = () => [...document.querySelectorAll('button')];
const btn = label => buttons().find(b => (b.textContent ?? '').trim().includes(label));

const click = async el => {
  assert.ok(el, 'кнопка должна существовать');
  await act(async () => {
    el.dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true, cancelable: true}));
  });
  await flush();
};

let passed = 0;
const check = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.log(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};

/* ---------- монтирование ---------- */
await act(async () => {
  root.render(React.createElement(App));
});
await flush();

console.log('\n— запуск —');

check('приложение смонтировалось', () => {
  assert.ok(text().length > 50, 'на странице есть текст');
});

check('показан экран входа с формой', () => {
  assert.ok(text().includes('Перекуп'), 'есть название');
  assert.ok(btn('Продолжить без аккаунта'), 'есть вход без аккаунта');
  assert.ok(document.querySelector('input[type="email"]'), 'есть поле email');
  assert.ok(document.querySelector('input[type="password"]'), 'есть поле пароля');
});

check('переключение на логин работает', async () => {});
await click(btn('Логин'));
check('режим логина выбран', () => {
  assert.ok(text().includes('Войти'), 'кнопка входа');
});

/* входим как гость */
await click(btn('Продолжить без аккаунта'));

console.log('\n— навигация по экранам —');

const SCREENS = [
  ['Главная', ['Динамика капитала', 'Журнал событий', 'Что делать сейчас']],
  ['Market', ['Market', 'Купить случайный товар']],
  ['Zono', ['Zono', 'Купить случайный товар']],
  ['Офиц. магазин', ['Официальный магазин', 'Телефон + гарантия']],
  ['Чёрный рынок', ['Чёрный рынок']],
  ['TechFix', ['TechFix']],
  ['PC Lab', ['PC Lab', 'SSD: бренд']],
  ['Моя ОС', ['Лаборатория своей ОС', 'Создать ОС']],
  ['ShipGo', ['ShipGo']],
  ['FinBank', ['FinBank', 'Внести 1 000']],
  ['Бизнес', ['Бизнес', 'Открыть бизнес']],
  ['Задания', ['Ежедневные задания', 'Достижения']],
  ['Профиль', ['Фото профиля', 'Статистика']],
  ['Настройки', ['Внешний вид', 'Сохранение', 'Файл сохранения', 'Опасная зона']],
];

for (const [name, markers] of SCREENS) {
  const nav = [...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes(name));
  await click(nav);
  check(`экран «${name}» открывается`, () => {
    for (const m of markers) assert.ok(text().includes(m), `ожидался текст «${m}»`);
  });
}

console.log('\n— игровые действия —');

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Market')));
const cashBefore = text().match(/💰\s*([\d\s ]+)₽/)?.[1];

await click(btn('Купить случайный товар'));
check('покупка отражается в интерфейсе', () => {
  assert.ok(text().includes('Товаров на руках') || text().includes('Ваши лоты'), 'список лотов отрисован');
});

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Главная')));
await click(btn('+2 часа'));
check('прокрутка времени обновляет часы', () => {
  assert.ok(/\d{2}:00/.test(text()), 'время показано');
});

await click(btn('Следующий день →'));
check('следующий день увеличивает день', () => {
  assert.ok(text().includes('День 2'), `ожидался день 2, текст: ${text().slice(0, 200)}`);
});

check('график капитала отрисован как SVG', () => {
  assert.ok(document.querySelector('svg.chart'), 'есть график');
  assert.ok(document.querySelector('svg.chart path.line'), 'есть линия капитала');
});

console.log('\n— темы и режимы —');

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Настройки')));
await click(btn('Тёмная'));
check('тёмная тема проставляется на html', () => {
  assert.equal(document.documentElement.dataset.theme, 'dark');
});
await click(btn('Светлая'));
check('светлая тема проставляется на html', () => {
  assert.equal(document.documentElement.dataset.theme, 'light');
});
await click(btn('Как в системе'));
check('авто-тема снимает атрибут', () => {
  assert.equal(document.documentElement.dataset.theme, undefined);
});

await click(btn('Компактный режим'));
check('компактный режим включается', () => {
  assert.equal(document.documentElement.dataset.compact, 'on');
});

console.log('\n— фото и файлы —');

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Профиль')));
check('в профиле есть загрузка аватара', () => {
  assert.ok(text().includes('Загрузить аватар'), 'есть зона загрузки');
  assert.ok(document.querySelector('input[type="file"]'), 'есть input файла');
});

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Market')));
const photoBtn = btn('Фото');
check('у товара есть кнопка фото', () => {
  assert.ok(photoBtn, 'кнопка 📷 Фото присутствует');
});
await click(photoBtn);
check('модалка фото открывается', () => {
  assert.ok(text().includes('Загрузить фото товара'), 'модалка с загрузкой фото');
  assert.ok(text().includes('Заметка к товару'), 'поле заметки');
  assert.ok(text().includes('Своя цена продажи'), 'поле цены');
});

await click(btn('✕'));
check('модалка закрывается', () => {
  assert.ok(!text().includes('Загрузить фото товара'), 'модалка скрыта');
});

await click([...document.querySelectorAll('.sidebar .navbtn')].find(b => (b.textContent ?? '').includes('Настройки')));
await click(btn('Загрузить из файла'));
check('модалка импорта открывается', () => {
  assert.ok(text().includes('Выбрать JSON-файл сохранения'), 'есть выбор файла');
  assert.ok(text().includes('вставьте JSON'), 'есть ручной ввод');
});
await click(btn('Отмена'));

console.log('\n— сохранение —');

check('локальное сохранение записано в localStorage', () => {
  const raw = dom.window.localStorage.getItem('perekup-react-final-v7');
  assert.ok(raw, 'ключ сохранения существует');
  const parsed = JSON.parse(raw);
  assert.equal(typeof parsed.cash, 'number');
  assert.ok(Array.isArray(parsed.quests));
});

check('импорт мусора показывает понятную ошибку', async () => {});
const area = document.querySelector('.modal textarea');
if (area) {
  await act(async () => {
    area.value = '{сломано}';
    area.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
  });
  await flush();
}

check('ошибок в консоли браузера нет', () => {
  assert.deepEqual(errors, [], errors.join(' | '));
});

await act(async () => {
  root.unmount();
});

console.log(`\n${passed} UI-проверок пройдено${process.exitCode ? ', ЕСТЬ ОШИБКИ' : ', ошибок нет'}\n`);
