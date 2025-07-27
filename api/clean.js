import { createWriteStream, unlink } from 'fs';
import { tmpdir } from 'os';
import { join, extname } from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { spawn } from 'child_process';
import Busboy from 'busboy';

export const config = { api: { bodyParser: false } };

const PRESETS = {
  podcast: 'highpass=f=80,afftdn=nr=25,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=9',
  interview: 'highpass=f=80,afftdn=nr=30,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=11',
  voiceover: 'highpass=f=100,afftdn=nr=22,lowpass=f=12000,loudnorm=I=-16:TP=-1.5:LRA=9',
  field: 'highpass=f=100,afftdn=nr=35,lowpass=f=11000,loudnorm=I=-18:TP=-2:LRA=11'
};
const MAX_SIZE = 50 * 1024 * 1024;
const MAX_DURATION = 300;

const allowedExts = ['.wav', '.mp3', '.m4a'];

function getTmpFile(name) {
  return join(tmpdir(), `${Date.now()}_${Math.random().toString(16).slice(2)}_${name}`);
}

async function getDuration(ffmpeg, inFile) {
  return new Promise((resolve) => {
    const proc = spawn(ffmpeg, [
      '-i', inFile,
      '-hide_banner',
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'default=noprint_wrappers=1:nokey=1'
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    let output = '';
    proc.stdout.on('data', d => { output += d; });
    proc.on('close', () => {
      const val = parseFloat(output);
      resolve(isNaN(val) ? 0 : val);
    });
    proc.on('error', () => resolve(0));
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  let filePath, fileName, preset, fileSize = 0, ext;
  let removeFiles = [];

  try {
    await new Promise((resolve, reject) => {
      const busboy = new Busboy({ headers: req.headers, limits: { fileSize: MAX_SIZE } });
      let done = false;

      busboy.on('file', (field, file, name, enc, mimetype) => {
        ext = extname(name || '').toLowerCase();
        if (!allowedExts.includes(ext)) {
          file.resume();
          reject({ code: 415, message: 'Unsupported file type. Allowed: WAV, MP3, M4A.' });
          return;
        }
        fileName = name;
        filePath = getTmpFile(name);
        removeFiles.push(filePath);

        const ws = createWriteStream(filePath);
        file.on('data', chunk => { fileSize += chunk.length; });
        file.pipe(ws);
        ws.on('close', () => {});
        ws.on('error', e => reject({ code: 500, message: 'Write error' }));
      });

      busboy.on('field', (field, val) => {
        if (field === 'preset') {
          preset = val;
        }
      });

      busboy.on('error', err => reject({ code: 500, message: err.message }));
      busboy.on('finish', () => {
        if (!filePath || !preset) return reject({ code: 400, message: 'Missing file or preset' });
        resolve();
      });

      req.pipe(busboy);
    });

    if (fileSize > MAX_SIZE) throw { code: 413, message: 'File too large (max 50MB).' };
    if (!PRESETS[preset]) throw { code: 400, message: 'Invalid preset' };

    // duration check
    const duration = await getDuration(ffmpegStatic || '/var/task/node_modules/ffmpeg-static/ffmpeg', filePath);
    if (duration > MAX_DURATION) throw { code: 413, message: 'Max 5 minutes per file (free limit).' };

    const outFile = getTmpFile('out.mp3');
    removeFiles.push(outFile);

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(
        ffmpegStatic || '/var/task/node_modules/ffmpeg-static/ffmpeg',
        [
          '-i', filePath,
          '-af', PRESETS[preset],
          '-ar', '48000',
          '-ac', '1',
          '-b:a', '192k',
          '-f', 'mp3',
          outFile
        ],
        { stdio: ['ignore', 'inherit', 'pipe'] }
      );

      let ffmpegErr = '';
      ffmpeg.stderr.on('data', d => ffmpegErr += d.toString());

      ffmpeg.on('error', e => reject({ code: 500, message: 'Failed to start ffmpeg: ' + e.message }));
      ffmpeg.on('close', (code) => {
        if (code !== 0) reject({ code: 500, message: 'ffmpeg failed: ' + ffmpegErr });
        else resolve();
      });
    });

    // Serve mp3
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''cleaned.mp3");
    res.status(200);
    createWriteStream(outFile).on('open', function () {
      require('fs').createReadStream(outFile).pipe(res);
    });
  } catch (err) {
    const code = err.code || 500;
    res.status(code).json({
      error: code,
      message: err.message || 'Internal Server Error'
    });
  } finally {
    setTimeout(() => { // Delete temp files in background
      for (const f of removeFiles) try { unlink(f, () => {}); } catch {}
    }, 400);
  }
}


