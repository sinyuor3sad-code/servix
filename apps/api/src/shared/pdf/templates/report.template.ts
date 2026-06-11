// Generic report HTML template — used for revenue, employees, etc.
// Headed by salon name + report title + date range; body is a simple table
// or list of summary lines with an optional totals footer.

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export interface ReportSummaryLine {
  label: string;
  value: string;
}

export interface ReportTableData {
  headers: string[];
  rows: (string | number)[][];
  /** Optional bold footer row (e.g. totals). */
  footer?: (string | number)[];
}

export interface ReportTemplateData {
  salonName: string;
  title: string;
  dateRange: string;
  summary?: ReportSummaryLine[];
  table?: ReportTableData;
  /** Free-form list of lines (used for employee performance etc). */
  lines?: { primary: string; secondary?: string }[];
  primaryColor?: string;
}

function renderTable(table: ReportTableData): string {
  const head = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`,
    )
    .join('');
  const foot = table.footer
    ? `<tfoot><tr>${table.footer.map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr></tfoot>`
    : '';
  return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table>`;
}

function renderLines(lines: { primary: string; secondary?: string }[]): string {
  return lines
    .map(
      (l) =>
        `<div class="line-block">
          <div class="primary">${escapeHtml(l.primary)}</div>
          ${l.secondary ? `<div class="secondary">${escapeHtml(l.secondary)}</div>` : ''}
        </div>`,
    )
    .join('');
}

function renderSummary(summary: ReportSummaryLine[]): string {
  return `<div class="summary-grid">${summary
    .map(
      (s) =>
        `<div class="summary-item">
          <div class="summary-label">${escapeHtml(s.label)}</div>
          <div class="summary-value">${escapeHtml(s.value)}</div>
        </div>`,
    )
    .join('')}</div>`;
}

export function buildReportHtml(data: ReportTemplateData): string {
  const accent = data.primaryColor || '#8B5CF6';
  const exportedOn = new Date().toLocaleDateString('ar-SA');

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(data.title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: 'Cairo', 'Noto Sans Arabic', system-ui, sans-serif;
    color: #1f2937;
    background: #fff;
    direction: rtl;
    text-align: right;
    font-size: 13px;
    line-height: 1.6;
  }
  .page { max-width: 800px; margin: 0 auto; padding: 32px 36px; }
  .header { text-align: center; margin-bottom: 22px; }
  .salon-name { font-size: 22px; font-weight: 800; color: ${accent}; }
  .report-title { font-size: 15px; font-weight: 700; color: #374151; margin-top: 6px; }
  .date-range { font-size: 11px; color: #6b7280; margin-top: 4px; }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin: 18px 0;
  }
  .summary-item {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 12px 16px;
  }
  .summary-label { font-size: 11px; color: #6b7280; font-weight: 600; }
  .summary-value { font-size: 16px; color: #111827; font-weight: 700; margin-top: 4px; }

  table.data { width: 100%; border-collapse: collapse; margin: 16px 0; }
  table.data th {
    background: ${accent};
    color: #fff;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
  }
  table.data td {
    padding: 9px 12px;
    border-bottom: 1px solid #f3f4f6;
    font-size: 12px;
  }
  table.data tfoot td {
    background: #f9fafb;
    font-weight: 700;
    color: ${accent};
    border-top: 2px solid ${accent};
  }

  .line-block {
    padding: 10px 14px;
    border-bottom: 1px solid #f3f4f6;
  }
  .line-block .primary { font-size: 13px; font-weight: 700; color: #111827; }
  .line-block .secondary { font-size: 11px; color: #6b7280; margin-top: 2px; }

  .footer {
    text-align: center;
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
    color: #9ca3af;
    font-size: 10px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="salon-name">${escapeHtml(data.salonName)}</div>
      <div class="report-title">${escapeHtml(data.title)}</div>
      <div class="date-range">${escapeHtml(data.dateRange)}</div>
    </div>
    ${data.summary && data.summary.length ? renderSummary(data.summary) : ''}
    ${data.table ? renderTable(data.table) : ''}
    ${data.lines && data.lines.length ? renderLines(data.lines) : ''}
    <div class="footer">تم التصدير بتاريخ: ${escapeHtml(exportedOn)} — SERVIX</div>
  </div>
</body>
</html>`;
}
