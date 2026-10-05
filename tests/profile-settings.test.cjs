const assert = require('assert');
const fs = require('fs');

const sidebar = fs.readFileSync('templates/components/sidebar.html', 'utf8');
const profile = fs.readFileSync('templates/views/perfil.html', 'utf8');
const script = fs.readFileSync('static/js/profile.js', 'utf8');
const styles = fs.readFileSync('static/css/profile.css', 'utf8');
const careers = JSON.parse(fs.readFileSync('static/data/udp-careers.json', 'utf8'));

assert.match(sidebar, /<button[^>]+id="auth-profile"[^>]+onclick="abrirPerfil\(\)"/);
assert.match(sidebar, /id="auth-avatar"/);
assert.match(sidebar, /id="auth-name"/);
assert.match(sidebar, /id="auth-email"/);
assert.doesNotMatch(sidebar, /auth-reset-data|auth-logout|push-settings-open/);
for (const id of ['tab-perfil', 'profile-career-input', 'profile-career-save', 'profile-sharing-toggle', 'push-settings-inline', 'profile-community-directory', 'auth-reset-data']) {
  assert.ok(profile.includes(`id="${id}"`), `profile view should contain ${id}`);
}
assert.doesNotMatch(profile, /Configurar notificaciones|Ver perfiles compartidos|push-settings-open|abrirPerfilesComunidad\(\)/);
assert.doesNotMatch(profile, /id="push-(classes|agenda)-toggle"|class="push-option"/);
assert.doesNotMatch(profile, /push-test-example|<select[^>]*push-/);
assert.match(profile, /id="push-enable-toggle"/);
assert.doesNotMatch(profile, /push-test|push-example|push-remove-button/);
assert.match(script, /updateUserMetadata\(\{ career:/);
assert.match(script, /\.select\('share_information'\)\.eq\('id', user\.id\)/);
assert.match(script, /\.update\(\{ share_information: nextValue \}\)\.eq\('id', currentAuth\.user\.id\)/);
assert.match(script, /textContent = item\.name/);
const civilEngineeringCareers = careers.filter(item => item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').startsWith('ingenieria civil'));
assert.strictEqual(civilEngineeringCareers.length, 5, 'the profile selector should offer only Civil Engineering programs');
assert.ok(civilEngineeringCareers.some(item => item.name === 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial'));
assert.match(script, /normalize\(item\.name\)\.startsWith\('ingenieria civil'\)/);
assert.match(script, /avatarWords\[avatarWords\.length - 2\]/);
assert.match(fs.readFileSync('static/js/auth.js', 'utf8'), /words\[words\.length - 2\]/);
assert.match(fs.readFileSync('static/js/community_schedules.js', 'utf8'), /words\[words\.length - 2\]/);
assert.match(styles, /@media \(max-width: 760px\)/);
assert.match(styles, /@media \(max-width: 600px\)/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /getElementById\('push-settings-inline'\)/);
assert.doesNotMatch(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /push-settings-open|push-settings-dialog/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /JSON\.stringify\(\{ classes: true, agenda: true \}\)/);
assert.doesNotMatch(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /\/test|sendTestNotification|TEST_EXAMPLES/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /getElementById\('push-enable-toggle'\)/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /async function deactivate/);
assert.match(fs.readFileSync('app/services/push_notifications.py', 'utf8'), /VALUES\(\?,1,1,\?\)/);
assert.match(fs.readFileSync('static/js/community_schedules.js', 'utf8'), /renderInlineDirectory\(directory/);
console.log(`profile-settings: profile controls, civil-engineering options (${civilEngineeringCareers.length}), and privacy scope verified`);
