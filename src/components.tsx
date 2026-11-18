import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {HistoryPoint, Item} from './types';
import {CATEGORY_ICONS, money, shortMoney} from './game';
import {IMAGE_ACCEPT, fileToImage} from './images';

/* ============================ Фото и файлы ============================ */

/** Плитка фото товара: если фото нет — иконка категории. */
export function Thumb({item, size = ''}: {item: Item; size?: '' | 'sm' | 'lg'}) {
  const cls = `thumb ${size}`.trim();
  if (item.photo) return <img className={cls} src={item.photo} alt={item.name} loading="lazy" />;
  return (
    <div className={cls} aria-hidden="true" title="Фото не загружено">
      {CATEGORY_ICONS[item.category] ?? '📦'}
    </div>
  );
}

export function Avatar({src, nick, size = 92}: {src?: string; nick: string; size?: number}) {
  if (src) return <img className="avatar" style={{width: size, height: size}} src={src} alt="" />;
  return (
    <div className="avatar" style={{width: size, height: size, fontSize: Math.round(size / 2.7)}} aria-hidden="true">
      {nick.trim().charAt(0).toUpperCase() || 'П'}
    </div>
  );
}

type PhotoPickerProps = {
  label: string;
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  onError: (message: string) => void;
  square?: boolean;
  max?: number;
  preview?: React.ReactNode;
};

