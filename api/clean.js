// api/clean.js — TURBO-профиль для Vercel Hobby

import Busboy from 'busboy';
import { createWriteStream } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFile, unlink } from 'fs/promises';
import ffmpegPathDefault from 'ffmpeg-static';
import { spawn } from 'child_process';

export const config = { api: { bodyParser: false } };

// «Турбо» пресеты: максимально быстрые (без тяжёлого afftdn)
const PRESETS_TURBO = {
  podcast:   'highpass=f=120,lowpass=f=6500',
  interview: 'highpass=f=150,lowpass=f=6000',
  voiceover: 'highpass=f=90, lowpass=f=7500',
  field:     'highpass=f=200,lowpass=f=5500',
};

// Базовые (чуть медленнее). Переключаемся через переменную среды NG_FAST.
const PRESETS_STD = {
  podcast:   'highpass=f=100,lowpass=f=8000,afftdn=nr=10:nf=-18',
  interview: 'highpass=f=120,lowpass=f=7000,afftdn=nr=8:nf=-18',
  voiceover: 'highpass=f=80, lowpass=f=9000,afftdn=nr=6:nf=-18',
  field:     'highpass=f=200,lowpass=f=6500,afftdn=nr=12:nf=-20',
};

const FAST = (process.env.NG_FAST || '1') === '1';        // по умолчанию быстрый режим
const PRESETS = FAST ? PRESETS_TURBO : PRESETS_STD;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const busboy = Busboy({ headers: req.headers });
  const inPath  = join(tmpdir(), `ng_in_${Date.now()}`);
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);

  let gotFile = false;
  let preset = 'podcast';
  let fileSize = 0;

  const writePromise = new Promise((resolve, reject) => {
    let ws = null;
    busboy.on('field', (name, val) => { if (name === 'preset' && PRESETS[val]) preset = val; });
    busboy.on('file', (_name, file) => {
      gotFile = true;
      ws = createWriteStream(inPath);
      file.on('data', c => (fileSize += c.length));
      file.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      file.on('error', reject);
    });
    busboy.on('error', reject);
    busboy.on('finish', () => { if (!gotFile) reject(new Error('No file uploaded')); });
  });

  try {
    await writePromise;

    if (fileSize > 50 * 1024 * 1024) return res.status(413).send('File too large');

    const ffmpegBin = ffmpegPathDefault || 'ffmpeg';

    // Экстремально быстрый путь: моно, низкая частота, простой фильтр
    const args = [
      '-hide_banner', '-y',
      '-i', inPath,
      '-ac', '1',          // моно
      '-ar', FAST ? '16000' : '22050',
      '-af', PRESETS[preset],
      '-c:a', 'libmp3lame',
      '-b:a', FAST ? '96k' : '128k',
      outPath,
    ];

    const stderrBuf = [];
    await new Promise((resolve, reject) => {
      const p = spawn(ffmpegBin, args);
      p.stderr.on('data', d => stderrBuf.push(d));
      p.on('error', reject);
      p.on('close', code => code === 0 ? resolve() : reject(new Error(Buffer.concat(stderrBuf).toString() || `ffmpeg exit ${code}`)));
    });

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned.mp3"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(data);

  } catch (e) {
    console.error('[api/clean] error:', e?.message || e);
    return res.status(500).send(`Processing error: ${e?.message || e}`);
  } finally {
    unlink(inPath).catch(()=>{});
    unlink(outPath).catch(()=>{});
  }
}


