const fs = require('fs');
const path = require('path');

const clientSrc = path.resolve(__dirname, '../Client/src');
const packageJsonPath = path.resolve(__dirname, '../Client/package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const installedDeps = { ...pkg.dependencies, ...pkg.devDependencies };

const lucideExports = Object.keys(require(path.resolve(__dirname, '../Client/node_modules/lucide-react')));

function getAllFiles(dir, exts = ['.js', '.jsx']) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else {
      if (exts.includes(path.extname(file))) {
        results.push(fullPath);
      }
    }
  });
  return results;
}

const files = getAllFiles(clientSrc);
console.log(`Auditing ${files.length} client source files...`);

const problems = [];

files.forEach(filePath => {
  const relPath = path.relative(clientSrc, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Check imports
  // regex for import ... from '...'
  const importRegex = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importedClause = match[1].trim();
    const importSource = match[2].trim();

    // 1. Check external packages
    if (!importSource.startsWith('.')) {
      const parts = importSource.split('/');
      let pkgName = parts[0];
      if (pkgName.startsWith('@')) {
        pkgName = `${parts[0]}/${parts[1]}`;
      }
      if (!installedDeps[pkgName] && !['react', 'react-dom'].includes(pkgName)) {
        problems.push({ file: relPath, type: 'MISSING_DEPENDENCY', detail: `${pkgName} not in package.json (source: ${importSource})` });
      }

      // Check lucide-react icons
      if (importSource === 'lucide-react') {
        // Parse named imports: { A, B as C, D }
        const namedMatch = importedClause.match(/\{([\s\S]*)\}/);
        if (namedMatch) {
          const names = namedMatch[1].split(',').map(s => s.trim()).filter(Boolean);
          names.forEach(nameDef => {
            const origName = nameDef.split(/\s+as\s+/)[0].trim();
            if (origName && !lucideExports.includes(origName)) {
              problems.push({ file: relPath, type: 'INVALID_LUCIDE_ICON', detail: `Icon "${origName}" does not exist in lucide-react` });
            }
          });
        }
      }
      continue;
    }

    // 2. Relative local import: check file existence and exact casing
    const dir = path.dirname(filePath);
    let resolved = path.resolve(dir, importSource);
    let exists = false;
    let actualPath = '';

    const candidates = [
      resolved,
      resolved + '.jsx',
      resolved + '.js',
      resolved + '.css',
      path.join(resolved, 'index.jsx'),
      path.join(resolved, 'index.js')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        exists = true;
        actualPath = cand;
        break;
      }
    }

    if (!exists) {
      problems.push({ file: relPath, type: 'IMPORT_NOT_FOUND', detail: `Cannot resolve import "${importSource}"` });
    } else {
      // Check casing by walking directory
      const segments = path.relative(path.resolve(clientSrc, '..'), actualPath).split(path.sep);
      let curr = path.resolve(clientSrc, '..');
      for (const seg of segments) {
        if (!fs.existsSync(curr)) break;
        const realEntries = fs.readdirSync(curr);
        const matchEntry = realEntries.find(e => e.toLowerCase() === seg.toLowerCase());
        if (matchEntry && matchEntry !== seg) {
          problems.push({ file: relPath, type: 'CASING_MISMATCH', detail: `Import ${importSource} expects segment "${seg}" but on disk it is "${matchEntry}"` });
        }
        curr = path.join(curr, seg);
      }
    }
  }
});

console.log(`Found ${problems.length} problem(s):`);
console.log(JSON.stringify(problems, null, 2));

