// api/clean.js — Шаг A: супер-быстрый «смок-тест» (без фильтров)
export const config = { api: { bodyParser: false } };

import Busboy from 'busboy';
import { tmpdir } from 'os';
import { join } from 'path';
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import { createWriteStream } from 'fs';
import { readFile, unlink } from 'fs/promises';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const inPath  = join(tmpdir(), `ng_in_${Date.now()}.wav`);
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.wav`);

  let gotFile = false;
  const busboy = Busboy({ headers: req.headers });
  const writePromise = new Promise((resolve, reject) => {
    busboy.on('file', (_name, file) => {
      gotFile = true;
      const ws = createWriteStream(inPath);
      file.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
      file.on('error', reject);
    });
    busboy.on('error', reject);
    busboy.on('finish', () => gotFile ? null : reject(new Error('No file uploaded')));
  });

  req.pipe(busboy);

  try {
    await writePromise;

    // Максимально быстрый конвейер: отрезаем первые 6 секунд, моно, 32 кГц, WAV
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostats',
      '-y',
      '-t', '6',            // 6 секунд гарантированно успевают даже на самом слабом холодном старте
      '-i', inPath,
      '-ac', '1',
      '-ar', '32000',
      '-c:a', 'pcm_s16le',
      outPath
    ];

    const p = spawn(ffmpegPath, args);
    let stderr = '';
    p.stderr.on('data', d => { stderr += d.toString(); });

    const code = await new Promise(r => p.on('close', r));
    if (code !== 0) {
      console.error(stderr);
      return res.status(500).send(stderr || 'Processing error');
    }

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''cleaned.wav`);
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


