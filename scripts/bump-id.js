// Bumps app.json's `version` patch number on each pack, while leaving
// `package_id` untouched. Stable package_id preserves EVEN Hub's native
// storage (refresh_token, client_id/secret), so the user doesn't have to
// re-authenticate with Spotify after every reinstall. The version bump
// lets EVEN Hub recognise the new ehpk as an update and replace the old
// code, instead of caching the prior install.
const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const parts = (app.version || '1.0.0').split('.').map(n => Number(n) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1;
app.version = parts.join('.');

fs.writeFileSync(jsonPath, JSON.stringify(app, null, 2) + '\n');
console.log(`[bump-id] package_id=${app.package_id} version=${app.version}`);
