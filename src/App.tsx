import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {supabase} from './supabase';
import type {Item, Save, Tab, Theme} from './types';
import {
  ACHIEVEMENTS, CPU_CATALOG, GPU_CATALOG, PC_PARTS, SSD_CATALOG,
  historyWithToday, initialSave, levelInfo, loadLocal, money, normalizeSave,
  reviewAverage, saveLocal, shortMoney, unlockAchievements,
} from './game';
import * as A from './actions';
import {Avatar, CashChart, Empty, FilePicker, Modal, PhotoPicker, Stars, Stat, Thumb} from './components';
import {dataUrlKb} from './images';
import {downloadFile, parseSave, readTextFile, saveFileName, saveToText} from './storage';

/* ============================== Контекст ============================== */

type Ctx = {
  s: Save;
  night: boolean;
  lvl: ReturnType<typeof levelInfo>;
  mutate: (fn: (draft: Save) => string | void) => void;
  notify: (text: string) => void;
  setTab: (t: Tab) => void;
  setPhotoForId: (id: number | null) => void;
  changeTime: (hours: number) => void;
  cloudSave: () => Promise<void>;
  cloudLoad: () => Promise<void>;
  exportFile: () => void;
  openImport: () => void;
  logged: boolean;
  role: string;
  email: string;
  setEmail: (v: string) => void;
  pass: string;
  setPass: (v: string) => void;
  promo: string;
  setPromo: (v: string) => void;
  login: () => Promise<void>;
  register: () => Promise<void>;
  redeemPromo: () => Promise<void>;
};

/* ============================== Навигация ============================== */

type TabDef = {id: Tab; icon: string; name: string; group: string};

const TABS: TabDef[] = [
  {id: 'home', icon: '⌂', name: 'Главная', group: 'Обзор'},
  {id: 'market', icon: '🛍️', name: 'Market', group: 'Торговля'},
  {id: 'zono', icon: '🛒', name: 'Zono', group: 'Торговля'},
  {id: 'official', icon: '🏪', name: 'Офиц. магазин', group: 'Торговля'},
  {id: 'black', icon: '🌙', name: 'Чёрный рынок', group: 'Торговля'},
  {id: 'repair', icon: '🔧', name: 'TechFix', group: 'Сервис'},
  {id: 'pc', icon: '🖥️', name: 'PC Lab', group: 'Сервис'},
  {id: 'os', icon: '💻', name: 'Моя ОС', group: 'Сервис'},
  {id: 'ship', icon: '📦', name: 'ShipGo', group: 'Сервис'},
  {id: 'bank', icon: '🏦', name: 'FinBank', group: 'Дела'},
  {id: 'biz', icon: '🏢', name: 'Бизнес', group: 'Дела'},
  {id: 'quests', icon: '🎯', name: 'Задания', group: 'Дела'},
  {id: 'profile', icon: '👤', name: 'Профиль', group: 'Дела'},
  {id: 'settings', icon: '⚙️', name: 'Настройки', group: 'Дела'},
];

const MOBILE_TABS: Tab[] = ['home', 'market', 'zono', 'official', 'pc', 'quests', 'profile', 'settings'];
const GROUPS = Array.from(new Set(TABS.map(t => t.group)));

/* ============================== Экраны ============================== */

