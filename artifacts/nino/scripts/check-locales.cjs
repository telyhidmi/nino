// Run with node scripts/check-locales.cjs. No app, credentials, or network needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const languages = ['en', 'ar', 'pt', 'es', 'fr', 'de', 'it', 'tr', 'ru', 'hi', 'zh', 'ja'];
const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const allKeys = new Set();
let total = 0;
for (const domain of ['feed', 'camera', 'profile', 'discover']) {
  const filename = path.join(root, 'lib/locales', `${domain}.ts`);
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const sandbox = { exports: {} };
  vm.runInNewContext(compiled, sandbox, { filename });
  const english = sandbox.exports[`${domain}En`];
  const locales = sandbox.exports[`${domain}Locales`];
  const keys = Object.keys(english).sort();
  assert.deepEqual(Object.keys(locales).sort(), [...languages].sort(), `${domain}: supported languages`);
  for (const key of keys) {
    assert(!allKeys.has(key), `Duplicate key across domains: ${key}`);
    allKeys.add(key);
  }
  for (const language of languages) {
    assert.deepEqual(Object.keys(locales[language]).sort(), keys, `${domain}/${language}: key parity`);
    for (const key of keys) {
      const value = locales[language][key];
      assert.equal(typeof value, 'string', `${language}/${key}: string required`);
      assert(value.trim(), `${language}/${key}: empty translation`);
      assert.deepEqual(placeholders(value), placeholders(english[key]), `${language}/${key}: interpolation parity`);
    }
  }
  total += keys.length;
  console.log(`${domain}: ${keys.length} keys × ${languages.length} languages OK`);
}
// Detect accidentally untranslated JSX literals and mistyped domain translation keys.
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { inspect(filename); continue; }
    if (!filename.endsWith('.tsx')) continue;
    const file = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      // Brand wordmark and standard file-size unit are intentionally invariant.
      if (ts.isJsxText(node) && /[a-zA-Z]/.test(node.text) && !['Nin', 'MB'].includes(node.text.trim())) {
        assert.fail(`${filename}: untranslated JSX text: ${node.text.trim()}`);
      }
      if (ts.isCallExpression(node) && node.expression.getText(file) === 't' &&
          node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        const key = node.arguments[0].text;
        if (/^(feed|camera|profile|discover)[A-Z]/.test(key) && key !== 'profileReady') {
          assert(allKeys.has(key), `${filename}: unknown translation ${key}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
}
for (const domain of ['feed', 'profile', 'discover']) inspect(path.join(root, 'components', domain));
console.log(`PASS: ${total} interface keys across all 12 languages; JSX and key references checked.`);