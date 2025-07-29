let currentLang = 'ru';
let selectedFile = null;

const translations = {
  ru: {
    title: "Онлайн-очистка аудио от шума",
    instruction: "Перетащите файл сюда или выберите",
    clear: "Очистить шум",
    limit: "Бесплатно: до 5 минут/день, до 50MB",
    switch: "EN"
  },
  en: {
    title: "Online audio noise remover",
    instruction: "Drag & drop or choose file",
    clear: "Clean noise",
    limit: "Free: up to 5 min/day, 50MB",
    switch: "RU"
  }
};

function updateLanguage() {
  const t = translations[currentLang];
  document.getElementById('title').innerText = t.title;
  document.getElementById('instruction').innerText = t.instruction;
  document.getElementById('processBtn').innerText = t.clear;
  document.getElementById('limitText').innerText = t.limit;
  document.getElementById('langToggle').innerText = t.switch;
}

document.getElementById('langToggle').addEventListener('click', () => {
  currentLang = currentLang === 'ru' ? 'en' : 'ru';
  updateLanguage();
});

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const processBtn = document.getElementById('processBtn');

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');

  const file = e.dataTransfer.files[0];
  if (file) {
    selectedFile = file;
    processBtn.disabled = false;
    console.log("Файл получен через drag & drop:", file.name);
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    processBtn.disabled = false;
    console.log("Файл выбран вручную:", file.name);
  }
});

processBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  alert(
    currentLang === 'ru'
      ? `Файл "${selectedFile.name}" готов к обработке.`
      : `File "${selectedFile.name}" is ready to be processed.`
  );
});

updateLanguage();
