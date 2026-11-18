/**
 * Загрузка фото из файла: сжатие в canvas до max px и JPEG-качество quality.
 * Возвращает data-URL, пригодный для хранения в сохранении (localStorage/Supabase).
 */

export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/bmp';
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export type ImageOptions = {
  /** Максимальная сторона результата в пикселях. */
  max?: number;
  /** Качество JPEG 0..1. */
  quality?: number;
  /** Обрезать по центру в квадрат (для аватара). */
  square?: boolean;
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = url;
  });
}

export async function fileToImage(file: File, opts: ImageOptions = {}): Promise<string> {
  const { max = 512, quality = 0.82, square = false } = opts;
  if (!file.type.startsWith('image/')) throw new Error('Это не изображение');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Файл больше 15 МБ — выберите поменьше');

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if (!naturalW || !naturalH) throw new Error('Пустое изображение');

    const scale = Math.min(1, max / Math.max(naturalW, naturalH));
    let outW = Math.max(1, Math.round(naturalW * scale));
    let outH = Math.max(1, Math.round(naturalH * scale));
    let sx = 0;
    let sy = 0;
    let sw = naturalW;
    let sh = naturalH;

    if (square) {
      const side = Math.min(naturalW, naturalH);
      sx = Math.round((naturalW - side) / 2);
      sy = Math.round((naturalH - side) / 2);
      sw = side;
      sh = side;
      outW = Math.max(1, Math.round(side * Math.min(1, max / side)));
      outH = outW;
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas недоступен в этом браузере');
    // JPEG не хранит прозрачность — подкладываем светлый фон вместо чёрного.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (!dataUrl.startsWith('data:image/')) throw new Error('Не удалось сжать изображение');
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Приблизительный «вес» data-URL в килобайтах — для подсказок в UI. */
export function dataUrlKb(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round((base64.length * 3) / 4 / 1024);
}
