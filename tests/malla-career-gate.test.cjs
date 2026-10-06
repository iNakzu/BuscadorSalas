const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('static/js/app.js', 'utf8');
const profile = fs.readFileSync('static/js/profile.js', 'utf8');
const guardStart = app.indexOf("if ((panelId === 'tab-malla' || panelId === 'tab-progreso')");
const guardEnd = app.indexOf("document.querySelectorAll('.tab-btn')", guardStart);
assert(guardStart >= 0 && guardEnd > guardStart, 'malla career guard should run before changing active tabs');
const guard = app.slice(guardStart, guardEnd);
assert(guard.includes('mostrarAvisoAccesoMalla()'), 'missing career should open the malla information popup');
assert(!guard.includes('abrirPerfil()'), 'missing career should not redirect away from the current view');
assert(app.includes('Selecciona y guarda tu carrera en Mi perfil para ingresar a la vista de malla.'));
assert(app.includes("button.textContent = 'Ir a Mi perfil'"));
assert(app.includes("button.textContent = 'Continuar con Google'"), 'login-required sections should keep their Google sign-in prompt');
assert(!profile.includes('requireCareer'), 'career requirement is handled by the navigation popup');
console.log('malla-career-gate: asks for career without redirecting from the current section');
