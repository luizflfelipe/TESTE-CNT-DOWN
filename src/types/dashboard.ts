export type FilialType = 'Todas' | 'Barra Funda' | 'Extrema' | 'Belo Horizonte';

export interface DashboardFilialData {
  porMes?: Record<string, DashboardFilialData>;
  totalDesligamentos: number;
  desligamentosMesAtual: number;
  mensalData: { month: string; count: number }[];
  equipamentosMensal: { month: string; count: number }[];
  equipamentosRanking: { name: string; count: number }[];
  pendencias: { name: string; date: string; filial: string; priority: 'ALTA' | 'NORMAL' }[];
  recentReturns: { name: string; date: string; equipments: string; timestamp?: number; filial?: string }[];
}

export interface DashboardSummaryResponse {
  available: boolean;
  message?: string;
  formatVersion?: number;
  generationId?: string;
  updatedAt?: string;
  lastUpdate?: string;
  filiais?: Record<FilialType, DashboardFilialData>;
  totalDesligamentos?: number;
  desligamentosMesAtual?: number;
  mensalData?: { month: string; count: number }[];
  equipamentosMensal?: { month: string; count: number }[];
  equipamentosRanking?: { name: string; count: number }[];
  pendencias?: { name: string; date: string; filial: string; priority: 'ALTA' | 'NORMAL' }[];
  recentReturns?: { name: string; date: string; equipments: string; timestamp?: number; filial?: string }[];
  isCached?: boolean;
  cacheWarning?: string;
}
