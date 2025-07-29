
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.createElement('button');
  installBtn.className = 'btn secondary';
  installBtn.textContent = 'Install';
  installBtn.style.marginLeft = 'auto';
  document.querySelector('.topbar-inner').appendChild(installBtn);
  installBtn.addEventListener('click', async () => {
    installBtn.remove();
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
  });
});

window.addEventListener('appinstalled', () =>
  utils.showToast('App installed! 🎉')
);

// === Web Worker ===
const worker = new Worker('/worker.js');

// …------ остальной код предыдущего main.js остаётся ------…

/* ========= Processing (через mocked /api/clean) ========= */
async function startProcessing() {
  if (!state.selectedFile || state.processing) return;

  if (!navigator.onLine) {
    utils.showToast(i18n[state.lang].offlineProcessing);
    return;
  }

  state.processing = true;
  ui.cleanBtn.disabled = true;
  ui.resetBtn.disabled = true;
  ui.recordBtn.disabled = true;
  ui.scenarioButtons.forEach((b) => (b.disabled = true));
  ui.langSwitch.disabled = true;
  ui.dropzone.setAttribute('aria-disabled', 'true');

  ui.progressWrap.hidden = false;
  ui.progressBar.style.width = '0%';

  let prog = 0;
  async function poll() {
    try {
      const res = await fetch(`/api/clean?prog=${prog}`);
      const data = await res.json();
      prog = data.progress;
      ui.progressBar.style.width = `${prog * 100}%`;
      if (prog < 1) {
        setTimeout(poll, 1000);
      } else {
        finishProcessing();
      }
    } catch {
      utils.showToast(i18n[state.lang].serverError);
      resetAll();
    }
  }
  poll();
}

function finishProcessing() {
  state.processing = false;
  ui.progressWrap.hidden = true;
  ui.result.hidden = false;
  ui.langSwitch.disabled = false;
}

function downloadFile() {
  if (!state.selectedFile) return;
  worker.postMessage({ file: state.selectedFile });
}

worker.onmessage = (e) => {
  const { blob, name } = e.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
};

// === i18n дополнение ===
i18n.en.offlineProcessing = 'Processing unavailable offline';
i18n.ru.offlineProcessing = 'Обработка недоступна офлайн';
i18n.en.serverError = 'Server error';
i18n.ru.serverError = 'Ошибка сервера';

// … остальной init & events без изменений …

