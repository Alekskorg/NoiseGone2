// api/clean.js — быстрая и безопасная версия под Vercel

import Busboy from 'busboy';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import ffmpegPathDefault from 'ffmpeg-static';
import { spawn } from 'child_process';

// важно: стримим тело запроса (не буферим)
export const config = { api: { bodyParser: false } };

// Лёгкие, быстрые пресеты (чтобы уложиться в таймлимит Vercel Hobby)
const PRESETS = {
  podcast:   'highpass=f=100,lowpass=f=8000,afftdn=nr=12:nf=-20',
  interview: 'highpass=f=120,lowpass=f=7000,afftdn=nr=10:nf=-18',
  voiceover: 'highpass=f=80,lowpass=f=9000,afftdn=nr=8:nf=-18',
  field:     'highpass=f=200,lowpass=f=6500,afftdn=nr=14:nf=-22',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const busboy = Busboy({ headers: req.headers });
  const inPath  = join(tmpdir(), `ng_in_${Date.now()}.audio`);  // расширение не важно
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);

  let gotFile = false;
  let preset  = 'podcast';
  let fileSize = 0;

  const writePromise = new Promise((resolve, reject) => {
    let ws = null;

    busboy.on('field', (name, val) => {
      if (name === 'preset' && PRESETS[val]) preset = val;
    });

    busboy.on('file', (_name, file) => {
      gotFile = true;
      ws = createWriteStream(inPath);
      file.on('data', (chunk) => (fileSize += chunk.length));
      file.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      file.on('error', reject);
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!gotFile) reject(new Error('No file uploaded'));
    });
  });

  try {
    await writePromise;

    // Ограничим размер (например, 50 МБ)
    if (fileSize > 50 * 1024 * 1024) {
      return res.status(413).send('File too large');
    }

    // ffmpeg-static в ESM — default экспорт
    const ffmpegBin = ffmpegPathDefault || 'ffmpeg';

    // Ускоряем обработку: моно, пониже частота дискретизации
    const args = [
      '-hide_banner',
      '-y',
      '-i', inPath,
      '-ac', '1',           // mono — быстрее
      '-ar', '22050',       // ниже частота — быстрее
      '-af', PRESETS[preset],
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outPath,
    ];

    const stderrBuf = [];
    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegBin, args);
      proc.stderr.on('data', d => stderrBuf.push(d));
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(Buffer.concat(stderrBuf).toString() || `ffmpeg exit ${code}`));
      });
    });

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned.mp3"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(data);

  } catch (e) {
    // Лог в Vercel, и текст ошибки вернём клиенту — чтобы видеть причину в интерфейсе
    console.error('[api/clean] error:', e?.message || e);
    return res.status(500).send(`Processing error: ${e?.message || e}`);
  } finally {
    // очищаем временные файлы
    unlink(inPath).catch(()=>{});
    unlink(outPath).catch(()=>{});
  }
}

