import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = readFileSync('apps-script/Desligados-prod.gs', 'utf8');
for (const header of ['Equipamento(s) e Quantidade', 'Equipamentos e Quantidade', 'Equipamento/Quantidade', 'Equipamento']) {
  const branches = ['Barra Funda', 'Extrema', 'Belo Horizonte'];
  const values = [
    ['Colaborador', 'Desligamento', 'Filial', 'Equip. Devolvido', header],
    ['Pessoa Barra 1', '01/01/2026', 'Barra Funda', 'Devolvido', '1x Notebook'],
    ['Pessoa Barra 2', '01/09/2026', 'Barra Funda', 'Desligamento', '2x Notebook'],
    ['Pessoa Barra 2', '01/09/2026', 'Barra Funda', 'Devolvido', ''],
    ['Pessoa Extrema', '01/09/2026', 'Extrema', 'Devolvido', 'Email Autômato (Desligamentosdodia-Page1-Componente1.xls)'],
    ['Pessoa BH', '01/01/2026', 'Belo Horizonte', 'Devolvido', 'Email Autômato (Desligamentosdodia-Page1-Componente1.xls)'],
    ['Pessoa Extrema', '01/09/2026', 'Extrema', 'Pendente', '8x Notebook'],
    ['Pessoa BH', '01/09/2026', 'Belo Horizonte', 'Pendente', '9x Monitor'],
  ];
  const sheet = { getName: () => 'Setembro2026', getLastRow: () => values.length, getDataRange: () => ({ getValues: () => values }) };
  const auxiliaryValues = [
    ['Colaborador', 'Desligamento', 'Filial', header],
    ['Pessoa Auxiliar', '11/09/2026', 'Barra Funda', '1x Notebook'],
  ];
  const auxiliarySheet = { getName: () => 'Dados Auxiliares', getLastRow: () => auxiliaryValues.length, getDataRange: () => ({ getValues: () => auxiliaryValues }) };
  let persisted;
  const summary = { clearContents() {}, getRange: () => ({ setValues(rows) { persisted = rows; } }) };
  const spreadsheet = { getSheets: () => [sheet, auxiliarySheet], getSheetByName: () => summary };
  const context = vm.createContext({
    Date, console,
    SpreadsheetApp: { openById: () => spreadsheet },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { formatDate: () => '01/09/2026', getUuid: () => 'test-id' },
  });
  vm.runInContext(source, context);
  assert.equal(context.parseEquipments('Email Autômato (Desligamentosdodia-Page1-Componente1.xls)').length, 0);
  const result = context.processarResumoDashboardDiarioProd();
  const monthly = result.filiais['Barra Funda'].porMes['Setembro 2026'];
  for (const branch of ['Extrema', 'Belo Horizonte']) {
    assert.equal(result.filiais[branch].equipamentosRanking.length, 0);
    assert.equal(result.filiais[branch].porMes['Setembro 2026'].equipamentosRanking.length, 0);
  }
  assert.equal(monthly.equipamentosRanking[0].name, 'Notebook');
  assert.equal(monthly.equipamentosRanking[0].count, 3);
  assert.equal(monthly.totalDesligamentos, 2);
  assert.ok(monthly.recentReturns.some(item => item.name === 'Pessoa Barra 1'), 'Historical return belongs to sheet month even outside 31 days');
  assert.equal(result.filiais.Extrema.porMes['Setembro 2026'].recentReturns.length, 1);
  assert.ok(persisted.some(row => row[0] === 'Todas' && JSON.parse(row[1]).porMes['Setembro 2026'].recentReturns.length === 5));
  assert.deepEqual(JSON.parse(JSON.stringify(result.filiais['Barra Funda'].equipamentosMensal)), [
    { month: 'Setembro 2026', count: 3 },
  ], `${header}: monthly order and counts`);
  assert.deepEqual(JSON.parse(JSON.stringify(result.filiais.Extrema.equipamentosMensal)), [
    { month: 'Setembro 2026', count: 0 },
  ], `${header}: Extrema zero series`);
  assert.deepEqual(JSON.parse(JSON.stringify(result.filiais['Belo Horizonte'].equipamentosMensal)), [
    { month: 'Setembro 2026', count: 0 },
  ], `${header}: Belo Horizonte zero series`);
  assert.deepEqual(JSON.parse(JSON.stringify(result.filiais.Todas.equipamentosMensal)), [
    { month: 'Setembro 2026', count: 3 },
  ]);
  assert.equal(result.filiais.Todas.desligamentosMesAtual, 4, `${header}: current month unique people`);
  assert.equal(result.filiais['Barra Funda'].desligamentosMesAtual, 2, `${header}: branch unique people`);
  assert.ok(persisted.some(row => row[0] === 'Todas' && JSON.parse(row[1]).equipamentosMensal[0].count === 3));
}
console.log('Resumo mensal: cabeçalhos compatíveis, quantidades por filial e persistência verificados.');
