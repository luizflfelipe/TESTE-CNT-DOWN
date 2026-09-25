import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DashboardFilialData, FilialType } from '../types/dashboard.js';

export interface DashboardPdfExportOptions {
  activeBranchData: DashboardFilialData;
  selectedFilial: FilialType;
  selectedMonth: string;
  userEmail: string;
  generatedAt?: Date;
}

export function sanitizeFileName(filial: string, periodo: string): string {
  const clean = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const filialSlug = clean(filial) || 'geral';
  const periodoSlug = clean(periodo) || 'todos-os-meses';

  return `relatorio-desligamentos-${filialSlug}-${periodoSlug}.pdf`;
}

export function formatDateTime(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = pad(date.getDate());
  const m = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${d}/${m}/${y} às ${h}:${min}:${s}`;
}

export function calculateTotalEquipments(activeBranchData: DashboardFilialData): number {
  const fromMonthly = (activeBranchData.equipamentosMensal || []).reduce(
    (acc, curr) => acc + (Number(curr.count) || 0),
    0
  );
  if (fromMonthly > 0) return fromMonthly;

  const fromRanking = (activeBranchData.equipamentosRanking || []).reduce(
    (acc, curr) => acc + (Number(curr.count) || 0),
    0
  );
  return fromRanking;
}

/**
 * Cria e estiliza o documento jsPDF com todo o conteúdo e layout oficial
 * Pode ser executado tanto no Node.js quanto no browser.
 */
export function buildDashboardPdfDocument({
  activeBranchData,
  selectedFilial,
  selectedMonth,
  userEmail,
  generatedAt = new Date()
}: DashboardPdfExportOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 14;
  const marginRight = 14;
  const contentWidth = pageWidth - marginLeft - marginRight;

  const primaryDark = [15, 23, 42]; // #0f172a
  const cyanAccent = [6, 182, 212]; // #06b6d4
  const orangeAccent = [249, 115, 22]; // #f97316
  const slateBorder = [226, 232, 240]; // #e2e8f0
  const slateText = [51, 65, 85]; // #334155
  const slateMuted = [100, 116, 139]; // #64748b

  // 1. Cabeçalho escuro com identidade visual
  const headerHeight = 36;
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Faixa decorativa ciano no topo do header
  doc.setFillColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // Título do relatório
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório de Controle de Desligamentos e Ativos de T.I.', marginLeft, 13);

  // Subtítulo institucional
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('DAFITI GROUP • DEPARTAMENTO DE TECNOLOGIA DA INFORMAÇÃO', marginLeft, 18.5);

  // Linha divisória fina dentro do header
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.3);
  doc.line(marginLeft, 21.5, pageWidth - marginRight, 21.5);

  // Metadados do relatório (Filial, Período, Data/Hora, Usuário)
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);

  const metaY = 27;
  const col1X = marginLeft;
  const col2X = marginLeft + 48;
  const col3X = marginLeft + 98;
  const col4X = marginLeft + 140;

  // Filial
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
  doc.text('FILIAL:', col1X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(selectedFilial, col1X + 13, metaY);

  // Período
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
  doc.text('PERÍODO:', col2X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(selectedMonth, col2X + 16, metaY);

  // Data / Hora
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('GERADO EM:', col3X, metaY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(formatDateTime(generatedAt), col3X + 21, metaY);

  // Usuário autenticado
  const metaY2 = 32;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(148, 163, 184);
  doc.text('EMISSOR:', col1X, metaY2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text(userEmail || 'Usuário Autenticado', col1X + 16, metaY2);

  let currentY = headerHeight + 8;

  // 2. Quadro de Indicadores Consolidados (KPIs)
  const isMonthSelected = selectedMonth !== 'Todos os meses';
  const totalEquipamentos = calculateTotalEquipments(activeBranchData);
  const cardGap = 4;
  const cardWidth = (contentWidth - (cardGap * 2)) / 3;
  const cardHeight = 20;

  const kpis = [
    {
      title: 'TOTAL DE DESLIGAMENTOS',
      value: String(activeBranchData.totalDesligamentos ?? 0),
      subtitle: `Filial: ${selectedFilial}`,
      accentColor: cyanAccent
    },
    {
      title: isMonthSelected ? `DESLIGAMENTOS (${selectedMonth.toUpperCase()})` : 'DESLIGAMENTOS MÊS ATUAL',
      value: String(activeBranchData.desligamentosMesAtual ?? 0),
      subtitle: isMonthSelected ? 'Filtro mensal selecionado' : 'Mês corrente',
      accentColor: orangeAccent
    },
    {
      title: 'EQUIPAMENTOS DEVOLVIDOS',
      value: String(totalEquipamentos),
      subtitle: isMonthSelected ? `No período ${selectedMonth}` : 'Total consolidado',
      accentColor: [16, 185, 129] // emerald
    }
  ];

  kpis.forEach((kpi, index) => {
    const cardX = marginLeft + index * (cardWidth + cardGap);
    
    // Fundo do card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'F');

    // Borda do card
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'S');

    // Borda superior colorida
    doc.setFillColor(kpi.accentColor[0], kpi.accentColor[1], kpi.accentColor[2]);
    doc.rect(cardX, currentY, cardWidth, 1.5, 'F');

    // Título do KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(kpi.title, cardX + 3, currentY + 5.5);

    // Valor do KPI
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(kpi.accentColor[0], kpi.accentColor[1], kpi.accentColor[2]);
    doc.text(kpi.value, cardX + 3, currentY + 13);

    // Subtítulo do KPI
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(kpi.subtitle, cardX + 3, currentY + 17.5);
  });

  currentY += cardHeight + 8;

  // Função auxiliar para cabeçalhos de seção
  const drawSectionTitle = (title: string, countText?: string) => {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = 16;
    }

    doc.setFillColor(cyanAccent[0], cyanAccent[1], cyanAccent[2]);
    doc.rect(marginLeft, currentY, 2.5, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryDark[0], primaryDark[1], primaryDark[2]);
    doc.text(title, marginLeft + 5, currentY + 4);

    if (countText) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
      const titleWidth = doc.getTextWidth(title);
      doc.text(`(${countText})`, marginLeft + 7 + titleWidth, currentY + 4);
    }

    currentY += 7;
  };

  // 3. Ranking de Equipamentos Devolvidos
  const rankingList = activeBranchData.equipamentosRanking || [];
  drawSectionTitle('Ranking de Equipamentos Devolvidos', `${rankingList.length} itens catalogados`);

  const rankingRows = rankingList.length > 0
    ? rankingList.map((item, idx) => [
        `#${idx + 1}`,
        item.name || 'Não identificado',
        String(item.count || 0)
      ])
    : [['-', 'Nenhum registro encontrado', '0']];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    head: [['Posição', 'Equipamento', 'Quantidade Devolvida']],
    body: rankingRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 7.5,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 38, halign: 'right', fontStyle: 'bold' }
    },
    didDrawPage: () => {
      // Deixamos a numeração para o loop final
    }
  });

  currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;

  // 4. Se o filtro for "Todos os meses", adicionar tabela consolidada mensal
  if (!isMonthSelected) {
    const mensal = activeBranchData.mensalData || [];
    const equipMensal = activeBranchData.equipamentosMensal || [];
    const monthMap = new Map<string, { desligamentos: number; equipamentos: number }>();

    mensal.forEach((m) => {
      if (m.month) {
        const entry = monthMap.get(m.month) || { desligamentos: 0, equipamentos: 0 };
        entry.desligamentos += Number(m.count) || 0;
        monthMap.set(m.month, entry);
      }
    });

    equipMensal.forEach((e) => {
      if (e.month) {
        const entry = monthMap.get(e.month) || { desligamentos: 0, equipamentos: 0 };
        entry.equipamentos += Number(e.count) || 0;
        monthMap.set(e.month, entry);
      }
    });

    const monthlyRows = Array.from(monthMap.entries()).map(([month, data]) => [
      month,
      String(data.desligamentos),
      String(data.equipamentos)
    ]);

    drawSectionTitle('Consolidado Mensal de Atividades', `${monthlyRows.length} meses`);

    autoTable(doc, {
      startY: currentY,
      margin: { left: marginLeft, right: marginRight },
      head: [['Mês / Ano', 'Desligamentos Registrados', 'Equipamentos Devolvidos']],
      body: monthlyRows.length > 0 ? monthlyRows : [['-', 'Nenhum registro encontrado', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left'
      },
      bodyStyles: {
        textColor: [51, 65, 85],
        fontSize: 7.5,
        cellPadding: 2
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 'auto', fontStyle: 'bold' },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 50, halign: 'right' }
      }
    });

    currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;
  }

  // 5. Tabela de Pendências de Devolução
  const pendencias = activeBranchData.pendencias || [];
  drawSectionTitle('Pendências de Devolução', `${pendencias.length} registros`);

  const pendenciasRows = pendencias.length > 0
    ? pendencias.map((p) => [
        p.name || 'Não informado',
        p.date || 'Não informada',
        p.filial || selectedFilial,
        p.priority || 'NORMAL'
      ])
    : [['Nenhum registro encontrado', '-', '-', '-']];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    head: [['Colaborador Desligado', 'Data Desligamento', 'Filial', 'Prioridade']],
    body: pendenciasRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 7.5,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 35, halign: 'center' },
      3: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const text = String(data.cell.raw);
        if (text === 'ALTA') {
          data.cell.styles.textColor = [239, 68, 68]; // red-500
        } else if (text === 'NORMAL') {
          data.cell.styles.textColor = [59, 130, 246]; // blue-500
        }
      }
    }
  });

  currentY = ((doc as any).lastAutoTable?.finalY ?? currentY) + 8;

  // 6. Tabela de Devoluções Recentes
  const recentReturns = activeBranchData.recentReturns || [];
  drawSectionTitle('Devoluções Recentes', `${recentReturns.length} devoluções`);

  const returnsRows = recentReturns.length > 0
    ? recentReturns.map((r) => [
        r.name || 'Não informado',
        r.date || 'Não informada',
        r.equipments || 'Nenhum equipamento listado'
      ])
    : [['Nenhum registro encontrado', '-', '-']];

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginLeft, right: marginRight },
    head: [['Colaborador', 'Data Recebimento', 'Equipamentos Devolvidos']],
    body: returnsRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      textColor: [51, 65, 85],
      fontSize: 7.5,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 'auto' }
    }
  });

  // 7. Rodapé em todas as páginas com numeração "Página X de Y"
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    // Linha divisória de rodapé
    doc.setDrawColor(slateBorder[0], slateBorder[1], slateBorder[2]);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, pageHeight - 11, pageWidth - marginRight, pageHeight - 11);

    // Texto institucional
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      'Dafiti Group • Sistema de Controle de Desligamentos e Ativos de T.I. • Documento Confidencial',
      marginLeft,
      pageHeight - 7
    );

    // Numeração de página
    const pageStr = `Página ${page} de ${totalPages}`;
    const pageStrWidth = doc.getTextWidth(pageStr);
    doc.text(pageStr, pageWidth - marginRight - pageStrWidth, pageHeight - 7);
  }

  return doc;
}

/**
 * Função utilizada pelo frontend para gerar e disparar o download no navegador.
 * Mantém 100% de compatibilidade e mesma assinatura da implementação existente.
 */
export async function generateDashboardPdf(options: DashboardPdfExportOptions): Promise<string> {
  const doc = buildDashboardPdfDocument(options);
  const fileName = sanitizeFileName(options.selectedFilial, options.selectedMonth);
  doc.save(fileName);
  return fileName;
}
