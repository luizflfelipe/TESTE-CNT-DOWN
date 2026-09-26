import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { 
  RefreshCw, 
  PlusCircle, 
  TrendingUp, 
  Package, 
  Calendar,
  Building2,
  Clock,
  ArrowLeft,
  ChevronDown,
  Check,
  FileDown,
  Loader2,
  AlertCircle,
  LogIn
} from 'lucide-react';
import { motion } from 'motion/react';
import { DashboardSummaryResponse, DashboardFilialData, FilialType } from '../types/dashboard';
import { ALL_MONTHS } from '../utils/dashboardMonthFilter';
import { normalizeDashboardSummary } from '../utils/dashboardData';
import { generateDashboardPdf } from '../utils/dashboardPdfExport';
import { FILIAIS, resolveActiveBranchData } from '../utils/dashboardBranchResolver';

interface DashboardProps {
  onBack: () => void;
  userEmail?: string;
  onUnauthorized?: () => void;
}

export default function Dashboard({ onBack, userEmail, onUnauthorized }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [selectedFilial, setSelectedFilial] = useState<FilialType>('Todas');
  const [selectedMonth, setSelectedMonth] = useState<string>(ALL_MONTHS);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfSuccess, setPdfSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchData = async (isManual = false) => {
    // Cancela requisição anterior em voo
    if (abortControllerRef.current) {
      abortControllerRef.current.abort('CANCELLED_PREVIOUS');
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Timeout: 70 segundos na sincronização manual (reconstrução das planilhas) e 50s no carregamento normal
    const timeoutDuration = isManual ? 70000 : 50000;
    const timeoutId = setTimeout(() => {
      controller.abort('TIMEOUT_EXCEEDED');
    }, timeoutDuration);

    // Durante uma atualização manual, mantenha os dados atuais visíveis!
    if (isManual) {
      setIsRefreshing(true);
      setRefreshSuccess(false);
    } else if (!summary) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (isManual) params.set('refresh', '1');
      const query = params.toString();
      const response = await fetch(`/api/dashboard-data${query ? `?${query}` : ''}`, {
        credentials: 'same-origin',
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          if (onUnauthorized) {
            onUnauthorized();
            return;
          }
        }
        const errorJson = await response.json().catch(() => null);
        throw new Error(errorJson?.message || errorJson?.error || 'O Google Drive está temporariamente instável. Tente novamente em instantes.');
      }

      let result: DashboardSummaryResponse;
      try {
        result = await response.json();
      } catch {
        throw new Error('O Google Drive retornou uma resposta inválida. Tente novamente em instantes.');
      }

      // LOG DE DEPURAÇÃO: Imprime os dados brutos recebidos da API no console do navegador
      console.group('🔍 [Dashboard API Debug] Dados brutos recebidos de /api/dashboard-data');
      console.log('📦 Objeto Completo (Raw Response):', result);
      console.log('🏢 Filiais recebidas da API:', result.filiais);
      if (result.filiais && typeof result.filiais === 'object') {
        Object.entries(result.filiais).forEach(([filial, data]) => {
          console.log(`📊 Filial [${filial}]:`, {
            totalDesligamentos: data?.totalDesligamentos,
            desligamentosMesAtual: data?.desligamentosMesAtual,
            mensalDataCount: data?.mensalData?.length,
            equipamentosRankingCount: data?.equipamentosRanking?.length,
            pendenciasCount: data?.pendencias?.length,
            recentReturnsCount: data?.recentReturns?.length,
            porMesKeys: data?.porMes ? Object.keys(data.porMes) : undefined,
            rawObj: data
          });
        });
      } else {
        console.warn('⚠️ A propriedade "filiais" não veio estruturada como objeto no retorno da API.');
      }
      console.log('📈 Totais Globais da API:', {
        totalDesligamentos: result.totalDesligamentos,
        desligamentosMesAtual: result.desligamentosMesAtual,
        pendenciasTotal: result.pendencias?.length,
        recentReturnsTotal: result.recentReturns?.length,
        lastUpdate: result.lastUpdate || result.updatedAt,
        isCached: result.isCached
      });
      console.groupEnd();

      if (result.available === false) {
        if (!summary) {
          setSummary(result);
          return;
        }
        setBannerNotice(result.message || 'O Dashboard está temporariamente indisponível para atualização no Google Drive.');
        return;
      }
      
      // Sanitização segura de nomes de equipamentos em todas as filiais
      if (result.filiais && typeof result.filiais === 'object') {
        (Object.keys(result.filiais) as FilialType[]).forEach((f) => {
          const filialObj = result.filiais?.[f];
          if (filialObj && Array.isArray(filialObj.equipamentosRanking)) {
            filialObj.equipamentosRanking = filialObj.equipamentosRanking.filter((equip) => {
              const name = String(equip?.name || '').toLowerCase().trim();
              return Boolean(name) && !name.includes('.xls') && !name.includes('-componente');
            });
          }
        });
      }

      if (Array.isArray(result.equipamentosRanking)) {
        result.equipamentosRanking = result.equipamentosRanking.filter((equip) => {
          const name = String(equip?.name || '').toLowerCase().trim();
          return Boolean(name) && !name.includes('.xls') && !name.includes('-componente');
        });
      }

      setSummary(normalizeDashboardSummary(result));
      setError(null);
      if (result.cacheWarning) {
        setBannerNotice(result.cacheWarning);
      } else {
        setBannerNotice(null);
      }

      if (isManual) {
        setRefreshSuccess(true);
        setTimeout(() => {
          setRefreshSuccess(false);
        }, 4000);
      }
    } catch (err: any) {
      // Ignora aborts causados por desmontagem de componente ou cancelamento prévio
      if (controller.signal.reason === 'UNMOUNTED' || controller.signal.reason === 'CANCELLED_PREVIOUS') {
        return;
      }

      const isTimeout = controller.signal.reason === 'TIMEOUT_EXCEEDED' ||
                        controller.signal.reason === 'TIMEOUT_35S' || 
                        err?.message?.includes('TIMEOUT') || 
                        err?.message?.toLowerCase().includes('tempo limite');

      // Se for um abort genérico não-timeout, também não deve virar tela de erro
      if (err?.name === 'AbortError' && !isTimeout) {
        return;
      }

      const errorMessage = isTimeout
        ? 'A sincronização com o Google Drive excedeu o tempo limite. Os dados exibidos continuam preservados.'
        : (err?.message || 'Erro ao carregar o dashboard.');

      if (err?.message?.includes('Não autenticado') && onUnauthorized) {
        onUnauthorized();
        return;
      }

      console.error('[Dashboard] Falha ao carregar dados:', errorMessage);

      if (summary) {
        // Se já temos dados no dashboard, mantém os dados visíveis e notifica por banner
        setBannerNotice(`Não foi possível sincronizar agora: ${errorMessage}`);
      } else {
        setError(errorMessage);
        setSummary(null);
      }
    } finally {
      clearTimeout(timeoutId);
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    fetchData();
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort('UNMOUNTED');
      }
    };
  }, []);

  const activeBranchData: DashboardFilialData = useMemo(() => {
    return resolveActiveBranchData(summary, selectedFilial, selectedMonth);
  }, [summary, selectedFilial, selectedMonth]);

  const monthOptions = useMemo(() => {
    if (!summary) return [ALL_MONTHS];

    const months = new Set<string>();
    const addMonths = (data?: DashboardFilialData) => {
      data?.mensalData?.forEach((item) => {
        if (item.month) months.add(item.month);
      });
    };

    addMonths({
      totalDesligamentos: summary.totalDesligamentos || 0,
      desligamentosMesAtual: summary.desligamentosMesAtual || 0,
      mensalData: summary.mensalData || [],
      equipamentosMensal: [],
      equipamentosRanking: [],
      pendencias: [],
      recentReturns: []
    });
    Object.values(summary.filiais || {}).forEach(addMonths);

    return [ALL_MONTHS, ...Array.from(months)];
  }, [summary]);

  const monthTitle = selectedMonth === ALL_MONTHS ? 'Mês atual' : selectedMonth;
  const isMonthSelected = selectedMonth !== ALL_MONTHS;
  const selectedMonthEquipmentTotal = activeBranchData.equipamentosMensal.reduce(
    (total, item) => total + (Number(item.count) || 0),
    0
  );

  const handleExportPdf = async () => {
    if (isExportingPdf || !summary) return;
    setIsExportingPdf(true);
    setPdfError(null);
    setPdfSuccess(null);
    try {
      const fileName = await generateDashboardPdf({
        activeBranchData,
        selectedFilial,
        selectedMonth,
        userEmail: userEmail || 'ti.dafiti@dafiti.com.br'
      });
      setPdfSuccess(`Relatório baixado com sucesso: ${fileName}`);
      setTimeout(() => setPdfSuccess(null), 5000);
    } catch (err: any) {
      console.error('Erro ao gerar relatório em PDF:', err);
      setPdfError(err?.message || 'Falha ao gerar o documento PDF. Tente novamente.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (error && !summary) {
    const isTimeout = error.toLowerCase().includes('timeout') || error.toLowerCase().includes('tempo limite') || error.toLowerCase().includes('20 segundos');
    const isUnauthenticated = error.toLowerCase().includes('não autenticado') || error.toLowerCase().includes('autentic');

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans text-center">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto mb-6 text-destructive">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-foreground text-xl font-bold mb-3">
            {isUnauthenticated ? 'Sessão Não Autenticada' : isTimeout ? 'Tempo Limite Atingido' : 'Erro ao Carregar o Painel'}
          </h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isUnauthenticated ? (
              <button
                type="button"
                onClick={() => {
                  if (onUnauthorized) onUnauthorized();
                  else onBack();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer shadow-md shadow-primary/20"
              >
                <LogIn className="w-4 h-4" />
                Fazer Login
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fetchData(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center gap-2 transition-colors text-sm cursor-pointer shadow-md shadow-primary/20"
              >
                <RefreshCw className="w-4 h-4" />
                Tentar novamente
              </button>
            )}
            <button 
              type="button"
              onClick={onBack} 
              className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center"
        >
          <div className="relative w-24 h-24 mb-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-4 border-primary/20 border-t-primary rounded-full"
            />
            <motion.div 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-8 bg-primary/20 rounded-full flex items-center justify-center"
            >
              <div className="w-2 h-2 bg-primary rounded-full" />
            </motion.div>
          </div>
          
          <motion.h2 
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-foreground text-xl font-black tracking-tighter uppercase mb-2"
          >
            Carregando <span className="text-primary">Resumo Diário</span>
          </motion.h2>
          <p className="text-muted-foreground text-sm font-medium">Lendo resumo consolidado do Dashboard...</p>
        </motion.div>
      </div>
    );
  }

  if (summary.available === false) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 font-sans text-center">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-6 text-primary">
            <Clock className="w-8 h-8" />
          </div>
          <h2 className="text-foreground text-xl font-bold mb-3">Resumo Diário Pendente</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            {summary.message || "O resumo consolidado do Dashboard é gerado automaticamente todos os dias entre 06h e 07h (fuso de São Paulo)."}
          </p>
          <div className="flex flex-col gap-3">
            <button 
              type="button"
              onClick={() => fetchData(true)} 
              className="w-full py-2.5 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold flex items-center justify-center gap-2 transition-colors text-sm shadow-md shadow-primary/20"
            >
              <RefreshCw className="w-4 h-4" />
              Verificar Novamente
            </button>
            <button 
              type="button"
              onClick={onBack} 
              className="w-full py-2.5 px-4 rounded-lg border border-border text-foreground hover:bg-muted transition-colors text-sm font-semibold"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  const lastUpdateLabel = summary.updatedAt || summary.lastUpdate || 'Processamento Diário';

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center border border-border overflow-hidden shadow-lg">
            <img 
              src="https://play-lh.googleusercontent.com/BpgosTzb9wzfgCUTYhN6LvYIAB_A-aWozJCZ6vg0nN6-8ul97z2THmJrrB8aQSO73M4" 
              alt="Dafiti Icon" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground uppercase flex items-center gap-3">
              <span className="text-dft-teal">DASHBOARD DE</span> DESLIGAMENTOS
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs mt-1">
              <Clock className="w-3.5 h-3.5 text-dft-teal flex-shrink-0" />
              <span>Último processamento: <strong className="text-foreground font-semibold">{lastUpdateLabel}</strong></span>
              {summary.generationId && (
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">({summary.generationId})</span>
              )}
              {isRefreshing && (
                <span className="text-dft-teal font-medium animate-pulse flex items-center gap-1.5 ml-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-dft-teal animate-ping" />
                  Sincronizando com as planilhas...
                </span>
              )}
              {refreshSuccess && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1 ml-2 animate-fade-in">
                  ✓ Dashboard atualizado!
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 items-center">
          <button 
            type="button"
            disabled={isRefreshing || isLoading}
            onClick={() => fetchData(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Sincronizando...' : 'Atualizar'}
          </button>
          <button 
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-dft-teal hover:bg-dft-teal-hover text-dft-black flex items-center gap-2 transition-colors shadow-md shadow-dft-teal/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Novo Registro
          </button>
        </div>
      </div>

      {(bannerNotice || summary.cacheWarning) && (
        <div className="mb-6 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
            <span>{bannerNotice || summary.cacheWarning}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() => fetchData(true)}
              className="text-amber-200 hover:text-white underline font-semibold flex-shrink-0 disabled:opacity-50"
            >
              Tentar sincronizar agora
            </button>
            {bannerNotice && (
              <button
                type="button"
                onClick={() => setBannerNotice(null)}
                className="text-muted-foreground hover:text-foreground font-medium ml-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* Seletor de Filial (Troca Instantânea 100% Client-Side) */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8 pb-2 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Building2 className="w-4 h-4 text-muted-foreground mr-1 flex-shrink-0" />
          <span className="text-xs font-semibold text-muted-foreground uppercase mr-2 flex-shrink-0">Filial:</span>
          <div className="flex gap-1.5 flex-nowrap">
            {FILIAIS.map((filial) => {
              const isSelected = selectedFilial === filial;
              return (
                <button
                  key={filial}
                  id={`filial-tab-${filial.toLowerCase().replace(/\s+/g, '-')}`}
                  type="button"
                  onClick={() => setSelectedFilial(filial)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
                  }`}
                >
                  {filial}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controles da Direita: Seletor de Mês + Botão Exportar PDF */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor Customizado de Mês (Sem bug de fechar ao clicar) */}
          <div className="relative inline-block" ref={monthDropdownRef}>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground uppercase flex-shrink-0">
                Mês:
              </span>
              <button
                id="dashboard-month-filter"
                type="button"
                onClick={() => setIsMonthDropdownOpen((prev) => !prev)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-card text-foreground border border-border hover:border-primary/50 flex items-center gap-2.5 transition-all shadow-sm focus:outline-none focus:border-primary"
              >
                <span>{selectedMonth}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180 text-primary' : ''}`} />
              </button>
            </div>

            {isMonthDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 max-h-60 overflow-y-auto rounded-xl bg-card border border-border shadow-2xl z-50 p-1.5 divide-y divide-border">
                {monthOptions.map((month) => {
                  const isSelected = selectedMonth === month;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => {
                        setSelectedMonth(month);
                        setIsMonthDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary font-bold border border-primary/30'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{month}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botão Exportar Relatório em PDF */}
          <button
            id="export-pdf-button"
            type="button"
            disabled={isExportingPdf || isLoading || !summary}
            onClick={handleExportPdf}
            title="Exportar relatório consolidado em PDF respeitando os filtros de filial e mês atuais"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all border shadow-sm ${
              isExportingPdf
                ? 'bg-muted text-muted-foreground border-border cursor-wait'
                : isLoading || !summary
                  ? 'bg-muted/30 text-muted-foreground/50 border-border cursor-not-allowed'
                  : 'bg-card text-foreground hover:bg-muted border-border hover:border-primary active:scale-[0.98]'
            }`}
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary flex-shrink-0" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span>Exportar PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alertas de Exportação em PDF (Erro / Sucesso) */}
      {pdfError && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-red-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{pdfError}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfError(null)}
            className="text-red-400 hover:text-red-200 font-bold px-2 py-0.5 rounded"
          >
            Fechar
          </button>
        </div>
      )}

      {pdfSuccess && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3 text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{pdfSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 font-bold px-2 py-0.5 rounded"
          >
            OK
          </button>
        </div>
      )}

      {isMonthSelected && (
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/10 px-5 py-4 flex items-center gap-3">
          <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-primary">Período selecionado</div>
            <div className="text-xl font-black text-foreground">{selectedMonth}</div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className={`rounded-xl p-5 bg-card border border-border shadow-lg ${isMonthSelected ? 'md:col-span-2' : ''}`}>
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Total de Desligamentos ({selectedFilial})
          </div>
          <div className="text-4xl font-black text-primary">{activeBranchData.totalDesligamentos}</div>
          <p className="text-[10px] text-muted-foreground mt-1">Histórico consolidado</p>
        </div>

        {!isMonthSelected && <div className="rounded-xl p-5 bg-card border border-border shadow-lg">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            {selectedMonth === ALL_MONTHS ? 'Desligamentos Este Mês' : `Desligamentos em ${selectedMonth}`} ({selectedFilial})
          </div>
          <div className="text-4xl font-black text-foreground">{activeBranchData.desligamentosMesAtual}</div>
          <p className="text-[10px] text-muted-foreground mt-1">{monthTitle}</p>
        </div>}
      </div>

      {/* Line Chart */}
      {!isMonthSelected && <div className="rounded-xl p-5 bg-card border border-border mb-8">
        <div className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          Desligamentos por Mês — {selectedFilial}
        </div>
        <div className="h-[300px] min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={activeBranchData?.mensalData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="#888888" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#16191b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}
                itemStyle={{ color: '#ffffff' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                stroke="#3DBDB0" 
                strokeWidth={3} 
                dot={{ fill: '#3DBDB0', r: 4 }}
                activeDot={{ r: 6, fill: '#68CCD1', strokeWidth: 0 }}
                name="Desligamentos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>}

      {/* Bottom Charts */}
      <div className={`grid grid-cols-1 ${isMonthSelected ? '' : 'lg:grid-cols-2'} gap-8 mb-8`}>
        {/* Bar Chart 1 */}
        <div className="rounded-xl p-5 bg-card border border-border">
          <div className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Package className="w-4 h-4 text-emerald-400" />
            {isMonthSelected ? `Equipamentos Devolvidos — ${selectedMonth}` : `Equipamentos Devolvidos por Mês — ${selectedFilial}`}
          </div>
          {isMonthSelected ? (
            <div className="h-[220px] min-h-[220px] flex flex-col items-center justify-center rounded-lg bg-emerald-500/5 border border-emerald-500/10">
              <div className="text-7xl font-black tracking-tight text-emerald-400">{selectedMonthEquipmentTotal}</div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">equipamentos devolvidos</div>
            </div>
          ) : (
            <div className="h-[300px] min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeBranchData?.equipamentosMensal || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" vertical={false} />
                  <XAxis dataKey="month" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#16191b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }} />
                  <Bar dataKey="count" fill="#3DBDB0" radius={[4, 4, 0, 0]} name="Equipamentos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bar Chart 2 */}
        <div className="rounded-xl p-5 bg-card border border-border">
          <div className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-400" />
            {isMonthSelected ? `Equipamentos Mais Devolvidos — ${selectedMonth}` : `Equipamentos Mais Devolvidos — ${selectedFilial}`}
          </div>
          <div className="h-[300px] min-h-[300px]">
            {activeBranchData?.equipamentosRanking && activeBranchData.equipamentosRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeBranchData.equipamentosRanking} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" horizontal={false} />
                  <XAxis type="number" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#16191b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="count" fill="#5D49F0" radius={[0, 4, 4, 0]} name="Quantidade" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-muted-foreground text-xs italic">
                {selectedMonth === ALL_MONTHS || summary.filiais?.[selectedFilial]?.porMes
                  ? `Nenhum equipamento devolvido registrado para a filial ${selectedFilial}.`
                  : 'O resumo atual não possui ranking de equipamentos por mês.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pendencias Section */}
      <div className="rounded-xl p-5 bg-card border border-border shadow-lg mb-8">
        <div className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-amber-500" />
          Pendências de Devolução — {selectedFilial}
        </div>
        <div>
          {activeBranchData.pendencias && activeBranchData.pendencias.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">COLABORADOR</th>
                    <th className="pb-2 font-medium">DATA DESLIGAMENTO</th>
                    <th className="pb-2 font-medium">FILIAL</th>
                    <th className="pb-2 font-medium text-right">PRIORIDADE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeBranchData.pendencias.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 text-foreground font-medium">{p.name}</td>
                      <td className="py-3 text-muted-foreground">{p.date}</td>
                      <td className="py-3 text-muted-foreground">{p.filial}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.priority === 'ALTA' 
                            ? 'bg-destructive/10 text-destructive border border-destructive/20' 
                            : 'bg-primary/10 text-primary border border-primary/20'
                        }`}>
                          {p.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs italic">
              Nenhuma pendência encontrada para a filial {selectedFilial}. Tudo em dia!
            </div>
          )}
        </div>
      </div>

      {/* Ultimos Recebidos Section */}
      <div className="rounded-xl p-5 bg-card border border-border shadow-lg relative overflow-hidden mb-8">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
        <div className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Package className="w-4 h-4 text-primary" />
          {isMonthSelected
            ? `Equipamentos Recebidos — ${selectedMonth} — ${selectedFilial}`
            : `Últimos Equipamentos Recebidos — ${selectedFilial} (últimos 30/31 dias)`}
        </div>
        <div>
          {activeBranchData.recentReturns && activeBranchData.recentReturns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="pb-2 font-medium">COLABORADOR</th>
                    <th className="pb-2 font-medium">DATA RECEBIMENTO</th>
                    <th className="pb-2 font-medium">EQUIPAMENTOS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeBranchData.recentReturns.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 text-foreground font-medium">{p.name}</td>
                      <td className="py-3 text-muted-foreground">{p.date}</td>
                      <td className="py-3 text-muted-foreground">{p.equipments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-xs italic">
              Nenhuma devolução recente encontrada para a filial {selectedFilial}.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 text-center text-[10px] text-muted-foreground tracking-wider">
        Processamento diário automatizado • Horário padrão: 06h00 (America/Sao_Paulo)
      </div>
    </div>
  );
}
