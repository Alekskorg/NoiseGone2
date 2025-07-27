// api/clean.js
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, readFile, unlink } from 'fs';
import Busboy from 'busboy';
import { path as ffmpegPath } from 'ffmpeg-static';

export const config = {
  api: { bodyParser: false }, // важное: стримим файл, не буферим
};

// Лёгкие пресеты (быстрее выходят в таймлимит Vercel Hobby)
const PRESETS = {
  podcast:   'highpass=f=100, lowpass=f=8000, afftdn=nr=12:nf=-20',
  interview: 'highpass=f=120, lowpass=f=7000, afftdn=nr=10:nf=-18',
  voiceover: 'highpass=f=80,  lowpass=f=9000, afftdn=nr=8:nf=-18',
  field:     'highpass=f=200, lowpass=f=6500, afftdn=nr=14:nf=-22',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  const busboy = Busboy({ headers: req.headers });
  const inPath = join(tmpdir(), `ng_in_${Date.now()}.wav`);
  const outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);

  let gotFile = false;
  let preset = 'podcast';

  const writePromise = new Promise((resolve, reject) => {
    let ws = null;
    busboy.on('field', (name, val) => {
      if (name === 'preset') preset = val in PRESETS ? val : 'podcast';
    });
    busboy.on('file', (_name, file) => {
      gotFile = true;
      ws = createWriteStream(inPath);
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

    // «Быстрая» обработка: понижаем частоту/битрейт, простой фильтр
    const args = [
      '-y', '-i', inPath,
      '-ac', '1',           // моно — быстрее
      '-ar', '22050',       // пониже частота (ускоряет работу)
      '-af', PRESETS[preset],
      '-c:a', 'libmp3lame',
      '-b:a', '128k',
      outPath,
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code => (code === 0 ? resolve() : reject(new Error(stderr))));
    });

    const data = await readFile(outPath, null, ()=>{});
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned.mp3"');
    res.status(200).send(data);
  } catch (e) {
    console.error(e);
    res.status(500).send('Processing error');
  } finally {
    // чистим времянку
    unlink(inPath, ()=>{});
    unlink(outPath, ()=>{});
  }
}

