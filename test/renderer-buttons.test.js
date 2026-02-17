const test = require('node:test');
const assert = require('node:assert/strict');

class FakeElement {
  constructor(id = '') {
    this.id = id;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.children = [];
    this.onclick = null;
    this.src = '';
    this.className = '';
    this.classList = {
      add: () => {}
    };
    this.listeners = new Map();
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener(name, handler) {
    this.listeners.set(name, handler);
  }
}

function createDomFixture() {
  const requiredIds = [
    'openProjectBtn', 'openZipBtn', 'saveBtn', 'undoBtn', 'redoBtn',
    'pageSelect', 'previewFrame', 'fileTree', 'textValue', 'attrHref',
    'attrSrc', 'attrAlt', 'attrTitle', 'applyBtn', 'status', 'searchInput',
    'searchBtn', 'searchResults', 'projectBadge'
  ];

  const elements = new Map(requiredIds.map((id) => [id, new FakeElement(id)]));

  const document = {
    getElementById: (id) => elements.get(id) || null,
    createElement: () => new FakeElement(),
  };

  const windowListeners = new Map();
  const windowObject = {
    addEventListener: (name, handler) => {
      windowListeners.set(name, handler);
    },
    editorApi: null
  };

  return { elements, document, windowObject, windowListeners };
}

test('toolbar buttons are wired and invoke expected editor API calls', async () => {
  const fixture = createDomFixture();
  const apiCalls = {
    openProject: 0,
    openProjectZip: 0,
    readFile: 0,
    writeFile: 0,
    search: 0,
  };

  const project = {
    projectRoot: '/tmp/site',
    sourceZip: '/tmp/site.zip',
    htmlPages: ['index.html'],
    tree: []
  };

  fixture.windowObject.editorApi = {
    openProject: async () => {
      apiCalls.openProject += 1;
      return project;
    },
    openProjectZip: async () => {
      apiCalls.openProjectZip += 1;
      return project;
    },
    openProjectPath: async () => project,
    readFile: async () => {
      apiCalls.readFile += 1;
      return '<!doctype html><html><head></head><body>ok</body></html>';
    },
    writeFile: async () => {
      apiCalls.writeFile += 1;
      return { ok: true };
    },
    search: async () => {
      apiCalls.search += 1;
      return [{ path: 'index.html', line: 1, snippet: 'ok' }];
    },
    replaceAsset: async () => ({ ok: true }),
    pickAssetFile: async () => null,
    onProjectLoaded: () => () => {},
  };

  global.document = fixture.document;
  global.window = fixture.windowObject;
  global.DOMParser = class {
    parseFromString() {
      return {
        querySelector: () => null,
        documentElement: { outerHTML: '<html></html>' }
      };
    }
  };

  try {
    require('../src/renderer/app.js');

    await fixture.elements.get('openProjectBtn').onclick();
    await fixture.elements.get('openZipBtn').onclick();
    await fixture.elements.get('saveBtn').onclick();
    fixture.elements.get('undoBtn').onclick();
    fixture.elements.get('redoBtn').onclick();
    await fixture.elements.get('searchBtn').onclick();
    await fixture.elements.get('applyBtn').onclick();

    assert.equal(apiCalls.openProject, 1);
    assert.equal(apiCalls.openProjectZip, 1);
    assert.ok(apiCalls.readFile >= 2, 'open actions should load page content');
    assert.ok(apiCalls.writeFile >= 1, 'save should write current page');
    assert.equal(apiCalls.search, 1);
  } finally {
    delete require.cache[require.resolve('../src/renderer/app.js')];
    delete global.document;
    delete global.window;
    delete global.DOMParser;
  }
});
