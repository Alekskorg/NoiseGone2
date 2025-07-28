const i18n = {
  ru: {
    title: "Очистка аудио от шума онлайн",
    desc: "Быстро удаляйте шум и делайте аудио чище — бесплатно для файлов до 5 минут!",
    drag: "Перетащите файл сюда или кликните для выбора",
    formats: "Форматы: WAV, MP3, M4A · до 50MB",
    clean: "Очистить шум",
    newfile: "Новый файл",
    presets: ["🎙️ Подкаст", "🗣️ Интервью", "🎧 Озвучка", "🌳 Field"],
    free: "Бесплатно:",
    limitText: "до 5 минут в сутки. После — платно (UI-заглушка).",
    done: "Готово! Скачать",
    downloading: "Скачивается…",
    uploading: "Загрузка…",
    processing: "Обработка…",
    download: "Скачать очищенный файл",
    fileInfo: (name, size) => `📄 ${name} (${(size/1024/1024).toFixed(2)} MB)`,
    errors: {
      413: "Файл слишком большой (максимум 50MB или 5 минут).",
      415: "Неподдерживаемый формат файла (только WAV, MP3, M4A).",
      500: "Ошибка сервера. Попробуйте позже.",
      400: "Файл или пресет не выбраны.",
      timeout: "Время ожидания истекло. Попробуйте ещё раз.",
      default: "Произошла ошибка. Проверьте файл."
    }
  },
  en: {
    title: "Online audio noise remover",
    desc: "Quickly remove noise and make your audio cleaner — free for files up to 5 minutes!",
    drag: "Drag file here or click to select",
    formats: "Formats: WAV, MP3, M4A · up to 50MB",
    clean: "Clean noise",
    newfile: "New file",
    presets: ["🎙️ Podcast", "🗣️ Interview", "🎧 Voice-over", "🌳 Field"],
    free: "Free:",
    limitText: "up to 5 minutes per day. After that — paid (UI only).",
    done: "Done! Download",
    downloading: "Downloading…",
    uploading: "Uploading…",
    processing: "Processing…",
    download: "Download cleaned file",
    fileInfo: (name, size) => `📄 ${name} (${(size/1024/1024).toFixed(2)} MB)`,
    errors: {
      413: "File too large (max 50MB or 5 minutes).",
      415: "Unsupported file type (WAV, MP3, M4A only).",
      500: "Server error. Please try later.",
      400: "File or preset not selected.",
      timeout: "Request timeout. Please try again.",
      default: "An error occurred. Check your file."
    }
  }
};

let lang = "ru";
let selectedPreset = "podcast";
let file = null;
let fileUrl = null;

const $ = sel => document.querySelector(sel);

function setLang(l) {
  lang = l;
  $("html").lang = l;
  const t = i18n[l];
  $("#title").textContent = t.title;
  $("#desc").textContent = t.desc;
  $("#dropText").textContent = t.drag;
  $("#formats").textContent = t.formats;
  $("#cleanBtn").textContent = t.clean;
  $("#resetBtn").textContent = t.newfile;
  $("#langBtn").textContent = l === "ru" ? "EN" : "RU";
  document.querySelectorAll(".preset-btn").forEach((btn, i) => {
    btn.textContent = t.presets[i];
  });
  $(".limits").innerHTML = `<strong>${t.free}</strong> ${t.limitText}`;
  if (file) showFileInfo();
  $("#status").textContent = "";
}
function toggleLang() {
  setLang(lang === "ru" ? "en" : "ru");
}
function showFileInfo() {
  const t = i18n[lang];
  if (!file) {
    $("#fileInfo").hidden = true;
    return;
  }
  $("#fileInfo").hidden = false;
  $("#fileInfo").textContent = t.fileInfo(file.name, file.size);
}
function resetState() {
  file = null;
  fileUrl = null;
  $("#fileInput").value = "";
  $("#fileInfo").hidden = true;
  $("#cleanBtn").disabled = true;
  $("#resetBtn").hidden = true;
  $("#progressBox").hidden = true;
  $("#status").textContent = "";
  var downloadBtn = $("#downloadBtn");
  if (downloadBtn) downloadBtn.remove();
  $("#uploadForm").classList.remove("success");
}
function onPreset(e) {
  document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
  e.target.classList.add("active");
  selectedPreset = e.target.dataset.preset;
}
function onFileInput(f) {
  if (!f) return;
  file = f;
  showFileInfo();
  $("#cleanBtn").disabled = false;
  $("#resetBtn").hidden = false;
  $("#status").textContent = "";
}
$("#langBtn").onclick = toggleLang;
setLang(lang);
document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.onclick = onPreset;
  btn.onkeydown = e => {
    if (e.key === "Enter" || e.key === " ") {
      btn.click();
      e.preventDefault();
    }
  };
});
$("#dropText").onclick = () => $("#fileInput").click();
$(".dropzone").ondragover = e => {
  e.preventDefault();
  $(".dropzone").classList.add("dragover");
};
$(".dropzone").ondragleave = e => {
  $(".dropzone").classList.remove("dragover");
};
$(".dropzone").ondrop = e => {
  e.preventDefault();
  $(".dropzone").classList.remove("dragover");
  const files = e.dataTransfer.files;
  if (files && files.length) onFileInput(files[0]);
};
$("#fileInput").onchange = e => {
  if (e.target.files.length) onFileInput(e.target.files[0]);
};
$("#resetBtn").onclick = resetState;
$("#uploadForm").onsubmit = async e => {
  e.preventDefault();
  if (!file) return;
  $("#cleanBtn").disabled = true;
  $("#progressBox").hidden = false;
  $("#progressBar").value = 0;
  $("#progressText").textContent = i18n[lang].uploading;
  $("#status").textContent = "";
  var downloadBtn = $("#downloadBtn");
  if (downloadBtn) downloadBtn.remove();
  // UI-ONLY demo, имитация загрузки/обработки
  setTimeout(() => {
    $("#progressBar").value = 100;
    $("#progressText").textContent = i18n[lang].done;
    const btn = document.createElement("a");
    btn.href = "#";
    btn.download = file.name;
    btn.textContent = i18n[lang].download;
    btn.className = "main-download";
    btn.id = "downloadBtn";
    btn.onclick = () => setTimeout(() => resetState(), 800);
    $("#progressBox").after(btn);
    $("#uploadForm").classList.add("success");
    $("#resetBtn").hidden = false;
  }, 1800);
};
window.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && document.activeElement === $(".dropzone") && file) {
    $("#cleanBtn").focus();
  }
});
resetState();


