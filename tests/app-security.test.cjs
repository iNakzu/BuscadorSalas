const assert = require('assert').strict;
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('static/js/app.js', 'utf8');
const helpers = source.match(/^function escapeAppHtml[\s\S]*?^}/m)[0]
    + '\n' + source.match(/^function appJsArg[\s\S]*?^}/m)[0];
const context = {};
vm.runInNewContext(`${helpers}\nthis.escapeAppHtml = escapeAppHtml; this.appJsArg = appJsArg;`, context);

const hostile = `</div><img src=x onerror="alert(1)">&'`;
assert.equal(
    context.escapeAppHtml(hostile),
    '&lt;/div&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;'
);
const inlineArgument = context.appJsArg(`");alert(1);//<svg onload=alert(1)>`);
assert(!inlineArgument.includes('<'));
assert(inlineArgument.includes('&lt;svg'));

for (const field of ['p.curso', 'p.profe', 'p.sala', 'r.curso', "String(c.ramo_malla || '').toUpperCase()", 'c.profe']) {
    assert(source.includes(`escapeAppHtml(${field})`), `unescaped academic field: ${field}`);
}
assert(source.includes('verHorarioDirecto(${appJsArg(p.sala)})'));
assert(source.includes('seleccionarSala(${appJsArg(s)})'));

const agendaSource = fs.readFileSync('static/js/agenda.js', 'utf8');
const agendaHelpers = agendaSource.match(/^function escapeAgendaHtml[\s\S]*?^}/m)[0]
    + '\n' + agendaSource.match(/^function agendaJsArg[\s\S]*?^}/m)[0];
const agendaContext = {};
vm.runInNewContext(`${agendaHelpers}\nthis.escapeAgendaHtml = escapeAgendaHtml; this.agendaJsArg = agendaJsArg;`, agendaContext);
assert.equal(
    agendaContext.escapeAgendaHtml(hostile),
    '&lt;/div&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;'
);
assert(!agendaContext.agendaJsArg(hostile).includes('<'));
assert(agendaSource.includes('data-val="${escapeAgendaHtml(r)}"'));
assert(agendaSource.includes('data-val="${escapeAgendaHtml(ev.ramo)}"'));
assert(agendaSource.includes('const displayText = escapeAgendaHtml;'));
assert(agendaSource.includes('toggleCompletado(${agendaJsArg(ev.id)})'));

const horarioSource = fs.readFileSync('static/js/horario.js', 'utf8');
const horarioHelpers = horarioSource.match(/^function escapeHtml[\s\S]*?^}/m)[0]
    + '\n' + horarioSource.match(/^function horarioJsArg[\s\S]*?^}/m)[0];
const horarioContext = {};
vm.runInNewContext(`${horarioHelpers}\nthis.escapeHtml = escapeHtml; this.horarioJsArg = horarioJsArg;`, horarioContext);
assert.equal(horarioContext.escapeHtml(hostile), '&lt;/div&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#039;');
assert(!horarioContext.horarioJsArg(hostile).includes('<'));
assert(horarioSource.includes('verHorarioDirecto(${horarioJsArg(s)})'));
assert(horarioSource.includes('seleccionarSalaModal(${horarioJsArg(s)})'));
assert(horarioSource.includes('JSON.parse(${objSafe})'));
for (const field of ['c.sala', 'c.profesor || \'-\'', 'c.diaNombre', 'c.horaInicio', 'c.tipo', 'getShortTipo(c.tipo)']) {
    assert(horarioSource.includes(`escapeHtml(${field})`), `unescaped shared schedule field: ${field}`);
}
assert(horarioSource.includes('<span>${escapeHtml(mensaje)}</span>'));

const notasSource = fs.readFileSync('static/js/notas.js', 'utf8');
const notasHelpers = notasSource.match(/^function notasJsArg[\s\S]*?^}/m)[0];
const notasContext = { escapeHtml: horarioContext.escapeHtml };
vm.runInNewContext(`${notasHelpers}\nthis.notasJsArg = notasJsArg;`, notasContext);
assert(!notasContext.notasJsArg(hostile).includes('<'));
assert(notasSource.includes('data-val="${escapeHtml(originalCourse)}"'));
assert(notasSource.includes('updateNotaItem(${notasJsArg(dbKey)}'));
assert(notasSource.includes('updateGlobalNota(${notasJsArg(dbKey)}'));
assert(notasSource.includes('addNotaItem(${notasJsArg(dbKey)})'));
console.log('dynamic HTML and inline-handler escaping checks passed');
