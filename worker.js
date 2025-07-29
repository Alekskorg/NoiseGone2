self.onmessage = (e) => {
  const file = e.data.file;
  const ext  = file.name.split('.').pop();
  const base = file.name.replace(/\.[^/.]+$/, '');
  const newName = `${base}.cleaned.${ext}`;
  // никакой тяжёлой обработки — просто «псевдо-очистка»
  self.postMessage({ blob: file, name: newName });
};
