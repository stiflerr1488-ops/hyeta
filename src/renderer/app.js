const state = {
  project: null,
  currentPage: null,
  currentFileContent: '',
  selectedElementSelector: null,
  undoStack: [],
  redoStack: []
};

const refs = {
  openProjectBtn: document.getElementById('openProjectBtn'),
  openZipBtn: document.getElementById('openZipBtn'),
  saveBtn: document.getElementById('saveBtn'),
  undoBtn: document.getElementById('undoBtn'),
  redoBtn: document.getElementById('redoBtn'),
  pageSelect: document.getElementById('pageSelect'),
  previewFrame: document.getElementById('previewFrame'),
  fileTree: document.getElementById('fileTree'),
  textValue: document.getElementById('textValue'),
  attrHref: document.getElementById('attrHref'),
  attrSrc: document.getElementById('attrSrc'),
  attrAlt: document.getElementById('attrAlt'),
  attrTitle: document.getElementById('attrTitle'),
  applyBtn: document.getElementById('applyBtn'),
  status: document.getElementById('status'),
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  searchResults: document.getElementById('searchResults'),
  projectBadge: document.getElementById('projectBadge')
};

function setStatus(text) {
  refs.status.textContent = text;
  setTimeout(() => {
    if (refs.status.textContent === text) refs.status.textContent = '';
  }, 3000);
}

function renderTree(nodes, host) {
  host.innerHTML = '';
  const renderNodes = (items, container) => {
    items.forEach((node) => {
      const row = document.createElement('div');
      row.className = 'tree-node';
      if (node.type === 'directory') {
        row.textContent = `📁 ${node.name}`;
        container.appendChild(row);
        renderNodes(node.children, row);
      } else {
        row.textContent = `📄 ${node.name}`;
        row.classList.add('tree-file');
        row.onclick = () => {
          if (node.ext === '.html') {
            refs.pageSelect.value = node.path;
            loadPage(node.path);
          }
        };
        container.appendChild(row);
      }
    });
  };

  renderNodes(nodes, host);
}

function pushUndo(nextContent) {
  state.undoStack.push(state.currentFileContent);
  state.currentFileContent = nextContent;
  state.redoStack = [];
}

function loadPreview(relativeHtmlPath) {
  refs.previewFrame.src = `appfs:///${encodeURIComponent(relativeHtmlPath)}`;
}

async function loadPage(relativeHtmlPath) {
  state.currentPage = relativeHtmlPath;
  state.selectedElementSelector = null;
  state.currentFileContent = await window.editorApi.readFile(relativeHtmlPath);
  state.undoStack = [];
  state.redoStack = [];
  loadPreview(relativeHtmlPath);
  setStatus(`Загружено: ${relativeHtmlPath}`);
}

function instrumentPreviewDocument() {
  const iframeDoc = refs.previewFrame.contentDocument;
  if (!iframeDoc) return;

  const script = iframeDoc.createElement('script');
  script.textContent = `
    (() => {
      const buildSelector = (el) => {
        const parts = [];
        let current = el;
        while (current && current.nodeType === 1 && current.tagName.toLowerCase() !== 'html') {
          const tag = current.tagName.toLowerCase();
          const siblings = current.parentElement
            ? Array.from(current.parentElement.children).filter((x) => x.tagName === current.tagName)
            : [current];
          const index = siblings.indexOf(current) + 1;
          parts.unshift(tag + ':nth-of-type(' + index + ')');
          current = current.parentElement;
        }
        return parts.join(' > ');
      };

      document.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        if (!target) return;
        window.parent.postMessage({
          type: 'element-selected',
          payload: {
            selector: buildSelector(target),
            text: target.textContent || '',
            href: target.getAttribute('href') || '',
            src: target.getAttribute('src') || '',
            alt: target.getAttribute('alt') || '',
            title: target.getAttribute('title') || ''
          }
        }, '*');
      }, true);
    })();
  `;
  iframeDoc.head.appendChild(script);
}

