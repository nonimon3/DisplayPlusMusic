// Stamp app.json's package_id with a fresh timestamp each pack so EVEN Hub
// sees each ehpk as a brand-new app and replaces any cached install.
// Note: EVEN Hub's native storage is namespaced by package_id, so each fresh
// id also starts with empty storage — the auto-auth path handles this.
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Strip any previous `.tNNNN` suffix so stamps don't accumulate.
const base = app.package_id.replace(/\.t\d+$/, '');
app.package_id = `${base}.t${Date.now()}`;

fs.writeFileSync(jsonPath, JSON.stringify(app, null, 2) + '\n');
console.log(`[bump-id] package_id = ${app.package_id}`);
