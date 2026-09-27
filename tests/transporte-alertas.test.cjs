const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createBrowserContext() {
    const nodes = {
        'metro-lineas-grid': { innerHTML: '', querySelectorAll: () => [] },
        'metro-horario-badge': { innerHTML: '' },
        'metro-alertas-panel': { innerHTML: '', style: {} }
    };
    const context = vm.createContext({
        document: {
            addEventListener() {},
            getElementById: id => nodes[id] || null
        },
        console,
        setTimeout() {},
        setInterval() {}
    });
    vm.runInContext(readFileSync(join(__dirname, '../static/js/transporte.js'), 'utf8'), context);
    return { context, nodes };
}

test('ignora alertas antiguas y resoluciones', () => {
    const { context } = createBrowserContext();
    const fresh = { target: 'L1', lineas: ['L1'], mensaje: 'Interrupcion', ts: new Date().toISOString() };
    const old = { ...fresh, ts: new Date(Date.now() - 30 * 3600000).toISOString() };
    context.alerts = [fresh, old];
    assert.equal(vm.runInContext('filtrarAlertasActivas(alerts).length', context), 1);
    context.alerts = [fresh, { ...fresh, resolucion_global: true }];
    assert.equal(vm.runInContext('filtrarAlertasActivas(alerts).length', context), 0);
});

test('asigna L4A sin marcar L4 y respeta alertas de toda la red', () => {
    const { context } = createBrowserContext();
    context.alerts = [{ lineas: ['L4A'], target: 'L4A' }];
    assert.equal(vm.runInContext('_alertasDeLinea(alerts, "L4").length', context), 0);
    assert.equal(vm.runInContext('_alertasDeLinea(alerts, "L4A").length', context), 1);
    context.alerts = [{ target: 'Toda la red' }];
    assert.equal(vm.runInContext('_alertasDeLinea(alerts, "L4").length', context), 1);
});

test('la carga inicial sin alertas no agrega simulaciones', async () => {
    const { context, nodes } = createBrowserContext();
    context.fetch = async () => ({
        ok: true,
        json: async () => ({
            metro_abierto: true,
            alertas: [],
            lineas_metro: [{
                linea: 'L1', color: '#e11d48', nombre: 'Linea 1',
                terminales: 'A', estaciones_total: 2, longitud_km: '1 km'
            }]
        })
    });
    vm.runInContext('renderBusesList = () => {}', context);
    await vm.runInContext('cargarDatosTransporte()', context);
    assert.match(nodes['metro-horario-badge'].innerHTML, /Red operativa/);
    assert.match(nodes['metro-lineas-grid'].innerHTML, /Operativa/);
    assert.doesNotMatch(nodes['metro-lineas-grid'].innerHTML, /Con problemas|simulacion-l1/);
});

test('el sondeo actualiza las lineas y el estado general con datos de la API', async () => {
    const { context, nodes } = createBrowserContext();
    const line = linea => ({
        linea, color: '#38bdf8', nombre: linea, terminales: 'A',
        estaciones_total: 2, longitud_km: '1 km'
    });
    context.testData = { lineas_metro: [line('L4'), line('L4A')], metro_abierto: true };
    vm.runInContext('datosTransporteCache = testData', context);
    const active = {
        id: 'api-alert', target: 'L4A', lineas: ['L4A'], tipo: 'tramo',
        mensaje: 'Interrupcion', ts: new Date().toISOString()
    };
    context.fetch = async () => ({ ok: true, json: async () => ({ alertas: [active] }) });
    await vm.runInContext('_pollAlertas()', context);
    assert.match(nodes['metro-horario-badge'].innerHTML, /Red afectada/);
    const html = nodes['metro-lineas-grid'].innerHTML;
    const l4 = html.split('id="metro-line-card-L4"')[1].split('id="metro-line-card-L4A"')[0];
    assert.match(l4, /Operativa/);
    assert.doesNotMatch(l4, /Con problemas/);
    assert.match(html.split('id="metro-line-card-L4A"')[1], /Con problemas/);

    context.fetch = async () => ({ ok: false, status: 503 });
    await vm.runInContext('_pollAlertas()', context);
    assert.match(nodes['metro-horario-badge'].innerHTML, /Red afectada/);

    context.fetch = async () => ({ ok: true, json: async () => ({ alertas: [] }) });
    await vm.runInContext('_pollAlertas()', context);
    assert.match(nodes['metro-horario-badge'].innerHTML, /Red operativa/);
    assert.doesNotMatch(nodes['metro-lineas-grid'].innerHTML, /Con problemas/);
});
