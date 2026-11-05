const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const context = { document: { getElementById() { return null; } } };
vm.createContext(context);
const source = fs.readFileSync('static/js/ai_assistant.js', 'utf8');
vm.runInContext(source, context);

const block = vm.runInContext(`parseAssistantListBlock([
  '1. primer punto', '', '1. segundo punto', '', '1. último punto', '', 'Párrafo aparte'
], 0)`, context);
assert.deepStrictEqual(JSON.parse(JSON.stringify(block.items)), ['primer punto', 'segundo punto', 'último punto']);
assert.strictEqual(block.ordered, true);
assert.strictEqual(block.nextIndex, 5, 'list stops before the following paragraph');
assert.doesNotMatch(source, /ai-code-language|ai-code-language/);

const highlighter = { console };
vm.createContext(highlighter);
vm.runInContext(fs.readFileSync('static/js/vendor/highlight-full.min.js', 'utf8'), highlighter);
assert.strictEqual(highlighter.hljs.listLanguages().length, 193, 'bundled highlighter includes its full language set when needed');
const jsCode = highlighter.hljs.highlight('const answer = 42;', { language: 'javascript' }).value;
assert.match(jsCode, /class="hljs-/);
const unknownCode = highlighter.hljs.highlightAuto('SELECT * FROM courses WHERE id = 1;').value;
assert.match(unknownCode, /class="hljs-/);
const hostileCode = highlighter.hljs.highlight('<script>alert(1)</script>', { language: 'html' }).value;
assert.doesNotMatch(hostileCode, /<script>/i, 'highlighted code remains escaped HTML');
console.log('ai-assistant-formatting: loose numbered lists and fenced code highlighting across 193 languages passed');
