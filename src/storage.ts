import type {Save} from './types';
import {normalizeSave} from './game';

/** Сохранение в виде текста — для файла, буфера обмена и облака. */
export function saveToText(s: Save): string {
  return JSON.stringify(s, null, 2);
}

/** Разбор текста сохранения с проверкой, что это действительно сохранение. */
export function parseSave(text: string): Save {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Файл не является JSON-сохранением');
  }
  if (!raw || typeof raw !== 'object') throw new Error('Некорректный формат сохранения');
  const obj = raw as Partial<Save> & {save_data?: Partial<Save>};
  // Поддерживаем и «сырое» сохранение, и строку из таблицы game_saves.
  const candidate = obj.save_data && typeof obj.save_data === 'object' ? obj.save_data : obj;
  if (typeof candidate.cash !== 'number' || typeof candidate.day !== 'number') {
    throw new Error('В файле нет данных игры (cash/day)');
  }
  return normalizeSave(candidate);
}

export function downloadFile(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], {type: `${mime};charset=utf-8`});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsText(file);
  });
}

export function saveFileName(s: Save): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `perekup-day${s.day}-${stamp}.json`;
}
