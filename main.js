
const i18n = {
  en: {
    // nav
    navEnhancer: 'Audio Enhancer',
    navNoiseRemover: 'Noise Remover',
    navVocalRemover: 'Vocal Remover',
    navEchoRemover: 'Echo Remover',
    navDashboard: 'Dashboard',
    navPricing: 'Pricing Plan',
    navLogin: 'Login',

    // plans
    plan60: '60 min/month — Buy for $10',
    plan300: '300 min/month — Buy for $45',
    planUnlimited: 'Unlimited/month — Buy for $90',

    // card
    title: 'NoiseGone',
    subtitle: 'Online noise remover',
    scenarioPodcast: 'Podcast',
    scenarioInterview: 'Interview',
    scenarioVoiceOver: 'Voice-over',
    scenarioField: 'Field',
    dropMessage: 'Drag & drop or choose file',
    dropFormats: 'WAV, MP3, M4A up to 50 MB',
    btnReset: 'Reset',
    btnClean: 'Clean noise',
    btnRecordStart: 'Record',
    btnRecordStop: 'Stop',
    btnDownload: 'Download',
    btnNew: 'New file',
    done: 'Done.',
    freeNote: 'Free: up to 5 min/day, 50 MB',
    privacy: 'Privacy policy',

    // errors / toast
    errorTooBig: 'File is too large (max 50 MB)',
    errorFormat: 'Unsupported format',
    errorManyFiles: 'Please drop only one file',
    errorMicDenied: 'Microphone access denied',
    offlineProcessing: 'Processing unavailable offline',
    serverError: 'Server error',
    toastBuySoon: 'Payments coming soon',
    msgRecordingStarted: 'Recording started',
    msgRecordingStopped: 'Recording stopped'
  },
  ru: {
    navEnhancer: 'Audio Enhancer',
    navNoiseRemover: 'Noise Remover',
    navVocalRemover: 'Vocal Remover',
    navEchoRemover: 'Echo Remover',
    navDashboard: 'Дашборд',
    navPricing: 'Тарифы',
    navLogin: 'Войти',

    plan60: '60 мин/мес — купить за $10',
    plan300: '300 мин/мес — купить за $45',
    planUnlimited: 'Безлимит/мес — купить за $90',

    title: 'NoiseGone',
    subtitle: 'Онлайн очистка шума',
    scenarioPodcast: 'Подкаст',
    scenarioInterview: 'Интервью',
    scenarioVoiceOver: 'Дубляж',
    scenarioField: 'Полевые',
    dropMessage: 'Перетащите файл сюда или выберите',
    dropFormats: 'WAV, MP3, M4A до 50 МБ',
    btnReset: 'Сбросить',
    btnClean: 'Очистить шум',
    btnRecordStart: 'Запись',
    btnRecordStop: 'Стоп',
    btnDownload: 'Скачать',
    btnNew: 'Новый файл',
    done: 'Готово.',
    freeNote: 'Бесплатно: до 5 мин/день, 50 МБ',
    privacy: 'Политика конфиденциальности',

    errorTooBig: 'Файл слишком большой (макс 50 МБ)',
    errorFormat: 'Недопустимый формат',
    errorManyFiles: 'Перетащите только один файл',
    errorMicDenied: 'Доступ к микрофону запрещён',
    offlineProcessing: 'Обработка недоступна офлайн',
    serverError: 'Ошибка сервера',
    toastBuySoon: 'Оплата скоро',
    msgRecordingStarted: 'Запись начата',
    msgRecordingStopped: 'Запись остановлена'
  }
};

/* ========= State ========= */
const state = {
  lang: 'en',
  selectedFile: null,
  processing: false,
  scenario: 'podcast',
  recording: false,
  mediaRecorder: null,
  recordChunks: [],
  recordTimer: null,
  recordStart: null,
  maxRecordTimeout: null
};

/* ========= Utils ========= */
const utils = {
  bytesToMB: (bytes) => Math.round(bytes / (1024 * 1024)),
  random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  formatTime: (sec) =>
    `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`,
  showToast(msg) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
};

/* ========= PWA: SW & install prompt ========= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.createElement('button');
  btn.className = 'btn secondary';
  btn.textContent = 'Install';
  btn.style.marginLeft = 'auto';
  document.querySelector('.topbar-inner').appendChild(btn);
  btn.addEventListener('click', async () => {
    btn.remove();
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
  });
});

window.addEventListener('appinstalled', () => utils.showToast('App installed! 🎉'));

/* ========= Web Worker ========= */
const worker = new Worker('/worker.js');

/* ========= UI cache (нужен позже) ========= */
const ui = {
  langSwitch: document.getElementById('langSwitch'),
  nav: document.getElementById('nav'),
  burger: document.getElementById('burger'),
  planButtons: document.querySelectorAll('.plan'),
  scenarioButtons: document.querySelectorAll('.scenario'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('fileInput'),
  fileInfo: document.getElementById('fileInfo'),
  resetBtn: document.getElementById('resetBtn'),
  cleanBtn: document.getElementById('cleanBtn'),
  recordBtn: document.getElementById('recordBtn'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  result: document.getElementById('result'),
  downloadBtn: document.getElementById('downloadBtn'),
  newBtn: document.getElementById('newBtn')
};

/* ========= Language helpers (как прежде) ========= */
function updateRecordBtnText() {
  const base = i18n[state.lang][state.recording ? 'btnRecordStop' : 'btnRecordStart'];
  if (state.recording) {
    const elapsed = Math.floor((Date.now() - state.recordStart) / 1000);
    ui.recordBtn.textContent = `${base} ${utils.formatTime(elapsed)}`;
  } else {
    ui.recordBtn.textContent = base;
  }
}

function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem('ng_lang', lang);
  document.documentElement.lang = lang;
  [...document.querySelectorAll('[data-i18n]')].forEach((el) => {
    const k = el.dataset.i18n;
    const txt = i18n[lang][k];
    if (txt) el.textContent = txt;
  });
  updateRecordBtnText();
}

function initLanguage() {
  const saved = localStorage.getItem('ng_lang');
  const browserLang = navigator.language.startsWith('ru') ? 'ru' : 'en';
  const initial = saved || browserLang;
  ui.langSwitch.value = initial;
  setLanguage(initial);
}

/* ========= … Дальнейший код (dropzone, recording, processing, nav, plans, etc.) остаётся БЕЗ ИЗМЕНЕНИЙ, т.к. ошибка была только в порядке объявлений ========= */

/* ========= Init ========= */
function attachEvents() {
  ui.langSwitch.addEventListener('change', (e) => setLanguage(e.target.value));
  // ... все прежние обработчики ...
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  attachEvents();// Глобально отменяем дефолт-drag, чтобы DataTransfer не чистился
['dragover', 'drop'].forEach(ev =>
  document.addEventListener(ev, e => {
    if (e.target !== ui.dropzone) e.preventDefault();
  })
);

});// Глобально отключаем стандартный drag'n'drop,
// чтобы DataTransfer.files не очищался
['dragover', 'drop'].forEach(ev =>
  document.addEventListener(ev, e => {
    if (e.target !== ui.dropzone) e.preventDefault();
  })
);

// Временный лог, чтобы видеть, что событие доходит
ui.dropzone.addEventListener('drop', () => console.log('DROP EVENT'));

// уже есть:
const dz = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');

// ДОБАВЬ — фолбэк для некоторых мобильных браузеров
dz?.addEventListener('keydown', (e)=>{
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput?.click();
  }
});
dz?.addEventListener('touchend', ()=>{
  // на части устройств click не всплывает после touch
  fileInput?.click();
}, {passive:true});
