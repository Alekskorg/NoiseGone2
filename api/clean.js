// api/clean.js
export const config = { api: { bodyParser: false }, maxDuration: 60 };

import Busboy from 'busboy';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { readFile, unlink } from 'fs/promises';

const PRESETS = {
  podcast:  'highpass=f=100,lowpass=f=12000,afftdn=nr=15',
  interview:'highpass=f=90,lowpass=f=12000,afftdn=nr=17',
  voiceover:'highpass=f=80,lowpass=f=12000,afftdn=nr=18',
  field:    'highpass=f=120,lowpass=f=11000,afftdn=nr=14'
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const busboy = Busboy({ headers: req.headers });
  const inPath  = join(tmpdir(), `ng_in_${Date.now()}.wav`);
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);

  let gotFile = false;
  let preset = 'podcast';

  // получаем preset из поля формы
  busboy.on('field', (name, val) => {
    if (name === 'preset' && PRESETS[val]) preset = val;
  });

  // пишем входной файл в /tmp
  const writePromise = new Promise((resolve, reject) => {
    busboy.on('file', (_name, fileStream) => {
      gotFile = true;
      const ws = createWriteStream(inPath);
      fileStream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      fileStream.on('error', reject);
    });
    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!gotFile) reject(new Error('No file uploaded'));
    });
  });

  req.pipe(busboy);

  try {
    await writePromise;

    // максимально быстрый пайплайн: моно + 32 кГц + простой шумодав
    const filter = PRESETS[preset];
    const args = [
      '-hide_banner', '-y',
      '-i', inPath,
      '-vn',
      '-ac', '1',
      '-ar', '32000',
      '-filter:a', filter,
      '-codec:a', 'libmp3lame',
      '-b:a', '160k',
      outPath
    ];

    const child = spawn(ffmpegPath, args, { stdio: ['ignore','pipe','pipe'] });

    // Жёсткий таймаут (25с) для serverless. Если упёрлось – убиваем процесс.
    const KILL_AFTER = 25_000;
    const killer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
    }, KILL_AFTER);

    let stderrText = '';
    child.stderr.on('data', d => { stderrText += d.toString(); });

    const code = await new Promise(resolve => child.on('close', resolve));
    clearTimeout(killer);

    if (code !== 0) {
      console.error('FFmpeg fail:', stderrText.slice(0, 500));
      // вернём тело ошибки, чтобы фронт показал текст
      res.status(500).send(stderrText || 'Processing error');
      try { await unlink(inPath); } catch {}
      try { await unlink(outPath); } catch {}
      return;
    }

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('cleaned.mp3')}`
    );
    res.status(200).send(data);

    try { await unlink(inPath); } catch {}
    try { await unlink(outPath); } catch {}
  } catch (e) {
    console.error('API error:', e);
    res.status(500).send(String(e?.message || e));
    try { await unlink(inPath); } catch {}
    try { await unlink(outPath); } catch {}
  }
}


