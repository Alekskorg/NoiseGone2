import { tmpdir } from "os";
import { join, basename, extname } from "path";
import { createWriteStream, promises as fsp, statSync } from "fs";
import Busboy from "busboy";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";

export const config = {
  api: { bodyParser: false }, // мы сами читаем поток
};

// пресеты фильтров: максимально совместимые и быстрые
const FILTERS = {
  podcast:  `highpass=f=80, lowpass=f=12000, afftdn=nr=16`,
  interview:`highpass=f=80, lowpass=f=11000, afftdn=nr=18`,
  voiceover:`highpass=f=100, lowpass=f=12000, afftdn=nr=18, loudnorm=I=-16:TP=-1.5:LRA=5`,
  field:    `highpass=f=120, lowpass=f=9000, afftdn=nr=20`
};

// -------------- вспомогательные --------------
function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: 50 * 1024 * 1024 } });
    let tmpIn = null, preset = "podcast", gotFile = false, fileSize = 0;

    bb.on("field", (name, val) => {
      if (name === "preset" && FILTERS[val]) preset = val;
    });

    bb.on("file", (_name, stream, info) => {
      gotFile = true;
      const inPath = join(tmpdir(), `ng_in_${Date.now()}${extname(info.filename || ".wav")}`);
      tmpIn = inPath;

      const ws = createWriteStream(inPath);
      stream.on("data", (c) => { fileSize += c.length; });
      stream.pipe(ws);
      ws.on("finish", () => resolve({ inPath, preset, fileSize }));
      ws.on("error", reject);
      stream.on("error", reject);
    });

    bb.on("error", reject);
    bb.on("finish", () => {
      if (!gotFile) reject(Object.assign(new Error("No file"), { status: 400 }));
    });

    req.pipe(bb);
  });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, windowsHide: true });
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ code }) : reject(Object.assign(new Error(stderr || `Exit ${code}`), { code }))));
  });
}

async function probeDuration(inPath) {
  // читаем длительность через ffprobe
  const args = ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inPath];
  const { spawn } = await import("child_process");
  return new Promise((res) => {
    let out = "";
    const p = spawn(ffprobePath.path, args, { windowsHide: true });
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("close", () => {
      const sec = parseFloat(out.trim());
      res(Number.isFinite(sec) ? sec : null);
    });
    p.on("error", () => res(null));
  });
}

// -------------- основной обработчик --------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, message: "Method Not Allowed" });
  }

  let inPath, outPath;
  try {
    // получаем файл и пресет
    const { inPath: inp, preset, fileSize } = await readMultipart(req);
    inPath = inp;

    // 50 МБ лимит уже соблюдён Busboy, но перепроверим
    if (fileSize > 50 * 1024 * 1024) {
      await fsp.unlink(inPath).catch(() => {});
      return res.status(413).json({ ok: false, message: "File too large (50MB limit)" });
    }

    // длительность — бесплатный лимит 5 минут
    const dur = await probeDuration(inPath);
    if (dur != null && dur > 5 * 60) {
      await fsp.unlink(inPath).catch(() => {});
      return res.status(413).json({ ok: false, message: "Too long for free tier (max 5 minutes)" });
    }

    // выходной файл
    outPath = join(tmpdir(), `ng_out_${Date.now()}.mp3`);
    const filter = FILTERS[preset] || FILTERS.podcast;

    // ffmpeg: быстрый, совместимый пайплайн
    const args = [
      "-y",
      "-hide_banner",
      "-i", inPath,
      "-af", filter,
      "-ar", "48000",
      "-ac", "1",
      "-c:a", "libmp3lame",
      "-b:a", "192k",
      outPath,
    ];

    // защитный таймаут (55 сек) — чтобы не уткнуться в maxDuration
    const MAX_MS = 55_000;
    await Promise.race([
      run(ffmpegPath, args),
      new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error("Timeout"), { status: 504 })), MAX_MS)),
    ]);

    // отдаём результат
    const data = await fsp.readFile(outPath);
    const cleanName = (basename(inPath).replace(/\.[^.]+$/, "") || "audio") + "_cleaned.mp3";

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(cleanName)}"`);
    return res.status(200).send(data);
  } catch (err) {
    const code = err?.status || 500;
    return res.status(code).json({ ok: false, message: err?.message || "Processing error" });
  } finally {
    // чистим tmp
    if (inPath) await fsp.unlink(inPath).catch(()=>{});
    if (outPath) await fsp.unlink(outPath).catch(()=>{});
  }
}


