import { DashboardFilialData } from '../types/dashboard';

export const ALL_MONTHS = 'Todos os meses';

function normalizeMonth(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function dateToMonth(value?: string): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (!match) return null;

  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12) return null;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${monthNames[month - 1]} ${year}`;
}

function filterEquipmentRanking(items: DashboardFilialData['equipamentosRanking']) {
  return items.filter((item) => {
    const name = String(item?.name || '').toLowerCase().trim();
    return Boolean(name) && !name.includes('.xls') && !name.includes('-componente');
  });
}

export function filterDashboardDataByMonth(
  data: DashboardFilialData,
  selectedMonth: string
): DashboardFilialData {
  if (!selectedMonth || selectedMonth === ALL_MONTHS) {
    return data;
  }

  const target = normalizeMonth(selectedMonth);
  if (data.porMes) {
    const month = Object.keys(data.porMes).find((key) => normalizeMonth(key) === target);
    return month ? {
      ...data.porMes[month],
      equipamentosRanking: filterEquipmentRanking(data.porMes[month].equipamentosRanking),
    } : {
      totalDesligamentos: 0, desligamentosMesAtual: 0,
      mensalData: [], equipamentosMensal: [], equipamentosRanking: [], pendencias: [], recentReturns: []
    };
  }
  const mensalData = data.mensalData.filter((item) => normalizeMonth(item.month) === target);
  const equipamentosMensal = data.equipamentosMensal.filter((item) => normalizeMonth(item.month) === target);
  const monthCount = mensalData.reduce((total, item) => total + (Number(item.count) || 0), 0);

  return {
    ...data,
    totalDesligamentos: monthCount,
    desligamentosMesAtual: monthCount,
    mensalData,
    equipamentosMensal,
    // O resumo atual não possui ranking de equipamentos por mês.
    equipamentosRanking: [],
    pendencias: data.pendencias.filter((item) => normalizeMonth(dateToMonth(item.date) || '') === target),
    recentReturns: data.recentReturns.filter((item) => normalizeMonth(dateToMonth(item.date) || '') === target),
  };
}