function HomeView({ctx}: {ctx: Ctx}) {
  const {s, night, lvl, changeTime, setTab, mutate} = ctx;
  const readyQuests = s.quests.filter(q => !q.claimed && q.progress >= q.target).length;
  const brokenCount = s.inventory.filter(i => i.defect || i.broken).length;
  const totalValue = s.inventory.reduce((a, i) => a + (i.listPrice ?? i.base), 0);
  // Текущий день добавляем к истории на лету, иначе график отстаёт на день.
  const history = historyWithToday(s);
  const cashSeries = history.map(h => h.cash);

  return (
    <>
      <div className="hero">
        <div className="hero-row">
          <div>
            <h1>Перекуп</h1>
            <p style={{margin: 0}}>Покупай дешевле → проверяй → продавай дороже</p>
            <p className="small" style={{margin: '6px 0 0', opacity: 0.85}}>
              День {s.day}, {String(s.hour).padStart(2, '0')}:00 · {night ? '🌙 ночь' : '☀️ день'} · уровень {lvl.level} «{lvl.title}»
            </p>
          </div>
          <div className="btn-row">
            <button className="primary" onClick={() => changeTime(2)}>+2 часа ⏩</button>
            <button onClick={() => changeTime(6)}>+6 часов</button>
            <button onClick={() => changeTime(24)}>Следующий день →</button>
          </div>
        </div>
        <div className="progress" style={{marginTop: 16, background: 'rgba(255,255,255,.22)'}}>
          <i style={{width: `${Math.min(100, (s.cash / s.goal) * 100).toFixed(1)}%`, background: '#fff'}} />
        </div>
        <p className="small" style={{margin: '6px 0 0', opacity: 0.9}}>
          {money(s.cash)} из {money(s.goal)} · осталось {money(Math.max(0, s.goal - s.cash))}
        </p>
      </div>

      <div className="grid kpi">
        <Stat label="Капитал" value={money(s.cash)} spark={cashSeries} />
        <Stat label="Прибыль сегодня" value={money(s.dailyProfit)} delta={s.dailyProfit} deltaLabel="за день" />
        <Stat label="Товаров на руках" value={String(s.inventory.length)} />
        <Stat label="Репутация" value={s.reputation.toFixed(1)} />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>Динамика капитала</h2>
            <p className="muted small">Капитал по дням и прибыль каждого дня. Наведите курсор на график — увидите детали.</p>
          </div>
        </div>
        <CashChart history={history} />
      </div>

      <div className="grid two">
        <div className="panel">
          <h2>Что делать сейчас</h2>
          <div className="stack">
            <div className="row between"><span>🎯 Заданий готово к сдаче</span><b className={readyQuests ? 'good' : 'dim'}>{readyQuests}</b></div>
            <div className="row between"><span>⚠️ Требуют ремонта</span><b className={brokenCount ? 'warn' : 'dim'}>{brokenCount}</b></div>
            <div className="row between"><span>📦 Стоимость склада</span><b>{money(totalValue)}</b></div>
            <div className="row between"><span>💬 Предложений покупателей</span><b>{s.offers.filter(o => o.expires >= s.day).length}</b></div>
            <div className="row between"><span>🏦 Вклад / кредит</span><b>{money(s.deposit)} / {money(s.loan)}</b></div>
          </div>
          <div className="btn-row" style={{marginTop: 12}}>
            <button className="primary" onClick={() => setTab('market')}>За покупками</button>
            {brokenCount > 0 && <button onClick={() => setTab('repair')}>В ремонт</button>}
            {readyQuests > 0 && <button className="success" onClick={() => setTab('quests')}>Сдать задания</button>}
          </div>
        </div>

        <div className="panel">
          <h2>Журнал событий</h2>
          {s.log.length === 0 ? (
            <Empty text="Пока пусто. Купите или продайте что-нибудь — события появятся здесь." />
          ) : (
            <div className="feed">
              {s.log.slice(0, 40).map(e => (
                <div className="row-item" key={e.id}>
                  <span className="when">д{e.day} {String(e.hour).padStart(2, '0')}:00</span>
                  <span className={e.kind === 'good' ? 'good' : e.kind === 'bad' ? 'bad' : ''}>{e.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {night && (
        <div className="panel" style={{borderColor: 'var(--violet)'}}>
          <div className="row between wrap">
            <div>
              <h3 style={{margin: 0}}>🌙 Чёрный рынок открыт</h3>
              <p className="muted small" style={{margin: '4px 0 0'}}>Ночью дешевле закупка и быстрый сбыт — но растёт розыск. Розыск: {s.wanted}</p>
            </div>
            <button className="primary" onClick={() => setTab('black')}>Открыть</button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="row between wrap">
          <div>
            <h3 style={{margin: 0}}>Быстрая проверка склада</h3>
            <p className="muted small" style={{margin: '4px 0 0'}}>Проверить неисправные товары дешевле до продажи, чем терять на скидке.</p>
          </div>
          <button onClick={() => mutate(x => {
            const broken = x.inventory.filter(i => i.defect || i.broken);
            if (!broken.length) return 'Все товары в порядке';
            const cost = broken.length * 300;
            if (x.cash < cost) return `Проверка стоит ${money(cost)}`;
            x.cash -= cost;
            x.dailyProfit -= cost;
            return `Проверено ${broken.length} товаров за ${money(cost)}`;
          })}>Проверить всё за 300 ₽/шт.</button>
        </div>
      </div>
    </>
  );
}

function ItemRow({ctx, item, platform}: {ctx: Ctx; item: Item; platform?: 'market' | 'zono'}) {
  const {s, mutate, setPhotoForId} = ctx;
  const price = item.listPrice ?? item.base;
  const offers = s.offers.filter(o => o.itemId === item.id && o.expires >= s.day);
  const best = offers.length ? Math.max(...offers.map(o => o.price)) : 0;
  const margin = price - (item.purchasePrice ?? 0);
  const broken = item.broken || item.defect;
  const target = platform ?? (item.listedOn === 'zono' ? 'zono' : 'market');

  return (
    <div className="item">
      <Thumb item={item} />
      <div className="grow">
        <div className="row wrap" style={{gap: 8}}>
          <span className="name">{item.name}</span>
          {broken ? <span className="pill bad">⚠️ неисправен</span> : <span className="pill good">✓ рабочий</span>}
          {!!item.warrantyUntil && item.warrantyUntil >= s.day && <span className="pill accent">гарантия до д.{item.warrantyUntil}</span>}
          {item.note && <span className="pill">📝 {item.note}</span>}
        </div>
        <div className="sub">
          {item.category}
          {item.brand ? ` · ${item.brand}` : ''}
          {item.speed ? ` · ${item.speed} МБ/с` : ''}
          {item.reliability !== undefined ? ` · надёжность ${item.reliability}%` : ''}
          {item.boughtDay ? ` · куплен в д.${item.boughtDay}` : ''}
        </div>
        <div className="row wrap small" style={{gap: 10, marginTop: 4}}>
          <span>Цена: <b className="mono">{money(price)}</b></span>
          <span className="dim">закуп {money(item.purchasePrice ?? 0)}</span>
          <span className={margin >= 0 ? 'good' : 'bad'}>маржа {margin >= 0 ? '+' : ''}{money(margin)}</span>
          {best > 0 && <span className="warn">лучшее предложение {money(best)}</span>}
        </div>
        {offers.length > 0 && (
          <div className="stack" style={{marginTop: 8}}>
            {offers.map(o => (
              <div className="row between wrap" key={o.id} style={{gap: 8}}>
                <span className="small">{o.buyer} предлагает <b className="mono">{money(o.price)}</b></span>
                <button className="success sm" onClick={() => mutate(x => A.acceptOffer(x, o))}>Продать {o.buyer}</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="btn-row" style={{justifyContent: 'flex-end'}}>
        <button className="primary sm" onClick={() => mutate(x => A.sellItem(x, item.id, price))}>Продать за {shortMoney(price)}</button>
        <button className="sm" onClick={() => mutate(x => A.requestOffers(x, item.id, target))}>Предложения</button>
        <button className="ghost sm" onClick={() => setPhotoForId(item.id)}>📷 Фото</button>
      </div>
    </div>
  );
}

function MarketView({ctx, platform}: {ctx: Ctx; platform: 'market' | 'zono'}) {
  const {s, mutate} = ctx;
  const list = s.inventory.filter(i => i.listedOn === platform);
  const rating = reviewAverage(s, platform);
  const reviews = s.reviews.filter(r => r.platform === platform);

  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>{platform === 'market' ? '🛍️ Market' : '🛒 Zono'}</h2>
            <p className="muted small">
              {platform === 'market'
                ? 'Массовая площадка: много товара, средние цены, покупатели торгуются.'
                : 'Zono: закупка на 3% дешевле, аудитория поменьше, но лоты уходят быстрее.'}
            </p>
          </div>
          <div className="stack" style={{alignItems: 'flex-end'}}>
            <Stars value={rating} />
            <span className="tiny dim">{reviews.length} отзывов · больше отзывов → выше предложения</span>
          </div>
        </div>
        <div className="btn-row">
          <button className="primary" onClick={() => mutate(x => A.buyRandomItem(x, platform))}>Купить случайный товар</button>
          <button onClick={() => mutate(x => A.askReview(x, platform))}>Попросить отзыв</button>
        </div>
      </div>

      <div className="panel">
        <h3>Ваши лоты на площадке ({list.length})</h3>
        {list.length === 0 ? (
          <Empty text="Здесь пока нет товаров. Купите что-нибудь — лот появится автоматически." />
        ) : (
          <div className="list">{list.map(i => <ItemRow key={i.id} ctx={ctx} item={i} platform={platform} />)}</div>
        )}
      </div>

      <div className="panel">
        <h3>Отзывы</h3>
        {reviews.length === 0 ? (
          <Empty text="Отзывов пока нет. Продайте товар или попросите отзыв." />
        ) : (
          <div className="list">
            {reviews.slice(-8).reverse().map(r => (
              <div className="item" key={r.id}>
                <div className="grow">
                  <div className="row wrap" style={{gap: 8}}>
                    <Stars value={r.stars} />
                    <b>{r.author}</b>
                    <span className="tiny dim">день {r.day} · {r.kind === 'player' ? 'игрок' : 'покупатель'}</span>
                  </div>
                  <div className="small muted">{r.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function OfficialView({ctx}: {ctx: Ctx}) {
  const {s, mutate, setPhotoForId} = ctx;
  const items = s.inventory.filter(i => i.listedOn === 'official');
  return (
    <>
      <div className="panel">
        <h2>🏪 Официальный магазин</h2>
        <p className="muted small">
          Цена на <b>5% выше</b> Market/Zono, зато гарантия <b>10 игровых дней</b>. Возврат — только после
          подтверждённой неисправности, и он немного бьёт по репутации.
        </p>
        <div className="btn-row">
          <button onClick={() => mutate(x => A.buyOfficial(x, 'phone'))}>📱 Телефон + гарантия</button>
          <button onClick={() => mutate(x => A.buyOfficial(x, 'ssd'))}>💾 SSD + гарантия</button>
          <button onClick={() => mutate(x => A.buyOfficial(x, 'cpu'))}>🧠 CPU + гарантия</button>
          <button onClick={() => mutate(x => A.buyOfficial(x, 'gpu'))}>🎛️ GPU + гарантия</button>
        </div>
      </div>
      <div className="panel">
        <h3>Покупки с гарантией</h3>
        {items.length === 0 ? (
          <Empty text="Покупок с гарантией нет." />
        ) : (
          <div className="list">
            {items.map(i => {
              const active = !!i.warrantyUntil && i.warrantyUntil >= s.day;
              const canReturn = active && !!(i.broken || i.defect);
              return (
                <div className="item" key={i.id}>
                  <Thumb item={i} />
                  <div className="grow">
                    <div className="row wrap" style={{gap: 8}}>
                      <span className="name">{i.name}</span>
                      {active ? <span className="pill accent">гарантия до д.{i.warrantyUntil}</span> : <span className="pill">гарантия истекла</span>}
                      {i.broken || i.defect ? <span className="pill bad">неисправен</span> : <span className="pill good">рабочий</span>}
                    </div>
                    <div className="sub">Возврат: {money(i.purchasePrice ?? i.base)} · осталось {Math.max(0, (i.warrantyUntil ?? 0) - s.day)} д.</div>
                  </div>
                  <div className="btn-row">
                    <button className="sm" disabled={!canReturn} onClick={() => mutate(x => A.returnWarranty(x, i.id))}>Вернуть по гарантии</button>
                    <button className="ghost sm" onClick={() => setPhotoForId(i.id)}>📷 Фото</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function RepairView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  const broken = s.inventory.filter(i => i.defect || i.broken);
  return (
    <div className="panel">
      <h2>🔧 TechFix</h2>
      <p className="muted small">Ремонт стоит 1 200 ₽ и восстанавливает товар. Неисправный товар продаётся со скидкой — ремонт обычно выгоднее.</p>
      {broken.length === 0 ? (
        <Empty text="Поломок нет — все товары в порядке." />
      ) : (
        <div className="list">
          {broken.map(i => (
            <div className="item" key={i.id}>
              <Thumb item={i} />
              <div className="grow">
                <div className="row wrap" style={{gap: 8}}>
                  <span className="name">{i.name}</span>
                  <span className="pill bad">{i.broken ? 'не работает' : 'дефект'}</span>
                </div>
                <div className="sub">Сейчас уйдёт за {money((i.listPrice ?? i.base) * 0.7)} · после ремонта {money(i.listPrice ?? i.base)}</div>
              </div>
              <button className="primary sm" disabled={s.cash < 1200} onClick={() => mutate(x => A.repairItem(x, i.id))}>Ремонт 1 200 ₽</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PCView({ctx}: {ctx: Ctx}) {
  const {s, mutate, night} = ctx;
  const installed = Object.keys(s.pcParts).length;
  const cost = Object.values(s.pcParts).reduce((a, b) => a + (b.purchasePrice ?? b.base), 0);
  return (
    <>
      <div className="panel">
        <h2>🖥️ PC Lab</h2>
        <p className="muted small">
          Соберите ПК из {PC_PARTS.length} комплектующих и продайте на 25% дороже себестоимости.
          Дешёвые SSD ломаются чаще — смотрите надёжность.
        </p>
        <div className="row wrap" style={{gap: 10, marginBottom: 12}}>
          <span className="pill accent">Установлено {installed} из {PC_PARTS.length}</span>
          <span className="pill">Себестоимость {money(cost)}</span>
          <span className="pill good">Продажа ≈ {money(Math.round(cost * 1.25))}</span>
        </div>
        <div className="progress"><i style={{width: `${(installed / PC_PARTS.length) * 100}%`}} /></div>

        <div className="list" style={{marginTop: 12}}>
          {PC_PARTS.map(([id, name, price]) => {
            const part = s.pcParts[id];
            return (
              <div className="item" key={id}>
                <div className="thumb">{part ? (part.broken ? '✕' : '✓') : '·'}</div>
                <div className="grow">
                  <div className="row wrap" style={{gap: 8}}>
                    <span className="name">{name}</span>
                    {part && (part.broken ? <span className="pill bad">неисправна</span> : <span className="pill good">установлена</span>)}
                  </div>
                  <div className="sub">Базовая цена {money(price)} · Zono −3% · чёрный рынок −12% (только ночью)</div>
                </div>
                {!part && (
                  <div className="btn-row">
                    <button className="sm" onClick={() => mutate(x => A.buyPCComponent(x, id, price, 'Market', night))}>Market</button>
                    <button className="sm" onClick={() => mutate(x => A.buyPCComponent(x, id, price, 'Zono', night))}>Zono</button>
                    <button className="sm" disabled={!night} onClick={() => mutate(x => A.buyPCComponent(x, id, price, 'Чёрный рынок', night))}>Ночью</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="btn-row" style={{marginTop: 12}}>
          <button className="primary" disabled={installed < PC_PARTS.length} onClick={() => mutate(x => A.assemblePC(x))}>Собрать и продать ПК</button>
          <button className="ghost" disabled={installed === 0} onClick={() => mutate(x => {
            x.pcParts = {};
            return 'Сборка разобрана, детали списаны';
          })}>Разобрать сборку</button>
        </div>
      </div>

      <div className="panel">
        <h3>SSD: бренд, скорость и риск</h3>
        <div className="list">
          {SSD_CATALOG.map(d => (
            <div className="item" key={d.name}>
              <div className="grow">
                <div className="row wrap" style={{gap: 8}}>
                  <span className="name">{d.name}</span>
                  <span className={`pill ${d.reliability >= 80 ? 'good' : d.reliability >= 60 ? 'warn' : 'bad'}`}>надёжность {d.reliability}%</span>
                </div>
                <div className="sub">{d.brand} · {d.speed} МБ/с · риск брака {d.reliability < 55 ? 'высокий' : d.reliability < 80 ? 'средний' : 'низкий'}</div>
              </div>
              <button className="sm" onClick={() => mutate(x => A.buyCatalogPart(x, d.name, d.price, 'ssd'))}>Купить {shortMoney(d.price)}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid two">
        <div className="panel">
          <h3>Процессоры</h3>
          <div className="list">
            {CPU_CATALOG.map(d => (
              <div className="item" key={d[0]}>
                <div className="grow"><span className="name">{d[0]}</span></div>
                <button className="sm" onClick={() => mutate(x => A.buyCatalogPart(x, d[0], d[1], 'cpu'))}>Купить {shortMoney(d[1])}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3>Видеокарты</h3>
          <div className="list">
            {GPU_CATALOG.map(d => (
              <div className="item" key={d[0]}>
                <div className="grow"><span className="name">{d[0]}</span></div>
                <button className="sm" onClick={() => mutate(x => A.buyCatalogPart(x, d[0], d[1], 'gpu'))}>Купить {shortMoney(d[1])}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function OSView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  const [name, setName] = useState('');
  const [kernel, setKernel] = useState('Hybrid');
  const [features, setFeatures] = useState('');

  return (
    <>
      <div className="panel">
        <h2>💻 Лаборатория своей ОС</h2>
        <p className="muted small">Разработка стоит 5 000 ₽. Ядро и число функций влияют на спрос; обновления версии приносят доход с пользователей.</p>
        <label className="field">
          <span>Название системы</span>
          <input placeholder="Например, PerekupOS" value={name} maxLength={28} onChange={e => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Ядро</span>
          <select value={kernel} onChange={e => setKernel(e.target.value)}>
            <option value="Monolith">Monolith — классика, стабильно</option>
            <option value="Microkernel">Microkernel — надёжно, дороже</option>
            <option value="Hybrid">Hybrid — лучший баланс</option>
          </select>
        </label>
        <label className="field">
          <span>Функции через запятую</span>
          <input placeholder="магазин приложений, тёмная тема, облако" value={features} onChange={e => setFeatures(e.target.value)} />
        </label>
        <button className="primary" onClick={() => {
          if (!name.trim()) return ctx.notify('Введите название ОС');
          const list = features.split(',').map(v => v.trim()).filter(Boolean);
          mutate(x => A.createOsProject(x, name, kernel, list));
          setName('');
          setFeatures('');
        }}>Создать ОС за 5 000 ₽</button>
      </div>

      <div className="panel">
        <h3>Ваши системы ({s.osProjects.length})</h3>
        {s.osProjects.length === 0 ? (
          <Empty text="Пока ни одной ОС. Создайте первую — это отдельная ветка дохода." />
        ) : (
          <div className="grid cards">
            {s.osProjects.map(o => {
              const v = Number(o.version) || 1;
              return (
                <div className="card" key={o.name}>
                  <div className="row between">
                    <h3 style={{margin: 0}}>{o.name}</h3>
                    <span className="pill accent">v{o.version}</span>
                  </div>
                  <p className="small muted" style={{margin: '6px 0'}}>
                    Ядро: {o.kernel} · создана в день {o.createdDay} · {o.users.toLocaleString('ru-RU')} пользователей
                  </p>
                  <div className="row wrap" style={{gap: 6, marginBottom: 10}}>
                    {o.features.length ? o.features.map(f => <span className="pill" key={f}>{f}</span>) : <span className="tiny dim">без доп. функций</span>}
                  </div>
                  <button className="sm block" onClick={() => mutate(x => A.upgradeOs(x, o.name))}>
                    Обновить до v{(v + 0.1).toFixed(1)} — {money(3000 * v)}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function ShipView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  const shippable = s.inventory.filter(i => i.listedOn && i.listedOn !== 'black');
  return (
    <>
      <div className="panel">
        <h2>📦 ShipGo</h2>
        <p className="muted small">Отправка занимает один игровой день. После доставки товар уходит покупателю.</p>
        {shippable.length === 0 ? (
          <Empty text="Нет товаров для отправки." />
        ) : (
          <div className="list">
            {shippable.map(i => (
              <div className="item" key={i.id}>
                <Thumb item={i} size="sm" />
                <div className="grow">
                  <span className="name">{i.name}</span>
                  <div className="sub">Оценка {money(i.listPrice ?? i.base)}</div>
                </div>
                <button className="sm" onClick={() => mutate(x => A.shipItem(x, i.id))}>Отправить</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="panel">
        <h3>Отправления</h3>
        {s.shipments.length === 0 ? (
          <Empty text="Активных отправлений нет." />
        ) : (
          <div className="list">
            {s.shipments.map(q => (
              <div className="item" key={q.id}>
                <div className="grow"><span className="name">{q.item}</span></div>
                <span className={`pill ${q.status === 'Доставлено' ? 'good' : 'warn'}`}>
                  {q.status}{q.status === 'В пути' ? ` · ${q.days} д.` : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function BankView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  const limit = 50000 + Math.round(s.reputation * 10000);
  return (
    <div className="panel">
      <h2>🏦 FinBank</h2>
      <div className="grid kpi" style={{marginBottom: 16}}>
        <Stat label="Наличные" value={money(s.cash)} />
        <Stat label="Вклад" value={money(s.deposit)} delta={Math.round(s.deposit * 0.002)} deltaLabel="в день" />
        <Stat label="Кредит" value={money(s.loan)} delta={-Math.round(s.loan * 0.01)} deltaLabel="проценты в день" />
        <Stat label="Лимит кредита" value={money(limit)} />
      </div>
      <div className="btn-row">
        <button onClick={() => mutate(x => A.depositMoney(x, 1000))}>Внести 1 000 ₽</button>
        <button onClick={() => mutate(x => A.depositMoney(x, 10000))}>Внести 10 000 ₽</button>
        <button onClick={() => mutate(x => A.withdrawMoney(x, 1000))}>Снять 1 000 ₽</button>
        <button onClick={() => mutate(x => A.takeLoan(x, 10000))}>Кредит 10 000 ₽</button>
        <button onClick={() => mutate(x => A.repayLoan(x, 10000))} disabled={s.loan === 0}>Погасить 10 000 ₽</button>
        <button className="danger" onClick={() => mutate(x => A.repayLoan(x, x.loan))} disabled={s.loan === 0}>Погасить весь кредит</button>
      </div>
      <p className="small muted" style={{marginTop: 12}}>Вклад даёт 0,2% в день, кредит стоит 1% в день. Лимит зависит от репутации.</p>
    </div>
  );
}

function BizView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  return (
    <div className="panel">
      <h2>🏢 Бизнес</h2>
      <p className="muted small">Пассивный доход начисляется каждый новый день. Каждый бизнес — +1 200 ₽ в день.</p>
      <div className="grid kpi" style={{marginBottom: 16}}>
        <Stat label="Доход в день" value={money(s.bizIncome)} />
        <Stat label="За 30 дней" value={money(s.bizIncome * 30)} />
        <Stat label="Окупаемость" value={s.bizIncome ? `${Math.ceil(25000 / s.bizIncome)} дн.` : '—'} />
      </div>
      <button className="primary" disabled={s.cash < 25000} onClick={() => mutate(x => A.buyBusiness(x))}>Открыть бизнес за 25 000 ₽</button>
    </div>
  );
}

function BlackView({ctx}: {ctx: Ctx}) {
  const {s, mutate, night} = ctx;
  const black = s.inventory.filter(i => i.listedOn === 'black');
  return (
    <div className="panel">
      <h2>🌙 Чёрный рынок</h2>
      {!night ? (
        <p className="muted">Откроется в 22:00. Сейчас {String(s.hour).padStart(2, '0')}:00 — прокрутите время на главной.</p>
      ) : (
        <>
          <p className="muted small">Закупка дешевле на 12%, сбыт быстрый. Каждая сделка повышает розыск; штраф — 1 500 ₽ за уровень.</p>
          <div className="row wrap" style={{gap: 10, marginBottom: 12}}>
            <span className={`pill ${s.wanted >= 4 ? 'bad' : s.wanted >= 2 ? 'warn' : 'good'}`}>Розыск: {s.wanted} / 5</span>
            <span className="pill">Штраф: {money(1500 * s.wanted)}</span>
          </div>
          <div className="btn-row">
            <button className="primary" onClick={() => mutate(x => A.blackBuy(x, night))}>Купить технику — 8 000 ₽</button>
            <button className="danger" disabled={s.wanted === 0} onClick={() => mutate(x => A.payFine(x))}>Оплатить штраф</button>
          </div>
          <h3 style={{marginTop: 20}}>Товары на сбыт</h3>
          {black.length === 0 ? (
            <Empty text="Нет товаров с чёрного рынка." />
          ) : (
            <div className="list">
              {black.map(i => (
                <div className="item" key={i.id}>
                  <Thumb item={i} />
                  <div className="grow">
                    <span className="name">{i.name}</span>
                    <div className="sub">Оценка {money(Math.round((i.listPrice ?? i.base) * 0.95))}</div>
                  </div>
                  <button className="sm" onClick={() => mutate(x => A.blackSell(x, i.id, night))}>Продать</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestsView({ctx}: {ctx: Ctx}) {
  const {s, mutate} = ctx;
  const ready = s.quests.filter(q => !q.claimed && q.progress >= q.target).length;
  return (
    <>
      <div className="panel">
        <div className="panel-head">
          <div>
            <h2>🎯 Ежедневные задания</h2>
            <p className="muted small">Обновляются каждый игровой день. За выполнение — деньги и опыт.</p>
          </div>
          <span className="pill accent">Готово к сдаче: {ready}</span>
        </div>
        <div className="list">
          {s.quests.map(q => {
            const done = q.progress >= q.target;
            const pct = Math.min(100, (q.progress / q.target) * 100);
            return (
              <div className="item" key={q.id}>
                <div className="grow">
                  <div className="row between wrap" style={{gap: 8}}>
                    <b>{q.title}</b>
                    <span className="tiny dim">{q.progress} / {q.target}</span>
                  </div>
                  <div className="small muted" style={{margin: '2px 0 6px'}}>{q.desc}</div>
                  <div className={`progress ${done ? 'good' : ''}`}><i style={{width: `${pct}%`}} /></div>
                  <div className="tiny dim" style={{marginTop: 4}}>Награда: {money(q.reward)} · {q.xp} XP</div>
                </div>
                <button
                  className={done && !q.claimed ? 'success' : 'ghost'}
                  disabled={!done || q.claimed}
                  onClick={() => mutate(x => A.claimQuest(x, q.id))}
                >
                  {q.claimed ? 'Получено' : done ? 'Забрать' : 'В процессе'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <h2>🏆 Достижения</h2>
        <p className="muted small">Открыто {s.achievements.length} из {ACHIEVEMENTS.length}.</p>
        <div className="grid two">
          {ACHIEVEMENTS.map(a => {
            const unlocked = s.achievements.includes(a.id);
            return (
              <div className={`ach ${unlocked ? '' : 'locked'}`} key={a.id}>
                <span className="ico">{unlocked ? a.icon : '🔒'}</span>
                <div>
                  <b>{a.title}</b>
                  <div className="tiny dim">{a.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function ProfileView({ctx}: {ctx: Ctx}) {
  const {s, mutate, notify, lvl} = ctx;
  const [nick, setNick] = useState(s.profile.nick);
  const [bio, setBio] = useState(s.profile.bio);
  const st = s.stats;
  const rows: [string, string][] = [
    ['Куплено товаров', String(st.bought)],
    ['Продано товаров', String(st.sold)],
    ['Лучшая сделка', money(st.bestSale)],
    ['Ремонтов', String(st.repaired)],
    ['Сделок на чёрном рынке', String(st.blackDeals)],
    ['Собрано ПК', String(st.pcBuilt)],
    ['Создано ОС', String(st.osCreated)],
    ['Отправлений', String(st.shipped)],
    ['Возвратов по гарантии', String(s.returns)],
    ['Промокодов активировано', String(st.promoUsed)],
  ];
  return (
    <>
      <div className="panel">
        <div className="row wrap" style={{gap: 20, alignItems: 'flex-start'}}>
          <div className="stack" style={{alignItems: 'center'}}>
            <Avatar src={s.profile.avatar} nick={s.profile.nick} />
            <span className="pill accent">Уровень {lvl.level}</span>
          </div>
          <div style={{flex: 1, minWidth: 260}}>
            <h2 style={{marginBottom: 4}}>{s.profile.nick}</h2>
            <p className="muted small" style={{marginBottom: 12}}>{s.profile.bio || 'Описание не заполнено'}</p>
            <div className="row between small"><span>«{lvl.title}»</span><span className="mono">{lvl.into} / {lvl.span} XP</span></div>
            <div className="progress" style={{marginTop: 6}}><i style={{width: `${lvl.pct}%`}} /></div>
            <div className="tiny dim" style={{marginTop: 4}}>Всего опыта: {s.xp} · до уровня {lvl.level + 1}: {Math.max(0, lvl.next - s.xp)} XP</div>
            <div className="row wrap" style={{gap: 10, marginTop: 12}}>
              <span className="pill">⭐ Репутация {s.reputation.toFixed(1)}</span>
              <span className="pill">🏆 {s.achievements.length} достижений</span>
              <span className="pill">📅 День {s.day}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Фото профиля</h3>
        <p className="muted small">Квадратное фото обрезается автоматически и сжимается до 256 px.</p>
        <div className="grid two">
          <PhotoPicker
            label="Загрузить аватар"
            square
            max={256}
            value={s.profile.avatar}
            onError={notify}
            preview={<Avatar src={s.profile.avatar} nick={s.profile.nick} size={64} />}
            onChange={dataUrl => mutate(x => {
              if (dataUrl) x.profile.avatar = dataUrl;
              else delete x.profile.avatar;
              return dataUrl ? 'Аватар обновлён' : 'Аватар удалён';
            })}
          />
          <div className="stack">
            <label className="field">
              <span>Никнейм</span>
              <input value={nick} maxLength={24} onChange={e => setNick(e.target.value)} />
            </label>
            <label className="field">
              <span>О себе</span>
              <textarea value={bio} maxLength={200} placeholder="Чем торгуете, что ищете" onChange={e => setBio(e.target.value)} />
            </label>
            <button className="primary" onClick={() => mutate(x => {
              x.profile.nick = nick.trim() || 'Перекуп';
              x.profile.bio = bio.trim();
              return 'Профиль сохранён';
            })}>Сохранить профиль</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Статистика</h3>
        <table>
          <tbody>
            {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td className="num"><b>{v}</b></td></tr>)}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SettingsView({ctx}: {ctx: Ctx}) {
  const {s, mutate, notify, cloudSave, cloudLoad, exportFile, openImport, logged, role, email, setEmail, pass, setPass, promo, setPromo, login, register, redeemPromo} = ctx;
  const themes: [Theme, string][] = [['auto', 'Как в системе'], ['light', 'Светлая'], ['dark', 'Тёмная']];
  const photos = s.inventory.filter(i => i.photo);
  const photosKb = photos.reduce((a, i) => a + dataUrlKb(i.photo!), 0);

  return (
    <>
      <div className="panel">
        <h2>🎨 Внешний вид</h2>
        <label className="field">
          <span>Тема</span>
          <div className="seg" style={{display: 'flex'}}>
            {themes.map(([id, label]) => (
              <button key={id} className={s.settings.theme === id ? 'on' : ''} style={{flex: 1}}
                      onClick={() => mutate(x => {
                        x.settings.theme = id;
                        return `Тема: ${label}`;
                      })}>{label}</button>
            ))}
          </div>
        </label>
        <div className="btn-row">
          <button onClick={() => mutate(x => {
            x.settings.reduceMotion = !x.settings.reduceMotion;
            return x.settings.reduceMotion ? 'Анимации выключены' : 'Анимации включены';
          })}>Анимации: {s.settings.reduceMotion ? 'ВЫКЛ' : 'ВКЛ'}</button>
          <button onClick={() => mutate(x => {
            x.settings.compact = !x.settings.compact;
            return x.settings.compact ? 'Компактный режим включён' : 'Компактный режим выключен';
          })}>Компактный режим: {s.settings.compact ? 'ВКЛ' : 'ВЫКЛ'}</button>
        </div>
      </div>

      <div className="panel">
        <h2>⚙️ Сохранение</h2>
        <div className="btn-row">
          <button onClick={() => mutate(x => {
            saveLocal(x);
            return 'Сохранено на устройстве';
          })}>Сохранить локально</button>
          <button className="primary" onClick={cloudSave}>Сохранить в облако</button>
          <button onClick={cloudLoad}>Загрузить из облака</button>
          <button onClick={() => mutate(x => {
            x.settings.autosave = !x.settings.autosave;
            return x.settings.autosave ? 'Автосохранение включено' : 'Автосохранение выключено';
          })}>Автосохранение: {s.settings.autosave ? 'ВКЛ' : 'ВЫКЛ'}</button>
        </div>
        <h3 style={{marginTop: 20}}>Файл сохранения</h3>
        <p className="muted small">Выгрузите прогресс в JSON-файл, чтобы перенести его на другое устройство или сделать резервную копию.</p>
        <div className="btn-row">
          <button onClick={exportFile}>⬇️ Скачать файл</button>
          <button onClick={openImport}>⬆️ Загрузить из файла</button>
        </div>
        <p className="tiny dim" style={{marginTop: 8}}>Фото товаров: {photos.length} шт., ≈ {photosKb} КБ внутри сохранения.</p>
      </div>

      <div className="panel">
        <h2>🎯 Цель</h2>
        <p className="muted small">Текущая цель: {money(s.goal)}. Прогресс: {Math.min(100, (s.cash / s.goal) * 100).toFixed(0)}%.</p>
        <div className="btn-row">
          {[100000, 250000, 500000, 1000000].map(g => (
            <button key={g} className={s.goal === g ? 'primary' : ''} onClick={() => mutate(x => A.setGoal(x, g))}>{shortMoney(g)}</button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>🔐 Аккаунт</h2>
        <p className="small muted">Статус: {logged ? 'выполнен вход' : 'без аккаунта'} · роль: {role}</p>
        {!logged ? (
          <>
            <label className="field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
            <label className="field"><span>Пароль</span><input type="password" value={pass} onChange={e => setPass(e.target.value)} /></label>
            <div className="btn-row">
              <button className="primary" onClick={login}>Войти</button>
              <button onClick={register}>Регистрация</button>
            </div>
          </>
        ) : (
          <button className="ghost" onClick={async () => {
            await supabase.auth.signOut();
            notify('Вы вышли из аккаунта');
          }}>Выйти</button>
        )}
      </div>

      <div className="panel">
        <h2>🎁 Промокод</h2>
        <div className="row wrap" style={{gap: 8}}>
          <input style={{flex: 1, minWidth: 180}} placeholder="Введите промокод" value={promo} onChange={e => setPromo(e.target.value)} />
          <button className="primary" onClick={redeemPromo}>Активировать</button>
        </div>
        <p className="small muted" style={{marginTop: 8}}>Активировано: {s.promoUsed.length}</p>
        {role === 'admin' && <p className="small warn">Админ: промокоды управляются в таблице promo_codes Supabase.</p>}
      </div>

      <div className="panel">
        <h2>⚠️ Опасная зона</h2>
        <p className="muted small">Новая игра полностью очистит текущий прогресс на этом устройстве.</p>
        <button className="danger" onClick={() => {
          if (!window.confirm('Начать новую игру? Текущий прогресс будет удалён.')) return;
          const n = initialSave();
          saveLocal(n);
          window.location.reload();
        }}>Новая игра</button>
      </div>
    </>
  );
}

/* ================================ App ================================ */

export default function App() {
  const [s, setS] = useState<Save>(() => loadLocal() || initialSave());
  const [tab, setTab] = useState<Tab>('home');
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [promo, setPromo] = useState('');
  const [logged, setLogged] = useState(false);
  const [role, setRole] = useState('player');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [boot, setBoot] = useState(true);
  const [guest, setGuest] = useState(false);
  const [photoForId, setPhotoForId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const night = s.hour >= 22 || s.hour < 6;
  const lvl = levelInfo(s.xp);
  const photoFor = photoForId === null ? null : s.inventory.find(i => i.id === photoForId) ?? null;

  const notify = useCallback((text: string) => {
    setMsg(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setMsg(''), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  /* Тема и режимы живут на <html>, чтобы их видели CSS и prefers-color-scheme. */
  useEffect(() => {
    const root = document.documentElement;
    if (s.settings.theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = s.settings.theme;
    root.dataset.motion = s.settings.reduceMotion ? 'off' : 'on';
    root.dataset.compact = s.settings.compact ? 'on' : 'off';
  }, [s.settings.theme, s.settings.reduceMotion, s.settings.compact]);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({data}) => {
        if (data.session) {
          setLogged(true);
          await loadProfile(data.session.user.id);
        }
        setBoot(false);
      })
      .catch(() => setBoot(false));
    const {data} = supabase.auth.onAuthStateChange((_e, session) => {
      setLogged(!!session);
      if (session) void loadProfile(session.user.id);
      else setRole('player');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const {data} = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    setRole(data?.role || 'player');
  }

  /**
   * Единственная точка изменения состояния: клонируем сохранение, применяем
   * мутацию, проверяем достижения, пишем автосохранение и показываем тост.
   */
  const mutate = useCallback(
    (fn: (draft: Save) => string | void) => {
      const draft = structuredClone(s) as Save;
      const result = fn(draft);
      const unlocked = unlockAchievements(draft);
      setS(draft);
      if (draft.settings.autosave) saveLocal(draft);
      const parts: string[] = [];
      if (typeof result === 'string' && result) parts.push(result);
      if (unlocked.length) parts.push(`🏆 ${unlocked.join(' · ')}`);
      if (parts.length) notify(parts.join(' · '));
    },
    [s, notify],
  );

  const changeTime = useCallback((hours: number) => mutate(x => A.advanceTime(x, hours)), [mutate]);

  const cloudSave = async () => {
    if (!logged) return notify('Сначала войдите в аккаунт');
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return notify('Сессия не найдена');
    const payload = {save_data: s, updated_at: new Date().toISOString()};
    const existing = await supabase.from('game_saves').select('user_id').eq('user_id', user.id).maybeSingle();
    if (existing.error) return notify(existing.error.message);
    const r = existing.data
      ? await supabase.from('game_saves').update(payload).eq('user_id', user.id)
      : await supabase.from('game_saves').insert({user_id: user.id, ...payload});
    notify(r.error ? r.error.message : 'Сохранено в облако');
  };

  const cloudLoad = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return notify('Войдите в аккаунт');
    const {data, error} = await supabase.from('game_saves').select('save_data').eq('user_id', user.id).maybeSingle();
    if (error) return notify(error.message);
    if (!data?.save_data) return notify('Сохранение не найдено');
    const n = normalizeSave(data.save_data as Save);
    setS(n);
    saveLocal(n);
    notify('Загружено из облака');
  };

  const login = async () => {
    const r = await supabase.auth.signInWithPassword({email, password: pass});
    if (r.error) return notify(r.error.message);
    setLogged(true);
    await loadProfile(r.data.user.id);
    notify('Вход выполнен');
  };

  const register = async () => {
    if (!email.includes('@')) return notify('Введите корректный email');
    if (pass.length < 6) return notify('Пароль минимум 6 символов');
    const r = await supabase.auth.signUp({email, password: pass});
    notify(r.error ? r.error.message : r.data.session ? 'Аккаунт создан' : 'Проверьте почту для подтверждения');
  };

  const redeemPromo = async () => {
    if (!logged) return notify('Войдите в аккаунт');
    const code = promo.trim();
    if (!code) return notify('Введите промокод');
    const {data, error} = await supabase.from('promo_codes').select('id,amount,active').eq('code', code).eq('active', true).maybeSingle();
    if (error || !data) return notify('Промокод не найден');
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return notify('Сессия не найдена');
    const r = await supabase.from('promo_redemptions').insert({promo_code_id: data.id, user_id: uid});
    if (r.error) return notify(r.error.code === '23505' ? 'Промокод уже использован' : r.error.message);
    const amount = Math.round(Number(data.amount));
    setPromo('');
    mutate(x => {
      x.cash += amount;
      x.promoUsed.push(code);
      x.stats.promoUsed++;
      return `Промокод активирован: +${money(amount)}`;
    });
  };

  const exportFile = () => {
    downloadFile(saveFileName(s), saveToText(s));
    notify('Файл сохранения скачан');
  };

  const applyImported = (text: string) => {
    try {
      const n = parseSave(text);
      setS(n);
      saveLocal(n);
      setImportOpen(false);
      setImportText('');
      notify(`Импортировано: день ${n.day}, ${money(n.cash)}`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Некорректное сохранение');
    }
  };

  const importFile = async (file: File) => {
    try {
      applyImported(await readTextFile(file));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось прочитать файл');
    }
  };

  const ctx: Ctx = {
    s, night, lvl, mutate, notify, setTab, setPhotoForId, changeTime,
    cloudSave, cloudLoad, exportFile, openImport: () => setImportOpen(true),
    logged, role, email, setEmail, pass, setPass, promo, setPromo, login, register, redeemPromo,
  };

  /* Экраны определены на уровне модуля, поэтому их локальный state (поля форм)
     не сбрасывается при обновлении сохранения. */
  const renderTab = () => {
    switch (tab) {
      case 'home': return <HomeView ctx={ctx} />;
      case 'market': return <MarketView ctx={ctx} platform="market" />;
      case 'zono': return <MarketView ctx={ctx} platform="zono" />;
      case 'official': return <OfficialView ctx={ctx} />;
      case 'repair': return <RepairView ctx={ctx} />;
      case 'pc': return <PCView ctx={ctx} />;
      case 'os': return <OSView ctx={ctx} />;
      case 'ship': return <ShipView ctx={ctx} />;
      case 'bank': return <BankView ctx={ctx} />;
      case 'biz': return <BizView ctx={ctx} />;
      case 'black': return <BlackView ctx={ctx} />;
      case 'quests': return <QuestsView ctx={ctx} />;
      case 'profile': return <ProfileView ctx={ctx} />;
      case 'settings': return <SettingsView ctx={ctx} />;
      default: return null;
    }
  };

  if (boot) {
    return (
      <div className="auth-wrap">
        <div className="auth panel center">
          <div className="logo-big">📦</div>
          <h2>Загрузка…</h2>
        </div>
      </div>
    );
  }

  if (!logged && !guest && tab === 'home') {
    return (
      <div className="auth-wrap">
        <div className="auth panel">
          <div className="logo-big">📦</div>
          <h1 className="center" style={{fontSize: 28}}>Перекуп</h1>
          <p className="muted center small">
            Покупай дешевле → проверяй → продавай дороже. Прогресс хранится на устройстве, а с аккаунтом — ещё и в облаке.
          </p>
          <div className="seg" style={{display: 'flex', marginBottom: 12}}>
            <button className={authMode === 'register' ? 'on' : ''} style={{flex: 1}} onClick={() => setAuthMode('register')}>Регистрация</button>
            <button className={authMode === 'login' ? 'on' : ''} style={{flex: 1}} onClick={() => setAuthMode('login')}>Логин</button>
          </div>
          <label className="field">
            <span>Email</span>
            <input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Пароль</span>
            <input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} placeholder="минимум 6 символов" value={pass} onChange={e => setPass(e.target.value)} />
          </label>
          <button className="primary block" onClick={authMode === 'register' ? register : login}>
            {authMode === 'register' ? 'Зарегистрироваться' : 'Войти'}
          </button>
          <button className="ghost block" style={{marginTop: 8}} onClick={() => setGuest(true)}>Продолжить без аккаунта</button>
        </div>
      </div>
    );
  }

  const readyQuests = s.quests.filter(q => !q.claimed && q.progress >= q.target).length;
  const brokenCount = s.inventory.filter(i => i.defect || i.broken).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="logo">📦</span> Перекуп</div>
        <div className="topbar-stats">
          <span className="chip">📅 День {s.day} · {String(s.hour).padStart(2, '0')}:00</span>
          <span className="chip accent hide-sm">💰 {money(s.cash)}</span>
          <span className="chip hide-sm">⭐ {s.reputation.toFixed(1)}</span>
          <span className="chip">Ур. {lvl.level}</span>
        </div>
      </header>

      <div className="layout">
        <nav className="sidebar" aria-label="Разделы игры">
          {GROUPS.map(g => (
            <React.Fragment key={g}>
              <div className="navgroup">{g}</div>
              {TABS.filter(t => t.group === g).map(t => (
                <button key={t.id} className={`navbtn ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
                  <span className="ico">{t.icon}</span>
                  <span>{t.name}</span>
                  {t.id === 'quests' && readyQuests > 0 && <span className="badge">{readyQuests}</span>}
                  {t.id === 'repair' && brokenCount > 0 && <span className="badge">{brokenCount}</span>}
                  {t.id === 'black' && night && <span className="badge">!</span>}
                </button>
              ))}
            </React.Fragment>
          ))}
        </nav>

        <main className="content">{renderTab()}</main>
      </div>

      <nav className="tabbar" aria-label="Разделы игры">
        {MOBILE_TABS.map(id => {
          const t = TABS.find(v => v.id === id)!;
          return (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <span className="ico">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          );
        })}
      </nav>

      {photoFor && (
        <Modal title={`Фото: ${photoFor.name}`} onClose={() => setPhotoForId(null)}>
          <PhotoPicker
            label="Загрузить фото товара"
            max={512}
            value={photoFor.photo}
            onError={notify}
            preview={<Thumb item={photoFor} size="lg" />}
            onChange={dataUrl => {
              mutate(x => A.attachPhoto(x, photoFor.id, dataUrl));
              setPhotoForId(null);
            }}
          />
          <label className="field" style={{marginTop: 16}}>
            <span>Заметка к товару</span>
            <input
              key={`note-${photoFor.id}`}
              defaultValue={photoFor.note ?? ''}
              placeholder="Например: скол на углу, торг от 30 000"
              onBlur={e => mutate(x => A.setItemNote(x, photoFor.id, e.target.value.trim()))}
            />
          </label>
          <label className="field">
            <span>Своя цена продажи</span>
            <input
              key={`price-${photoFor.id}`}
              type="number"
              min={1}
              defaultValue={photoFor.listPrice ?? photoFor.base}
              onBlur={e => mutate(x => A.setListPrice(x, photoFor.id, Number(e.target.value)))}
            />
          </label>
          <p className="tiny dim">Фото сжимается до 512 px и хранится прямо в сохранении.</p>
        </Modal>
      )}

      {importOpen && (
        <Modal
          title="Загрузка сохранения"
          onClose={() => setImportOpen(false)}
          footer={
            <>
              <button className="ghost" onClick={() => setImportOpen(false)}>Отмена</button>
              <button className="primary" disabled={!importText.trim()} onClick={() => applyImported(importText)}>Импортировать текст</button>
            </>
          }
        >
          <FilePicker
            label="Выбрать JSON-файл сохранения"
            accept="application/json,.json"
            hint="Файл, скачанный кнопкой «Скачать файл»"
            onFile={file => void importFile(file)}
          />
          <label className="field" style={{marginTop: 16}}>
            <span>…или вставьте JSON вручную</span>
            <textarea style={{minHeight: 140}} value={importText} placeholder='{"cash":50000,"day":1,...}' onChange={e => setImportText(e.target.value)} />
          </label>
          <p className="tiny dim">Импорт заменит текущий прогресс на этом устройстве.</p>
        </Modal>
      )}

      {msg && <div className="toast" role="status">{msg}</div>}
    </div>
  );
}
