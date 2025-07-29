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

document.getElementById('dropzone').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('dropzone').addEventListener('dragover', e => e.preventDefault());
document.getElementById('dropzone').addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('processBtn').disabled = false;
  }
});

document.getElementById('fileInput').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    document.getElementById('processBtn').disabled = false;
  }
});

document.getElementById('processBtn').addEventListener('click', () => {
  if (!selectedFile) return;
  alert(currentLang === 'ru' ? 'Обработка файла...' : 'Processing file...');
  // Здесь будет логика отправки файла
});

// Инициализация языка
updateLanguage();
