import { DashboardFilialData, DashboardSummaryResponse, FilialType } from '../types/dashboard.js';
import { filterDashboardDataByMonth, ALL_MONTHS } from './dashboardMonthFilter.js';

export const FILIAIS: FilialType[] = ['Todas', 'Barra Funda', 'Extrema', 'Belo Horizonte'];

export const VALID_MONTH_NAMES = [
  'janeiro', 'fevereiro', 'marco', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export function isValidMonthString(monthStr?: string): boolean {
  if (!monthStr) return false;
  const trimmed = monthStr.trim();
  if (trimmed === ALL_MONTHS) return true;

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const match = normalized.match(/^([a-z]+)\s+(19\d{2}|20\d{2})$/);
  if (!match) return false;

  return VALID_MONTH_NAMES.includes(match[1]);
}

export function matchFilialBranch(filialStr?: string, target?: FilialType): boolean {
  if (!filialStr || !target || target === 'Todas') return true;
  const f = String(filialStr).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (target === 'Barra Funda') return f.includes('barra') || f === 'bf' || f === 'sp' || f.includes('sao paulo');
  if (target === 'Extrema') return f.includes('extrema') || f.includes('cd') || f.includes('mg - extrema');
  if (target === 'Belo Horizonte') return f.includes('belo') || f.includes('horizonte') || f === 'bh' || f.includes('mg - bh');
  return false;
}

export function resolveActiveBranchData(
  summary: DashboardSummaryResponse | null,
  selectedFilial: FilialType,
  selectedMonth: string
): DashboardFilialData {
  const emptyFallback: DashboardFilialData = {
    totalDesligamentos: 0,
    desligamentosMesAtual: 0,
    mensalData: [],
    equipamentosMensal: [],
    equipamentosRanking: [],
    pendencias: [],
    recentReturns: []
  };

  if (!summary) {
    return emptyFallback;
  }

  const applyMonthFilter = (data: DashboardFilialData): DashboardFilialData =>
    filterDashboardDataByMonth(data, selectedMonth);

  const rawFiliais = summary.filiais;
  const branchObj = rawFiliais?.[selectedFilial];
  const isTodas = selectedFilial === 'Todas';

  if (branchObj && typeof branchObj.totalDesligamentos === 'number') {
    return applyMonthFilter({
      porMes: branchObj.porMes,
      totalDesligamentos: Number(branchObj.totalDesligamentos) || 0,
      desligamentosMesAtual: Number(branchObj.desligamentosMesAtual) || 0,
      mensalData: Array.isArray(branchObj.mensalData) ? branchObj.mensalData : [],
      equipamentosMensal: Array.isArray(branchObj.equipamentosMensal) ? branchObj.equipamentosMensal : [],
      equipamentosRanking: Array.isArray(branchObj.equipamentosRanking)
        ? branchObj.equipamentosRanking.filter(e => (Number(e.count) || 0) > 0)
        : [],
      pendencias: Array.isArray(branchObj.pendencias) ? branchObj.pendencias : [],
      recentReturns: Array.isArray(branchObj.recentReturns) ? branchObj.recentReturns : []
    });
  }

  if (isTodas) {
    return applyMonthFilter({
      totalDesligamentos: Number(summary.totalDesligamentos) || 0,
      desligamentosMesAtual: Number(summary.desligamentosMesAtual) || 0,
      mensalData: Array.isArray(summary.mensalData) ? summary.mensalData : [],
      equipamentosMensal: Array.isArray(summary.equipamentosMensal) ? summary.equipamentosMensal : [],
      equipamentosRanking: Array.isArray(summary.equipamentosRanking)
        ? summary.equipamentosRanking.filter(e => (Number(e.count) || 0) > 0)
        : [],
      pendencias: Array.isArray(summary.pendencias) ? summary.pendencias : [],
      recentReturns: Array.isArray(summary.recentReturns) ? summary.recentReturns : []
    });
  }

  const allPendencias = Array.isArray(summary.pendencias) ? summary.pendencias : [];
  const allRecentReturns = Array.isArray(summary.recentReturns) ? summary.recentReturns : [];
  const filteredPendencias = allPendencias.filter(p => matchFilialBranch(p?.filial, selectedFilial));
  const filteredRecentReturns = allRecentReturns.filter(r => matchFilialBranch(r?.filial, selectedFilial));

  if (filteredPendencias.length === 0 && filteredRecentReturns.length === 0) {
    return applyMonthFilter({
      totalDesligamentos: 0,
      desligamentosMesAtual: 0,
      mensalData: (Array.isArray(summary.mensalData) ? summary.mensalData : []).map(m => ({ month: m.month, count: 0 })),
      equipamentosMensal: (Array.isArray(summary.equipamentosMensal) ? summary.equipamentosMensal : []).map(m => ({ month: m.month, count: 0 })),
      equipamentosRanking: [],
      pendencias: [],
      recentReturns: []
    });
  }

  return applyMonthFilter({
    totalDesligamentos: filteredPendencias.length,
    desligamentosMesAtual: 0,
    mensalData: (Array.isArray(summary.mensalData) ? summary.mensalData : []).map(m => ({ month: m.month, count: 0 })),
    equipamentosMensal: (Array.isArray(summary.equipamentosMensal) ? summary.equipamentosMensal : []).map(m => ({ month: m.month, count: 0 })),
    equipamentosRanking: (Array.isArray(summary.equipamentosRanking) ? summary.equipamentosRanking : [])
      .filter(e => (Number(e.count) || 0) > 0),
    pendencias: filteredPendencias,
    recentReturns: filteredRecentReturns
  });
}
