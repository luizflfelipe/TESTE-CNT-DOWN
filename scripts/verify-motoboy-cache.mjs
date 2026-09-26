import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverTsPath = path.resolve(__dirname, '../server.ts');

function runCheck() {
  if (!fs.existsSync(serverTsPath)) {
    console.error("❌ server.ts não encontrado.");
    process.exit(1);
  }

  const serverTs = fs.readFileSync(serverTsPath, 'utf8');

  let passed = true;

  function assert(condition, message) {
    if (!condition) {
      console.error("❌ " + message);
      passed = false;
    } else {
      console.log("✅ " + message);
    }
  }

  assert(/let\s+motoboyCache\s*:\s*Record<string,\s*MotoboyCacheData>\s*=\s*{}/.test(serverTs) || /const\s+motoboyCache\s*=/.test(serverTs) || /motoboyCache/.test(serverTs), "Deve haver uma estrutura de cache específica para Motoboy (motoboyCache).");
  
  assert(/MOTOBOY_CACHE_TTL/.test(serverTs), "Deve existir uma variável TTL para o cache Motoboy.");
  
  // Verifica separação por role no GET
  assert(/const\s+cacheKey\s*=\s*`\$\{role\}_\$\{view\}`/.test(serverTs), "O cache Motoboy deve ser separado por role e visualização.");
  
  const getRouteIndex = serverTs.indexOf('app.get("/api/motoboy/requests"');
  if (getRouteIndex === -1) {
    console.error("❌ Rota GET /api/motoboy/requests não encontrada.");
    passed = false;
  } else {
    const getRouteSnippet = serverTs.substring(getRouteIndex, getRouteIndex + 2500);
    assert(/motoboyCache\[cacheKey\]/.test(getRouteSnippet), "O cache deve ser verificado pela chave de role e visualização na rota GET.");
    assert(/cached\.timestamp/.test(getRouteSnippet) && /requests:\s*cached\.requests/.test(getRouteSnippet), "O GET deve retornar os requests em cache no mesmo formato.");
  }

  // Verifica invalidação após POST, PATCH e DELETE
  const postRouteIndex = serverTs.indexOf('app.post("/api/motoboy/requests"');
  if (postRouteIndex > -1) {
    const snippet = serverTs.substring(postRouteIndex, postRouteIndex + 5000);
    assert(/clearMotoboyCache\(\)/.test(snippet) || /motoboyCache\s*=\s*{}/.test(snippet), "Deve invalidar o cache na rota POST /api/motoboy/requests.");
  } else {
    assert(false, "Rota POST /api/motoboy/requests não encontrada.");
  }

  const patchRouteIndex = serverTs.indexOf('app.patch("/api/motoboy/requests/:id"');
  if (patchRouteIndex > -1) {
    const snippet = serverTs.substring(patchRouteIndex, patchRouteIndex + 5000);
    assert(/clearMotoboyCache\(\)/.test(snippet) || /motoboyCache\s*=\s*{}/.test(snippet), "Deve invalidar o cache na rota PATCH /api/motoboy/requests/:id.");
  } else {
    assert(false, "Rota PATCH /api/motoboy/requests/:id não encontrada.");
  }

  const deleteRouteIndex = serverTs.indexOf('app.delete("/api/motoboy/requests/:id"');
  if (deleteRouteIndex > -1) {
    const snippet = serverTs.substring(deleteRouteIndex, deleteRouteIndex + 5000);
    assert(/clearMotoboyCache\(\)/.test(snippet) || /motoboyCache\s*=\s*{}/.test(snippet), "Deve invalidar o cache na rota DELETE /api/motoboy/requests/:id.");
  } else {
    assert(false, "Rota DELETE /api/motoboy/requests/:id não encontrada.");
  }

  const homologacaoGsPath = path.resolve(__dirname, '../apps-script/Controle-Motoboy-homologacao.gs');
  const homologacaoGs = fs.existsSync(homologacaoGsPath) ? fs.readFileSync(homologacaoGsPath, 'utf8') : '';
  
  if (homologacaoGs) {
    const listMotoboyIndex = homologacaoGs.indexOf('function listMotoboyRequests_');
    if (listMotoboyIndex > -1) {
      const snippet = homologacaoGs.substring(listMotoboyIndex, listMotoboyIndex + 1000);
      assert(!/getDataRange\(\)\.getValues\(\)/.test(snippet), "A listagem em Controle-Motoboy-homologacao.gs não deve usar getDataRange().getValues() para Motoboy.");
    }
    assert(/function readMotoboyDataRange_/.test(homologacaoGs), "Deve existir uma função auxiliar readMotoboyDataRange_ em Controle-Motoboy-homologacao.gs.");
  }

  if (passed) {
    console.log("🎉 Contrato de cache Motoboy validado com sucesso.");
    process.exit(0);
  } else {
    console.error("Falha na validação do contrato de cache Motoboy.");
    process.exit(1);
  }
}

runCheck();
