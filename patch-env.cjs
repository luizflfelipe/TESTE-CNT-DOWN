const fs = require('fs');

let envExample = fs.readFileSync('.env.example', 'utf8');

if (!envExample.includes('MOTOBOY_STORAGE')) {
  envExample += `
# Use 'supabase' para usar o Supabase no backend de Motoboy, ou vazio/'apps_script' para manter via Google Apps Script
MOTOBOY_STORAGE=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
`;
  fs.writeFileSync('.env.example', envExample);
}
