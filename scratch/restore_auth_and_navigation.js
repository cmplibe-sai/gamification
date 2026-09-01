const fs = require('fs');

let app = fs.readFileSync('app.js', 'utf8');
const authSection = fs.readFileSync('scratch/auth_section.js', 'utf8');

// Insert auth section right before the sync interval
const syncMarker = '// Automatic high-frequency cross-browser sync';
const pos = app.indexOf(syncMarker);

if (pos === -1) {
    console.error('Sync marker not found!');
    process.exit(1);
}

app = app.substring(0, pos) + '\n\n' + authSection + '\n\n' + app.substring(pos);

fs.writeFileSync('app.js', app, 'utf8');
console.log('Successfully restored complete authentication and navigation system in app.js');
