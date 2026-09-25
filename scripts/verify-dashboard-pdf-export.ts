import assert from 'node:assert/strict';
import { isValidMonthString, resolveActiveBranchData, FILIAIS } from '../src/utils/dashboardBranchResolver.js';
import { buildDashboardPdfDocument, sanitizeFileName, calculateTotalEquipments } from '../src/utils/dashboardPdfExport.js';
import { DashboardSummaryResponse } from '../src/types/dashboard.js';

console.log('--- TESTE 1: Validação de Parâmetros e Filiais ---');
assert.equal(FILIAIS.includes('Todas'), true);
assert.equal(FILIAIS.includes('Barra Funda'), true);
assert.equal(FILIAIS.includes('Extrema'), true);
assert.equal(FILIAIS.includes('Belo Horizonte'), true);
assert.equal(FILIAIS.includes('Invalida' as any), false);

console.log('--- TESTE 2: Validação de Strings de Mês ---');
assert.equal(isValidMonthString('Todos os meses'), true);
assert.equal(isValidMonthString('Fevereiro 2026'), true);
assert.equal(isValidMonthString('março 2026'), true);
assert.equal(isValidMonthString('marco 2026'), true);
assert.equal(isValidMonthString('dezembro 2025'), true);
assert.equal(isValidMonthString('mes_invalido 2026'), false);
assert.equal(isValidMonthString('2026-02'), false);
assert.equal(isValidMonthString(''), false);

console.log('--- TESTE 3: Higienização de Nome de Arquivo ---');
assert.equal(
  sanitizeFileName('Todas', 'Fevereiro 2026'),
  'relatorio-desligamentos-todas-fevereiro-2026.pdf'
);
assert.equal(
  sanitizeFileName('Barra Funda', 'Todos os meses'),
  'relatorio-desligamentos-barra-funda-todos-os-meses.pdf'
);
assert.equal(
  sanitizeFileName('Belo Horizonte', 'Março 2026'),
  'relatorio-desligamentos-belo-horizonte-marco-2026.pdf'
);

console.log('--- TESTE 4: Resolução de Dados Filtrados (resolveActiveBranchData) ---');
const mockSummary: DashboardSummaryResponse = {
  available: true,
  totalDesligamentos: 15,
  desligamentosMesAtual: 5,
  mensalData: [
    { month: 'Janeiro 2026', count: 10 },
    { month: 'Fevereiro 2026', count: 5 }
  ],
  equipamentosMensal: [
    { month: 'Janeiro 2026', count: 8 },
    { month: 'Fevereiro 2026', count: 4 }
  ],
  equipamentosRanking: [
    { name: 'Notebook Dell', count: 12 },
    { name: 'Monitor 24', count: 6 }
  ],
  pendencias: [
    { name: 'Colaborador A', date: '10/02/2026', filial: 'Barra Funda', priority: 'ALTA' },
    { name: 'Colaborador B', date: '15/01/2026', filial: 'Extrema', priority: 'NORMAL' }
  ],
  recentReturns: [
    { name: 'Colaborador C', date: '05/02/2026', equipments: '1x Notebook', filial: 'Barra Funda' }
  ],
  filiais: {
    'Todas': {
      totalDesligamentos: 15,
      desligamentosMesAtual: 5,
      mensalData: [
        { month: 'Janeiro 2026', count: 10 },
        { month: 'Fevereiro 2026', count: 5 }
      ],
      equipamentosMensal: [
        { month: 'Janeiro 2026', count: 8 },
        { month: 'Fevereiro 2026', count: 4 }
      ],
      equipamentosRanking: [
        { name: 'Notebook Dell', count: 12 },
        { name: 'Monitor 24', count: 6 }
      ],
      pendencias: [
        { name: 'Colaborador A', date: '10/02/2026', filial: 'Barra Funda', priority: 'ALTA' },
        { name: 'Colaborador B', date: '15/01/2026', filial: 'Extrema', priority: 'NORMAL' }
      ],
      recentReturns: [
        { name: 'Colaborador C', date: '05/02/2026', equipments: '1x Notebook', filial: 'Barra Funda' }
      ]
    },
    'Barra Funda': {
      totalDesligamentos: 10,
      desligamentosMesAtual: 3,
      mensalData: [
        { month: 'Janeiro 2026', count: 7 },
        { month: 'Fevereiro 2026', count: 3 }
      ],
      equipamentosMensal: [
        { month: 'Janeiro 2026', count: 5 },
        { month: 'Fevereiro 2026', count: 2 }
      ],
      equipamentosRanking: [
        { name: 'Notebook Dell', count: 8 }
      ],
      pendencias: [
        { name: 'Colaborador A', date: '10/02/2026', filial: 'Barra Funda', priority: 'ALTA' }
      ],
      recentReturns: [
        { name: 'Colaborador C', date: '05/02/2026', equipments: '1x Notebook', filial: 'Barra Funda' }
      ]
    },
    'Extrema': {
      totalDesligamentos: 5,
      desligamentosMesAtual: 2,
      mensalData: [{ month: 'Janeiro 2026', count: 3 }, { month: 'Fevereiro 2026', count: 2 }],
      equipamentosMensal: [{ month: 'Janeiro 2026', count: 3 }, { month: 'Fevereiro 2026', count: 2 }],
      equipamentosRanking: [],
      pendencias: [{ name: 'Colaborador B', date: '15/01/2026', filial: 'Extrema', priority: 'NORMAL' }],
      recentReturns: []
    },
    'Belo Horizonte': {
      totalDesligamentos: 0,
      desligamentosMesAtual: 0,
      mensalData: [],
      equipamentosMensal: [],
      equipamentosRanking: [],
      pendencias: [],
      recentReturns: []
    }
  }
};

const resolvedAll = resolveActiveBranchData(mockSummary, 'Todas', 'Todos os meses');
assert.equal(resolvedAll.totalDesligamentos, 15);
assert.equal(resolvedAll.pendencias.length, 2);

const resolvedFeb = resolveActiveBranchData(mockSummary, 'Todas', 'Fevereiro 2026');
assert.equal(resolvedFeb.totalDesligamentos, 5);
assert.equal(resolvedFeb.pendencias.length, 1);
assert.equal(resolvedFeb.pendencias[0].name, 'Colaborador A');

console.log('--- TESTE 5: Geração de Documento PDF no Node.js ---');
const doc = buildDashboardPdfDocument({
  activeBranchData: resolvedFeb,
  selectedFilial: 'Todas',
  selectedMonth: 'Fevereiro 2026',
  userEmail: 'n8n-automation@dafiti.com.br',
  generatedAt: new Date()
});

const arrayBuffer = doc.output('arraybuffer');
const pdfBuffer = Buffer.from(arrayBuffer);

assert.equal(pdfBuffer.length > 1000, true, 'O buffer do PDF deve conter bytes suficientes');
const pdfHeader = pdfBuffer.subarray(0, 4).toString('utf-8');
assert.equal(pdfHeader, '%PDF', 'O arquivo deve iniciar com a assinatura de cabeçalho %PDF');

console.log('✅ Todos os testes de unidade e integridade do relatório PDF passaram com sucesso!');
