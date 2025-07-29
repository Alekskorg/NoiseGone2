
// main.js

/* ========= State ========= */
const state = {
  lang: "en",
  selectedFile: null,
  processing: false,
  scenario: "podcast"
};

/* ========= i18n ========= */
const i18n = {
  en: {
    // nav
    navEnhancer: "Audio Enhancer",
    navNoiseRemover: "Noise Remover",
    navVocalRemover: "Vocal Remover",
    navEchoRemover: "Echo Remover",
    navDashboard: "Dashboard",
    navPricing: "Pricing Plan",
    navLogin: "Login",

    // plans
    plan60: "60 min/month — Buy for $10",
    plan300: "300 min/month — Buy for $45",
    planUnlimited: "Unlimited/month — Buy for $90",

    // card
    title: "NoiseGone",
    subtitle: "Online noise remover",
    scenarioPodcast: "Podcast",
    scenarioInterview: "Interview",
    scenarioVoiceOver: "Voice-over",
    scenarioField: "Field",
    dropMessage: "Drag & drop or choose file",
    dropFormats: "WAV, MP3, M4A up to 50 MB",
    btnReset: "Reset",
    btnClean: "Clean noise",
    btnDownload: "Download",
    btnNew: "New file",
    done: "Done.",
    freeNote: "Free: up to 5 min/day, 50 MB",
    privacy: "Privacy policy",

    // errors
    errorTooBig: "File is too large (max 50 MB)",
    errorFormat: "Unsupported format",
    errorManyFiles: "Please drop only one file",

    // toast
    toastBuySoon: "Payments coming soon"
  },
  ru: {
    navEnhancer: "Audio Enhancer",
    navNoiseRemover: "Noise Remover",
    navVocalRemover: "Vocal Remover",
    navEchoRemover: "Echo Remover",
    navDashboard: "Дашборд",
    navPricing: "Тарифы",
    navLogin: "Войти",

    plan60: "60 мин/мес — купить за $10",
    plan300: "300 мин/мес — купить за $45",
    planUnlimited: "Безлимит/мес — купить за $90",

    title: "NoiseGone",
    subtitle: "Онлайн очистка шума",
    scenarioPodcast: "Подкаст",
    scenarioInterview: "Интервью",
    scenarioVoiceOver: "Дубляж",
    scenarioField: "Полевые",
    dropMessage: "Перетащите файл сюда или выберите",
    dropFormats: "WAV, MP3, M4A до 50 МБ",
    btnReset: "Сбросить",
    btnClean: "Очистить шум",
    btnDownload: "Скачать",
    btnNew: "Новый файл",
    done: "Готово.",
    freeNote: "Бесплатно: до 5 мин/день, 50 МБ",
    privacy: "Политика конфиденциальности",

    errorTooBig: "Файл слишком большой (макс 50 МБ)",
    errorFormat: "Недопустимый формат",
    errorManyFiles: "Перетащите только один файл",

    toastBuySoon: "Оплата скоро"
  }
};

/* ========= Utils ========= */
const utils = {
  bytesToMB: (bytes) => Math.round(bytes / (1024 * 1024)),
  random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
  showToast(msg) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};

/* ========= UI Cache ========= */
const ui = {
  langSwitch: document.getElementById("langSwitch"),
  nav: document.getElementById("nav"),
  burger: document.getElementById("burger"),
  planButtons: document.querySelectorAll(".plan"),
  scenarioButtons: document.querySelectorAll(".scenario"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  fileInfo: document.getElementById("fileInfo"),
  resetBtn: document.getElementById("resetBtn"),
  cleanBtn: document.getElementById("cleanBtn"),
  progressWrap: document.getElementById("progressWrap"),
  progressBar: document.getElementById("progressBar"),
  result: document.getElementById("result"),
  downloadBtn: document.getElementById("downloadBtn"),
  newBtn: document.getElementById("newBtn")
};

/* ========= i18n Functions ========= */
function setLanguage(lang) {
  state.lang = lang;
  localStorage.setItem("ng_lang", lang);
  document.documentElement.lang = lang;
  [...document.querySelectorAll("[data-i18n]")].forEach((el) => {
    const key = el.dataset.i18n;
    const text = i18n[lang][key];
    if (text) el.textContent = text;
  });
}

function initLanguage() {
  const saved = localStorage.getItem("ng_lang");
  const browserLang = navigator.language.startsWith("ru") ? "ru" : "en";
  const initial = saved || browserLang;
  ui.langSwitch.value = initial;
  setLanguage(initial);
}

/* ========= Navigation ========= */
function initNav() {
  ui.burger.addEventListener("click", () => {
    const expanded = ui.burger.getAttribute("aria-expanded") === "true";
    ui.burger.setAttribute("aria-expanded", !expanded);
    ui.nav.classList.toggle("open");
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 767) {
      ui.nav.classList.remove("open");
      ui.burger.setAttribute("aria-expanded", "false");
    }
  });
}

