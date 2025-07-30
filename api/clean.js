
export default function handler(req, res) {
  const prog = parseFloat(req.query.prog || '0');
  const next = Math.min(prog + 0.2, 1); // +20 % каждый вызов
  const payload = { progress: next };
  if (next === 1) payload.url = '/dummy/path'; // здесь будет реальный файл
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json(payload);
}

