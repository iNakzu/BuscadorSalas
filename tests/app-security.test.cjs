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
console.log('app dynamic HTML escaping checks passed');
