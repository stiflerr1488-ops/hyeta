const fs = require('fs/promises');
const path = require('path');

const INDEXABLE_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.svg', '.png', '.webp', '.ico', '.xml', '.webmanifest', '.json', '.txt', '.php'
]);

const TEXT_EXTENSIONS = new Set(['.html', '.css', '.js', '.svg', '.xml', '.webmanifest', '.json', '.txt', '.php']);

async function walk(root, relative = '') {
  const absolute = path.join(root, relative);
  const entries = await fs.readdir(absolute, { withFileTypes: true });
  const children = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      children.push({
        type: 'directory',
        name: entry.name,
        path: rel,
        children: await walk(root, rel)
      });
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!INDEXABLE_EXTENSIONS.has(ext)) continue;
      children.push({
        type: 'file',
        name: entry.name,
        path: rel,
        ext
      });
    }
  }

  return children;
}

function collectHtmlFiles(tree, result = []) {
  for (const node of tree) {
    if (node.type === 'directory') collectHtmlFiles(node.children, result);
    if (node.type === 'file' && node.ext === '.html') result.push(node.path);
  }
  return result;
}

async function buildProjectIndex(projectRoot) {
  const tree = await walk(projectRoot);
  const htmlPages = collectHtmlFiles(tree);
  return {
    tree,
    htmlPages
  };
}

async function findInProject(projectRoot, query) {
  const tree = await walk(projectRoot);
  const files = [];

  const flatten = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'directory') flatten(node.children);
      else files.push(node);
    }
  };

  flatten(tree);
  const results = [];
  for (const file of files) {
    if (!TEXT_EXTENSIONS.has(file.ext)) continue;
    const content = await fs.readFile(path.join(projectRoot, file.path), 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          path: file.path,
          line: idx + 1,
          snippet: line.trim().slice(0, 240)
        });
      }
    });
  }

  return results;
}

module.exports = {
  buildProjectIndex,
  findInProject,
  collectHtmlFiles
};
// updated-all-files
