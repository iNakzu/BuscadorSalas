const assert = require('assert');
const fs = require('fs');

const template = fs.readFileSync('templates/index.html', 'utf8');
const assistant = fs.readFileSync('static/js/ai_assistant.js', 'utf8');

assert.doesNotMatch(template, /<script[^>]+src=["'][^"']*highlight-full\.min\.js/i,
  'the 1.2 MB code highlighter must not be downloaded on every page visit');
assert.doesNotMatch(template, /<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/katex/i,
  'math rendering should not add its optional library to the initial page load');
assert.match(assistant, /function ensureHighlighter\(\)/);
assert.match(assistant, /script\.async = true/);
assert.match(assistant, /document\.head\.appendChild\(script\)/);
assert.match(assistant, /code\.textContent = rawCode/,
  'code remains readable before the optional highlighter finishes loading');
assert.match(assistant, /\.catch\(\(\) => \{\}\)/,
  'a highlighter network failure must leave the plain code visible');
assert.match(assistant, /function ensureKatex\(\)/);
assert.match(assistant, /script\.integrity = 'sha384-QFFtAGzvvj\+bfgCGxXJlNZZR1nXEZgvG8tDLCCY1F19xl20WlfTYgguB4VcNdxYk'/,
  'the deferred math library keeps its Subresource Integrity check');
assert.match(assistant, /math\.textContent = readableLatex\(formula\)/,
  'math remains readable if its optional renderer cannot load');
console.log('ai-optional-libraries: large code and math libraries are deferred with readable fallbacks');
