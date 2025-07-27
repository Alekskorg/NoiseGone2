// api/clean.js
import { spawn } from 'child_process';
import ffmpegPath from 'ffmpeg-static';
import Busboy from 'busboy';
import { tmpdir } from 'os';
import { createWriteStream as cws } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const busboy = Busboy({ headers: req.headers });
    const inPath = join(tmpdir(), `ng_in_${Date.now()}.wav`);
    let preset = 'podcast';
    let gotFile = false;

    const writePromise = new Promise((resolve, reject) => {
      busboy.on('file', (name, file) => {
        gotFile = true;
        const ws = cws(inPath);
        file.pipe(ws);
        ws.on('finish', resolve);
        ws.on('error', reject);
      });
      busboy.on('field', (name, val) => {
        if (name === 'preset') preset = String(val || 'podcast');
      });
      busboy.on('error', reject);
      busboy.on('finish', () => {
        if (!gotFile) reject(new Error('No file uploaded'));
      });
      req.pipe(busboy);
    });

    await writePromise;

    const presets = {
      podcast:  "highpass=f=80,afftdn=nf=-25,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=11",
      interview:"highpass=f=80,afftdn=nf=-30,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=11",
      voiceover:"highpass=f=100,afftdn=nf=-22,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=9",
      field:    "highpass=f=100,afftdn=nf=-35,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=11"
    };
    const af = presets[preset] || presets.podcast;

    const outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);
    const args = [
      '-y', '-i', inPath,
      '-af', af,
      '-ar', '48000', '-ac', '1',
      '-c:a', 'libmp3lame', '-b:a', '192k',
      outPath
    ];

    await new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args);
      let stderr = '';
      proc.stderr.on('data', d => (stderr += d.toString()));
      proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)));
    });

    const data = await readFile(outPath);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned.mp3"');
    res.status(200).send(data);

    unlink(inPath).catch(()=>{});
    unlink(outPath).catch(()=>{});
  } catch (e) {
    console.error(e);
    res.status(500).send('Processing error');
  }
}
