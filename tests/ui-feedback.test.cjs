const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const elements = {};
const originalFocus = { focus() { document.activeElement = this; } };
const document = {
    activeElement: originalFocus,
    body: { appendChild(element) { elements[element.id] = element; } },
    contains(element) { return element === originalFocus || Object.values(elements).includes(element); },
    getElementById(id) { return elements[id] || null; },
    createElement() {
        const element = { id: '', className: '', style: {}, onclick: null, onkeydown: null };
        Object.defineProperty(element, 'innerHTML', {
            get() { return this.html || ''; },
            set(html) {
                this.html = html;
                for (const [, id] of html.matchAll(/id="([^"]+)"/g)) {
                    elements[id] = { id, focus() { document.activeElement = this; }, onclick: null };
                }
            }
        });
        return element;
    }
};
const context = { document };
vm.createContext(context);
vm.runInContext(fs.readFileSync('static/js/ui_feedback.js', 'utf8'), context);

let continued = false;
context.mostrarUiFeedback({
    title: 'Tu espacio personal',
    message: 'Inicia sesión para continuar.',
    primaryLabel: 'Continuar con Google',
    onPrimary: () => { context.cerrarUiFeedback(); continued = true; },
    closeOnBackdrop: true
});
const modal = elements['ui-feedback-modal'];
assert(modal.innerHTML.includes('role="dialog"'));
assert.strictEqual(document.activeElement, elements['ui-feedback-primary-action']);
elements['ui-feedback-primary-action'].onclick();
assert(continued, 'primary action should run');
assert.strictEqual(modal.style.display, 'none');
assert.strictEqual(document.activeElement, originalFocus, 'closing should restore focus');

context.mostrarUiFeedback({ title: 'Requisito pendiente', items: ['Termodinámica <script>'] });
assert(modal.innerHTML.includes('Termodinámica &lt;script&gt;'), 'dynamic text should be escaped');

let confirmed = false;
context.confirmarWeb('¿Continuar?', () => { confirmed = true; });
elements['ui-feedback-primary-action'].onclick();
assert(confirmed, 'confirmation action should run');
assert.strictEqual(modal.style.display, 'none');

console.log('ui-feedback: shared dialog, accessible focus, escaped content and actions passed');
