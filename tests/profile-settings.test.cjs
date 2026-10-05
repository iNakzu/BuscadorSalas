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
assert.match(profile, /id="push-enable-button"/);
assert.doesNotMatch(profile, /push-test|push-example|push-remove-button/);
assert.match(script, /updateUserMetadata\(\{ career:/);
assert.match(script, /\.select\('share_information'\)\.eq\('id', user\.id\)/);
assert.match(script, /\.update\(\{ share_information: nextValue \}\)\.eq\('id', currentAuth\.user\.id\)/);
assert.match(script, /textContent = item\.name/);
assert.ok(careers.length >= 40, 'catalog should cover the current official undergraduate program list');
assert.ok(careers.some(item => item.name === 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial'));
assert.match(styles, /@media \(max-width: 760px\)/);
assert.match(styles, /@media \(max-width: 600px\)/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /getElementById\('push-settings-inline'\)/);
assert.doesNotMatch(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /push-settings-open|push-settings-dialog/);
assert.match(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /JSON\.stringify\(\{ classes: true, agenda: true \}\)/);
assert.doesNotMatch(fs.readFileSync('static/js/push_notifications.js', 'utf8'), /\/test|sendTestNotification|TEST_EXAMPLES/);
assert.match(fs.readFileSync('static/js/community_schedules.js', 'utf8'), /renderInlineDirectory\(directory/);
console.log(`profile-settings: compact sidebar, personal controls, scoped privacy, and ${careers.length} career suggestions verified`);