/** Выбор фото: клик или перетаскивание файла. Файл сжимается в canvas. */
export function PhotoPicker({label, value, onChange, onError, square = false, max = 512, preview}: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const handle = useCallback(
    async (file: File | undefined | null) => {
      if (!file) return;
      setBusy(true);
      try {
        const dataUrl = await fileToImage(file, {max, square, quality: 0.82});
        onChange(dataUrl);
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    },
    [max, square, onChange, onError],
  );

  return (
    <div>
      <div
        className={`drop ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files?.[0]);
        }}
      >
        {preview}
        <div>
          <b>{busy ? 'Обработка…' : label}</b>
          <div className="tiny dim">Нажмите или перетащите файл · PNG, JPG, WEBP · до 15 МБ</div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        style={{display: 'none'}}
        onChange={e => void handle(e.target.files?.[0])}
      />
      {value && (
        <div className="btn-row" style={{marginTop: 8}}>
          <button className="ghost sm" type="button" onClick={() => onChange(undefined)}>
            Убрать фото
          </button>
        </div>
      )}
    </div>
  );
}

type FilePickerProps = {
  label: string;
  accept: string;
  hint?: string;
  onFile: (file: File) => void;
};

/** Универсальный выбор файла (не только изображения): клик или перетаскивание. */
export function FilePicker({label, accept, hint, onFile}: FilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div>
      <div
        className={`drop ${over ? 'over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={e => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={e => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <div style={{fontSize: 24}} aria-hidden="true">📄</div>
        <div>
          <b>{label}</b>
          {hint && <div className="tiny dim">{hint}</div>}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{display: 'none'}}
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ============================ Графики ============================ */
/* Спецификации: линия 2px, заливка 10%, сетка hairline, точка ≥8px
   с кольцом цвета поверхности, тултип по наведению, таблица как fallback. */

export function Sparkline({points, width = 120, height = 30}: {points: number[]; width?: number; height?: number}) {
  if (points.length < 2) return <div className="tiny dim">нет данных</div>;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(' ');
  const lastX = width;
  const lastY = height - 2 - ((points[points.length - 1] - min) / span) * (height - 4);
  return (
    <svg className="chart spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Динамика капитала">
      <path className="line" d={d} />
      <circle className="dot" cx={lastX} cy={lastY} r={3} />
    </svg>
  );
}

type CashChartProps = {history: HistoryPoint[]};

/** Линия капитала по дням + столбцы дневной прибыли. Одна ось, тултип, таблица. */
export function CashChart({history}: CashChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const data = useMemo(() => history.slice(-30), [history]);

  if (data.length < 2) {
    return (
      <div className="stack">
        <p className="muted small" style={{margin: 0}}>
          График появится, когда пройдёт хотя бы один игровой день — нажмите «Изменить время».
        </p>
      </div>
    );
  }

  const W = 720;
  const H = 220;
  const padL = 56;
  const padR = 16;
  const padT = 14;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const cashValues = data.map(d => d.cash);
  const maxCash = Math.max(...cashValues);
  const minCash = Math.min(...cashValues, 0);
  const top = maxCash * 1.08 || 1;
  const bottom = Math.min(0, minCash);
  const span = top - bottom || 1;

  const x = (i: number) => padL + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - bottom) / span) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.cash).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

  const ticks = [0, 0.5, 1].map(t => bottom + span * t);
  const first = data[0];
  const last = data[data.length - 1];
  const change = last.cash - first.cash;
  const changePct = first.cash ? (change / first.cash) * 100 : 0;

  const active = hover === null ? data.length - 1 : hover;
  const point = data[active];

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="row wrap" style={{gap: 12}}>
          <span className="pill accent">Капитал: {money(last.cash)}</span>
          <span className={`pill ${change >= 0 ? 'good' : 'bad'}`}>
            {change >= 0 ? '▲' : '▼'} {money(Math.abs(change))} ({changePct >= 0 ? '+' : '−'}{Math.abs(changePct).toFixed(1)}%)
          </span>
          <span className="pill">за {data.length} дн.</span>
        </div>
        <button className="ghost sm" onClick={() => setShowTable(v => !v)}>
          {showTable ? 'Скрыть таблицу' : 'Показать таблицу'}
        </button>
      </div>

      <div className="chart-wrap">
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{height: 220}} role="img"
             aria-label={`Капитал по дням: от ${money(first.cash)} до ${money(last.cash)}`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="gridline" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
              <text className="axis-text" x={padL - 8} y={y(t) + 4} textAnchor="end">{shortMoney(t)}</text>
            </g>
          ))}
          <path className="area" d={areaPath} />
          <path className="line" d={linePath} />
          {data.map((d, i) => (
            <rect key={d.day} className={`bar ${i === active ? 'sel' : ''}`} x={x(i) - 2} width={4}
                  y={Math.max(padT, y(Math.max(0, d.profit)))} height={Math.max(0, padT + innerH - y(Math.max(0, d.profit)))} rx={2} />
          ))}
          {active === data.length - 1 && <circle className="dot" cx={x(active)} cy={y(point.cash)} r={4} />}
          <line className="gridline" x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} />
          <text className="axis-text" x={padL} y={H - 8}>день {first.day}</text>
          <text className="axis-text" x={W - padR} y={H - 8} textAnchor="end">день {last.day}</text>
          {data.map((d, i) => (
            <rect key={`hit-${d.day}`} className="hit" x={x(i) - innerW / (data.length * 2)} width={innerW / data.length}
                  y={padT} height={innerH} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{left: `${(x(hover) / W) * 100}%`, top: `${(y(data[hover].cash) / H) * 100}%`}}>
            День {data[hover].day}<br />
            Капитал: <b>{money(data[hover].cash)}</b><br />
            Прибыль: <b>{money(data[hover].profit)}</b>
          </div>
        )}
      </div>

      <div className="legend">
        <span><i style={{background: 'var(--series-1)'}} /> капитал, ₽</span>
        <span><i style={{background: 'var(--series-3)'}} /> прибыль за день, ₽</span>
      </div>

      {showTable && (
        <div style={{maxHeight: 240, overflow: 'auto'}}>
          <table>
            <thead>
              <tr><th>День</th><th className="num">Капитал</th><th className="num">Прибыль</th></tr>
            </thead>
            <tbody>
              {data.slice().reverse().map(d => (
                <tr key={d.day}>
                  <td>{d.day}</td>
                  <td className="num">{money(d.cash)}</td>
                  <td className={`num ${d.profit >= 0 ? 'good' : 'bad'}`}>{money(d.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================ Прочее ============================ */

export function Stat({label, value, delta, deltaLabel, spark}: {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  spark?: number[];
}) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {delta !== undefined && (
        <span className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
          {delta >= 0 ? '▲' : '▼'} {money(Math.abs(delta))} {deltaLabel ?? ''}
        </span>
      )}
      {spark && spark.length > 1 && <div className="spark"><Sparkline points={spark} /></div>}
    </div>
  );
}

export function Modal({title, onClose, children, footer}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row between" style={{marginBottom: 12}}>
          <h3 style={{margin: 0}}>{title}</h3>
          <button className="ghost sm" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        {children}
        {footer && <div className="btn-row" style={{marginTop: 16, justifyContent: 'flex-end'}}>{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({text}: {text: string}) {
  return <p className="muted small" style={{margin: 0}}>{text}</p>;
}

export function Stars({value}: {value: number}) {
  const full = Math.round(value);
  return (
    <span className="mono" title={`${value.toFixed(1)} из 5`} aria-label={`${value.toFixed(1)} из 5`}>
      <span style={{color: 'var(--warn)'}}>{'★'.repeat(full)}</span>
      <span className="dim">{'☆'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}
