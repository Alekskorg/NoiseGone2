# NoiseGone

Онлайн-очистка шума из аудио (подкасты, интервью, озвучка, полевые записи).

- **Фронтенд**: `index.html` (чистый JS, RU/EN, drag&drop, прогресс, пресеты).
- **Бэкенд**: `api/clean.js` (Vercel Node Function, `ffmpeg-static`, `ffprobe-static`).
- **Ограничения**: файл до ~50 МБ, длительность до 5 минут (free tier).
- **Деплой**: GitHub → Vercel (авто). `vercel.json` выставляет `maxDuration = 60s`.

## Локально

```bash
npm i
# если установлен Vercel CLI:
vercel dev
