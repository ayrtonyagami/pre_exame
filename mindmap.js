// =========================================================
// MAPA MENTAL — importação de Markdown e renderização via markmap
// =========================================================
// Dependências carregadas via <script> no mindmap.html (build UMD):
//   window.d3                          (d3@7)
//   window.markmap.Transformer         (markmap-lib)
//   window.markmap.Markmap, deriveOptions (markmap-view)
//   window.markmap.Toolbar             (markmap-toolbar)

const screens = {
  import: document.getElementById('screen-import'),
  map: document.getElementById('screen-map'),
};

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const importError = document.getElementById('importError');

const mapEyebrow = document.getElementById('mapEyebrow');
const mapTitle = document.getElementById('mapTitle');
const canvasWrap = document.querySelector('.mindmap-canvas-wrap');
const svg = document.getElementById('mindmap');
const fitBtn = document.getElementById('fitBtn');
const downloadBtn = document.getElementById('downloadBtn');
const newFileBtn = document.getElementById('newFileBtn');

let markmapInstance = null;
let currentFileName = '';

// =========================================================
// NAVEGAÇÃO ENTRE TELAS
// =========================================================
function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
}

function showImportError(message) {
  importError.textContent = message;
  importError.hidden = false;
}

function clearImportError() {
  importError.hidden = true;
  importError.textContent = '';
}

// =========================================================
// ESTADOS VISUAIS DO CANVAS (carregando / erro)
// =========================================================
function setCanvasState(html) {
  let stateEl = canvasWrap.querySelector('.canvas-state');
  if (!stateEl) {
    stateEl = document.createElement('div');
    stateEl.className = 'canvas-state';
    canvasWrap.appendChild(stateEl);
  }
  stateEl.classList.remove('is-error');
  stateEl.innerHTML = html;
  stateEl.hidden = false;
  return stateEl;
}

function setCanvasError(message) {
  const stateEl = setCanvasState(`<p>${escapeHTML(message)}</p>`);
  stateEl.classList.add('is-error');
}

function clearCanvasState() {
  const stateEl = canvasWrap.querySelector('.canvas-state');
  if (stateEl) stateEl.hidden = true;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// =========================================================
// IMPORTAÇÃO DE ARQUIVO .md
// =========================================================
dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', (e) => {
  const file = Array.from(e.dataTransfer.files).find((f) =>
    /\.(md|markdown)$/i.test(f.name)
  );
  if (file) {
    handleFile(file);
  } else if (e.dataTransfer.files.length) {
    showImportError('Esse arquivo não parece ser um Markdown (.md). Tente outro arquivo.');
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleFile(file);
  fileInput.value = '';
});

async function handleFile(file) {
  clearImportError();

  let text;
  try {
    text = await file.text();
  } catch (err) {
    showImportError(`Não foi possível ler "${file.name}": ${err.message}`);
    return;
  }

  if (!text.trim()) {
    showImportError(`O arquivo "${file.name}" está vazio.`);
    return;
  }

  currentFileName = file.name;
  const title = guessTitle(text) || file.name.replace(/\.(md|markdown)$/i, '');

  mapEyebrow.textContent = file.name;
  mapTitle.textContent = title;

  showScreen('map');
  await renderMindmap(text);
}

/** Usa o primeiro cabeçalho H1 do markdown como título, se existir. */
function guessTitle(markdownText) {
  const match = markdownText.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// =========================================================
// RENDERIZAÇÃO DO MAPA MENTAL (markmap)
// =========================================================
async function renderMindmap(markdownText) {
  clearCanvasState();
  setCanvasState('<div class="spinner"></div><p>Carregando o mapa mental…</p>');

  const ready = await waitForMarkmapLibs();
  if (!ready) {
    setCanvasError(
      'Não foi possível carregar as bibliotecas do mapa mental (markmap). ' +
      'Verifique sua conexão com a internet — elas são carregadas de um CDN externo — e recarregue a página.'
    );
    return;
  }

  try {
    const { Transformer } = window.markmap;
    const transformer = new Transformer();
    const { root, features } = transformer.transform(markdownText);

    // limpa o SVG e qualquer toolbar anterior antes de redesenhar
    svg.innerHTML = '';
    const oldToolbar = canvasWrap.querySelector('.mm-toolbar');
    if (oldToolbar) oldToolbar.remove();

    if (markmapInstance) {
      try { markmapInstance.destroy(); } catch (_) { /* noop */ }
      markmapInstance = null;
    }

    // assets extras (ex.: ícones/checkboxes) exigidos pelo conteúdo
    const { styles, scripts } = transformer.getUsedAssets(features) || {};
    if (styles || scripts) {
      window.markmap.loadCSS?.(styles);
      window.markmap.loadJS?.(scripts);
    }

    markmapInstance = window.markmap.Markmap.create(svg, {
      duration: 400,
      maxWidth: 320,
      autoFit: true,
    }, root);

    attachToolbar();
    clearCanvasState();
  } catch (err) {
    setCanvasError(`Não foi possível interpretar este Markdown: ${err.message}`);
  }
}

/** Aguarda as libs UMD (d3, markmap-lib, markmap-view, markmap-toolbar) carregarem do CDN. */
function waitForMarkmapLibs(timeoutMs = 8000) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function check() {
      const ok =
        window.d3 &&
        window.markmap &&
        window.markmap.Transformer &&
        window.markmap.Markmap;
      if (ok) return resolve(true);
      if (Date.now() - start > timeoutMs) return resolve(false);
      setTimeout(check, 120);
    })();
  });
}

function attachToolbar() {
  if (!window.markmap.Toolbar) return;
  const { el } = window.markmap.Toolbar.create(markmapInstance);
  el.classList.add('mm-toolbar');
  canvasWrap.appendChild(el);
}

// =========================================================
// AÇÕES DA TELA DE MAPA
// =========================================================
fitBtn.addEventListener('click', () => {
  markmapInstance?.fit();
});

downloadBtn.addEventListener('click', () => {
  if (!svg.querySelector('g')) return;
  const serializer = new XMLSerializer();
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  const source = serializer.serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const baseName = currentFileName.replace(/\.(md|markdown)$/i, '') || 'mapa-mental';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

newFileBtn.addEventListener('click', () => {
  if (markmapInstance) {
    try { markmapInstance.destroy(); } catch (_) { /* noop */ }
    markmapInstance = null;
  }
  svg.innerHTML = '';
  const toolbar = canvasWrap.querySelector('.mm-toolbar');
  if (toolbar) toolbar.remove();
  clearImportError();
  showScreen('import');
});

// re-ajusta o mapa quando a janela é redimensionada
window.addEventListener('resize', () => {
  markmapInstance?.fit();
});