/* ========= Plans ========= */
function initPlans() {
  ui.planButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      utils.showToast(i18n[state.lang].toastBuySoon);
    });
  });
}

/* ========= Scenarios ========= */
function initScenarios() {
  ui.scenarioButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.scenarioButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.scenario = btn.dataset.scenario;
      localStorage.setItem("ng_scenario", state.scenario);
    });
  });

  const saved = localStorage.getItem("ng_scenario");
  if (saved) {
    const target = [...ui.scenarioButtons].find((b) => b.dataset.scenario === saved);
    if (target) target.click();
  }
}

/* ========= File Handling ========= */
const allowedTypes = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/x-m4a", "audio/mp4"];
const maxSize = 50 * 1024 * 1024; // 50 MB

function validateFile(file) {
  if (!allowedTypes.includes(file.type)) {
    showError("errorFormat");
    return false;
  }
  if (file.size > maxSize) {
    showError("errorTooBig");
    return false;
  }
  return true;
}

function showError(key) {
  ui.fileInfo.textContent = i18n[state.lang][key];
  ui.fileInfo.classList.add("error");
}

function updateFileInfo() {
  if (state.selectedFile) {
    ui.fileInfo.textContent = `${state.selectedFile.name} (${utils.bytesToMB(state.selectedFile.size)} MB)`;
    ui.fileInfo.classList.remove("error");
    ui.resetBtn.disabled = false;
    ui.cleanBtn.disabled = false;
  } else {
    ui.fileInfo.textContent = "";
    ui.resetBtn.disabled = true;
    ui.cleanBtn.disabled = true;
  }
}

function handleFiles(files) {
  if (files.length === 0) return;
  if (files.length > 1) {
    showError("errorManyFiles");
    return;
  }
  const file = files[0];
  if (validateFile(file)) {
    state.selectedFile = file;
    updateFileInfo();
  }
}

function initDropzone() {
  ["dragenter", "dragover"].forEach((type) => {
    ui.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      ui.dropzone.classList.add("hover");
    });
  });

  ["dragleave", "drop"].forEach((type) => {
    ui.dropzone.addEventListener(type, () => {
      ui.dropzone.classList.remove("hover");
    });
  });

  ui.dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  });

  ui.dropzone.addEventListener("click", () => {
    ui.fileInput.click();
  });

  ui.fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    // allow re-selecting same file by clearing value
    ui.fileInput.value = "";
  });
}

/* ========= Processing ========= */
function startProcessing() {
  if (!state.selectedFile || state.processing) return;
  state.processing = true;

  ui.cleanBtn.disabled = true;
  ui.resetBtn.disabled = true;
  ui.scenarioButtons.forEach((b) => (b.disabled = true));
  ui.langSwitch.disabled = true;
  ui.dropzone.setAttribute("aria-disabled", "true");

  ui.progressWrap.hidden = false;
  ui.progressBar.style.width = "0%";

  const duration = utils.random(3000, 8000);
  const steps = duration / utils.random(80, 120);
  let progress = 0;
  const interval = setInterval(() => {
    progress += 100 / steps;
    ui.progressBar.style.width = `${Math.min(progress, 100)}%`;
  }, duration / steps);

  setTimeout(() => {
    clearInterval(interval);
    ui.progressBar.style.width = "100%";
    finishProcessing();
  }, duration);
}

function finishProcessing() {
  state.processing = false;
  ui.progressWrap.hidden = true;
  ui.result.hidden = false;
  ui.langSwitch.disabled = false;
}

function resetAll() {
  state.selectedFile = null;
  state.processing = false;
  ui.result.hidden = true;
  ui.progressWrap.hidden = true;
  ui.progressBar.style.width = "0%";
  ui.scenarioButtons.forEach((b) => (b.disabled = false));
  ui.dropzone.removeAttribute("aria-disabled");
  updateFileInfo();
}

/* ========= Download ========= */
function downloadFile() {
  if (!state.selectedFile) return;
  const ext = state.selectedFile.name.split(".").pop();
  const base = state.selectedFile.name.replace(/\.[^/.]+$/, "");
  const newName = `${base}.cleaned.${ext}`;

  const url = URL.createObjectURL(state.selectedFile);
  const a = document.createElement("a");
  a.href = url;
  a.download = newName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

/* ========= Init ========= */
function attachEvents() {
  ui.langSwitch.addEventListener("change", (e) => setLanguage(e.target.value));

  ui.cleanBtn.addEventListener("click", () => startProcessing());

  ui.resetBtn.addEventListener("click", () => resetAll());

  ui.newBtn.addEventListener("click", () => resetAll());

  ui.downloadBtn.addEventListener("click", () => downloadFile());

  initDropzone();
  initPlans();
  initScenarios();
  initNav();
}

document.addEventListener("DOMContentLoaded", () => {
  initLanguage();
  attachEvents();
});

