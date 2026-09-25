import assert from 'node:assert/strict';
import { filterDashboardDataByMonth } from '../src/utils/dashboardMonthFilter';

const source = {
  totalDesligamentos: 9,
  desligamentosMesAtual: 2,
  mensalData: [
    { month: 'Agosto 2026', count: 4 },
    { month: 'Setembro 2026', count: 5 },
  ],
  equipamentosMensal: [
    { month: 'Agosto 2026', count: 3 },
    { month: 'Setembro 2026', count: 7 },
  ],
  equipamentosRanking: [{ name: 'Notebook', count: 10 }],
  pendencias: [
    { name: 'Ana', date: '05/08/2026', filial: 'Barra Funda', priority: 'NORMAL' as const },
    { name: 'Bia', date: '08/09/2026', filial: 'Barra Funda', priority: 'ALTA' as const },
  ],
  recentReturns: [
    { name: 'Ana', date: '06/08/2026', equipments: 'Notebook', filial: 'Barra Funda' },
    { name: 'Bia', date: '09/09/2026', equipments: 'Monitor', filial: 'Barra Funda' },
  ],
};

const allMonths = filterDashboardDataByMonth(source, 'Todos os meses');
assert.equal(allMonths.totalDesligamentos, 9);
assert.equal(allMonths.mensalData.length, 2);
assert.equal(allMonths.equipamentosMensal.length, 2);
assert.equal(allMonths.pendencias.length, 2);
assert.equal(allMonths.recentReturns.length, 2);

const september = filterDashboardDataByMonth(source, 'Setembro 2026');
assert.equal(september.totalDesligamentos, 5);
assert.equal(september.desligamentosMesAtual, 5);
assert.deepEqual(september.mensalData, [{ month: 'Setembro 2026', count: 5 }]);
assert.deepEqual(september.equipamentosMensal, [{ month: 'Setembro 2026', count: 7 }]);
assert.deepEqual(september.pendencias.map((item) => item.name), ['Bia']);
assert.deepEqual(september.recentReturns.map((item) => item.name), ['Bia']);
assert.deepEqual(september.equipamentosRanking, []);

console.log('dashboard month filter verified');
const monthly = {
  ...source,
  totalDesligamentos: 3,
  equipamentosRanking: [
    { name: 'Monitor', count: 12 },
    { name: 'arquivo.xls', count: 8 },
    { name: 'Notebook-componente', count: 6 },
  ],
  recentReturns: [{ name: 'Histórico', date: '01/01/2025', equipments: 'Monitor' }],
};
const filteredMonthly = filterDashboardDataByMonth({ ...source, porMes: { 'Setembro 2026': monthly } }, 'Setembro 2026');
assert.deepEqual(filteredMonthly.equipamentosRanking, [{ name: 'Monitor', count: 12 }]);
assert.equal(filterDashboardDataByMonth({ ...source, porMes: {} }, 'Setembro 2026').recentReturns.length, 0);
