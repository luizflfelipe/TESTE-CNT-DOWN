import assert from 'node:assert/strict';
import express from 'express';
import crypto from 'crypto';
import { FILIAIS, isValidMonthString, resolveActiveBranchData } from '../src/utils/dashboardBranchResolver.js';
import { buildDashboardPdfDocument, sanitizeFileName } from '../src/utils/dashboardPdfExport.js';

// Setup de servidor mock em memória para testar as rotas e códigos HTTP
const app = express();
const TEST_TOKEN = 'test-secret-token-n8n-dafiti-2026';

const requireReportAuth = (req: any, res: any, next: any) => {
  const configuredToken = TEST_TOKEN;
  const authHeader = req.headers.authorization;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const providedToken = match[1].trim();
      const providedBuf = Buffer.from(providedToken, 'utf8');
      const configuredBuf = Buffer.from(configuredToken, 'utf8');
      if (
        providedBuf.length === configuredBuf.length &&
        crypto.timingSafeEqual(providedBuf, configuredBuf)
      ) {
        req.reportUser = 'n8n-automation@dafiti.com.br';
        return next();
      }
      return res.status(403).json({ error: 'Token de autorização inválido.' });
    }
  }
  return res.status(401).json({ error: 'Não autenticado.' });
};

app.get('/api/reports/pdf', requireReportAuth, (req, res) => {
  const { filial: rawFilial, month: rawMonth } = req.query;
  const filial = (typeof rawFilial === 'string' && rawFilial.trim()) ? rawFilial.trim() : 'Todas';
  if (!FILIAIS.includes(filial as any)) {
    return res.status(400).json({ error: `Filial inválida '${filial}'.` });
  }

  const month = (typeof rawMonth === 'string' && rawMonth.trim()) ? rawMonth.trim() : 'Todos os meses';
  if (!isValidMonthString(month)) {
    return res.status(400).json({ error: `Formato de mês inválido '${month}'.` });
  }

  const mockData = resolveActiveBranchData(null, filial as any, month);
  const doc = buildDashboardPdfDocument({
    activeBranchData: mockData,
    selectedFilial: filial as any,
    selectedMonth: month,
    userEmail: (req as any).reportUser,
    generatedAt: new Date()
  });

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBuffer = Buffer.from(arrayBuffer);
  const fileName = sanitizeFileName(filial, month);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  return res.status(200).send(pdfBuffer);
});

const server = app.listen(0, async () => {
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    console.log('--- 1. Teste: Rejeição sem header de autorização (HTTP 401) ---');
    const resNoAuth = await fetch(`${baseUrl}/api/reports/pdf`);
    assert.equal(resNoAuth.status, 401);

    console.log('--- 2. Teste: Rejeição com token inválido (HTTP 403) ---');
    const resBadToken = await fetch(`${baseUrl}/api/reports/pdf`, {
      headers: { Authorization: 'Bearer token-incorreto' }
    });
    assert.equal(resBadToken.status, 403);

    console.log('--- 3. Teste: Rejeição com filial inválida (HTTP 400) ---');
    const resBadFilial = await fetch(`${baseUrl}/api/reports/pdf?filial=FilialInexistente`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    assert.equal(resBadFilial.status, 400);

    console.log('--- 4. Teste: Rejeição com mês inválido (HTTP 400) ---');
    const resBadMonth = await fetch(`${baseUrl}/api/reports/pdf?filial=Todas&month=2026-02`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    assert.equal(resBadMonth.status, 400);

    console.log('--- 5. Teste: Sucesso com autenticação e parâmetros válidos (HTTP 200) ---');
    const resSuccess = await fetch(`${baseUrl}/api/reports/pdf?filial=Todas&month=Fevereiro%202026`, {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` }
    });
    assert.equal(resSuccess.status, 200);
    assert.equal(resSuccess.headers.get('content-type'), 'application/pdf');
    assert.equal(
      resSuccess.headers.get('content-disposition'),
      'attachment; filename="relatorio-desligamentos-todas-fevereiro-2026.pdf"'
    );

    const buffer = Buffer.from(await resSuccess.arrayBuffer());
    assert.equal(buffer.subarray(0, 4).toString('utf-8'), '%PDF');
    assert.equal(buffer.length > 1000, true);

    console.log('✅ Todos os 5 testes de integração HTTP do endpoint /api/reports/pdf passaram!');
  } finally {
    server.close();
  }
});
