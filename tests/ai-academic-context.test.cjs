const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('static/js/ai_assistant.js', 'utf8');
const match = source.match(/function getAcademicContext\(\) \{([\s\S]*?)\n    \}/);
assert.ok(match, 'academic context builder should exist');
assert.match(match[1], /mi_horario_custom_v1/, 'the assistant should retain schedule context');
assert.doesNotMatch(match[1], /mi_notas_v1|mi_agenda_v1|notas:|agenda:/,
  'grades and agenda must not be read or sent as assistant context');
console.log('ai-academic-context: only the authorized schedule context is included');