function updateSelectionForm(payload) {
  state.selectedElementSelector = payload.selector;
  refs.textValue.value = payload.text;
  refs.attrHref.value = payload.href;
  refs.attrSrc.value = payload.src;
  refs.attrAlt.value = payload.alt;
  refs.attrTitle.value = payload.title;
}

async function applyElementChanges() {
  if (!state.currentPage || !state.selectedElementSelector) return;
  const parser = new DOMParser();
  const doc = parser.parseFromString(state.currentFileContent, 'text/html');
  const target = doc.querySelector(state.selectedElementSelector);

  if (!target) {
    setStatus('Элемент не найден. Кликните в превью еще раз.');
    return;
  }

  target.textContent = refs.textValue.value;

  const attrs = [
    ['href', refs.attrHref.value],
    ['src', refs.attrSrc.value],
    ['alt', refs.attrAlt.value],
    ['title', refs.attrTitle.value]
  ];

  attrs.forEach(([name, value]) => {
    if (value) target.setAttribute(name, value);
    else target.removeAttribute(name);
  });

  const next = '<!doctype html>\n' + doc.documentElement.outerHTML;
  pushUndo(next);
  await window.editorApi.writeFile(state.currentPage, state.currentFileContent);
  loadPreview(state.currentPage);
  setStatus('Элемент обновлен и сохранен');
}

async function saveCurrent() {
  if (!state.currentPage) return;
  await window.editorApi.writeFile(state.currentPage, state.currentFileContent);
  setStatus('Сохранено');
}

function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(state.currentFileContent);
  state.currentFileContent = state.undoStack.pop();
  window.editorApi.writeFile(state.currentPage, state.currentFileContent);
  loadPreview(state.currentPage);
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(state.currentFileContent);
  state.currentFileContent = state.redoStack.pop();
  window.editorApi.writeFile(state.currentPage, state.currentFileContent);
  loadPreview(state.currentPage);
}

async function runProjectSearch() {
  const results = await window.editorApi.search(refs.searchInput.value);
  refs.searchResults.textContent = results.length
    ? results
        .slice(0, 200)
        .map((r) => `${r.path}:${r.line}  ${r.snippet}`)
        .join('\n')
    : 'Ничего не найдено';
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'element-selected') {
    updateSelectionForm(event.data.payload);
  }
});

async function loadProjectData(project) {
  if (!project) return;
  state.project = project;
  renderTree(project.tree, refs.fileTree);

  refs.pageSelect.innerHTML = '';
  project.htmlPages.forEach((page) => {
    const option = document.createElement('option');
    option.value = page;
    option.textContent = page;
    refs.pageSelect.appendChild(option);
  });

  if (project.htmlPages[0]) {
    refs.pageSelect.value = project.htmlPages[0];
    await loadPage(project.htmlPages[0]);
  }

  const sourceLabel = project.sourceZip
    ? `ZIP: ${project.sourceZip.split(/[\\/]/).pop()}`
    : `Папка: ${project.projectRoot.split(/[\\/]/).pop()}`;
  refs.projectBadge.textContent = sourceLabel;

  if (project.sourceZip) {
    setStatus(`ZIP распакован: ${project.sourceZip}`);
  }
}

refs.openProjectBtn.onclick = async () => {
  const project = await window.editorApi.openProject();
  await loadProjectData(project);
};

refs.openZipBtn.onclick = async () => {
  const project = await window.editorApi.openProjectZip();
  await loadProjectData(project);
};

refs.pageSelect.onchange = () => loadPage(refs.pageSelect.value);
refs.applyBtn.onclick = applyElementChanges;
refs.saveBtn.onclick = saveCurrent;
refs.undoBtn.onclick = undo;
refs.redoBtn.onclick = redo;
refs.searchBtn.onclick = runProjectSearch;

refs.previewFrame.addEventListener('load', () => {
  instrumentPreviewDocument();
});

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 's') {
    event.preventDefault();
    saveCurrent();
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    undo();
  }
  if (event.ctrlKey && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    redo();
  }
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    refs.searchInput.focus();
  }
});
// updated-all-files

setStatus('Интерфейс на русском. Откройте папку или ZIP-архив с вашим сайтом, чтобы начать работу.');
