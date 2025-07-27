// api/clean.js
export const config = { api: { bodyParser: false } };

import Busboy from 'busboy';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { createWriteStream } from 'fs';
import { readFile, unlink } from 'fs/promises';

// максимально простые и быстрые фильтры, чтобы уложиться в 10s Hobby
const PRESETS = {
  podcast:  'highpass=f=100,lowpass=f=12000,afftdn=nr=15',
  interview:'highpass=f=90,lowpass=f=12000,afftdn=nr=16',
  voiceover:'highpass=f=80,lowpass=f=12000,afftdn=nr=17',
  field:    'highpass=f=120,lowpass=f=11000,afftdn=nr=14'
};

// сколько секунд обрабатывать на Hobby (чтобы не упираться в таймаут)
const HOBBY_SECONDS = 20;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const inPath  = join(tmpdir(), `ng_in_${Date.now()}.wav`);
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.wav`); // WAV -> минимум CPU
  let gotFile = false;
  let preset = 'podcast';

  const busboy = Busboy({ headers: req.headers });
  const writePromise = new Promise((resolve, reject) => {
    busboy.on('field', (name, val) => {
      if (name === 'preset' && PRESETS[val]) preset = val;
    });
    busboy.on('file', (_name, fileStream) => {
      gotFile = true;
      const ws = createWriteStream(inPath);
      fileStream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      fileStream.on('error', reject);
    });
    busboy.on('error', reject);
    busboy.on('finish', () => gotFile ? null : reject(new Error('No file uploaded')));
  });

  req.pipe(busboy);

  try {
    await writePromise;

    // максимально быстрый пайплайн:
    // - режем до 20 сек, переводим в моно и 32 кГц
    // - простая цепочка фильтров для шумоподавления
    const filter = PRESETS[preset];
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostats',
      '-y',
      '-t', String(HOBBY_SECONDS),   // <= ключевая строка: ограничиваем длительность
      '-i', inPath,
      '-ac', '1',
      '-ar', '32000',
      '-af', filter,
      '-c:a', 'pcm_s16le',          // WAV (почти не грузит CPU)
      outPath
    ];

    const child = spawn(ffmpegPath, args);
    let stderrText = '';
    child.stderr.on('data', d => { stderrText += d.toString(); });

    const code = await new Promise(resolve => child.on('close', resolve));

    if (code !== 0) {
      console.error('FFmpeg error:', stderrText);
      res.status(500).send(stderrText || 'Processing error');
      try { await unlink(inPath); } catch {}
      try { await unlink(outPath); } catch {}
      return;
    }

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent('cleaned.wav')}`
    );
    res.status(200).send(data);

    try { await unlink(inPath); } catch {}
    try { await unlink(outPath); } catch {}
  } catch (e) {
    console.error('API fail:', e);
    res.status(500).send(String(e?.message || e));
    try { await unlink(inPath); } catch {}
    try { await unlink(outPath); } catch {}
  }
}


