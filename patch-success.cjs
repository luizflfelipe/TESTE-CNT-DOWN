const fs = require('fs');
let code = fs.readFileSync('src/components/Motoboy.tsx', 'utf8');

code = code.replace(
  'setMessage({ type: "success", text: "Solicitação de Motoboy criada com sucesso." });',
  'setMessage({ type: "success", text: \`Solicitação \${result.request?.id?.substring(0, 8) || ""} criada com sucesso.\` });'
);

fs.writeFileSync('src/components/Motoboy.tsx', code);
