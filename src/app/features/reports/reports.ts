import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportService } from '../../core/services/report.service';
import { ToastService } from '../../core/services/toast.service';
import { extractErrorMessage } from '../../core/utils/http-error';
import {
  CollectionReport,
  GstReport,
  ProfitReport,
  PurchaseReport,
  SalesReport,
  SalesReportGroupBy,
  SalesReportInvoiceRow,
  StockValuationReport,
} from '../../core/models/report.model';

type ReportTab = 'sales' | 'purchases' | 'stock-valuation' | 'profit' | 'gst' | 'collection';

/** One printable/exportable block - a heading plus a plain table of strings.
 * buildExportSections() turns whichever report tab is active into a list of
 * these, and downloadPdf()/downloadExcel() below both render the SAME list -
 * one via jsPDF+autoTable, the other as CSV - so the two downloads can never
 * drift out of sync with each other or with what's on screen. */
interface ExportSection {
  title: string;
  head: string[];
  rows: (string | number)[][];
}

const TAB_LABELS: Record<ReportTab, string> = {
  sales: 'Sales Report',
  purchases: 'Purchases Report',
  'stock-valuation': 'Stock Valuation Report',
  profit: 'Profit Report',
  gst: 'GST Report',
  collection: 'Collection Report',
};

/** Display label for each payment mode column in the Collection Report - same
 * "replace underscore, then titlecase in the template" treatment every other
 * payment-mode label in this app gets, kept here as a lookup so the table
 * header and the export header always agree. */
const MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  gpay: 'Gpay',
  card: 'Card',
  emi: 'EMI',
  credit: 'Credit',
  cash_in_hand: 'Cash in Hand',
  other: 'Other',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, DecimalPipe, DatePipe],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports implements OnInit {
  activeTab: ReportTab = 'sales';
  loading = signal(false);

  fromDate = new Date().toISOString().slice(0, 8) + '01';
  toDate = new Date().toISOString().slice(0, 10);
  salesGroupBy: SalesReportGroupBy = 'day';

  /** Drives "All invoices in this period"'s Payment Mode filter below - this
   * is how a user finds exactly which invoice number(s) are EMI/Cash/etc.
   * ('all' - the default - shows every invoice, same as before this
   * filter existed). Purely client-side over the already-loaded report;
   * doesn't refetch, so switching it never shows a loading spinner. */
  invoicePaymentModeFilter = 'all';

  salesReport = signal<SalesReport | null>(null);
  purchaseReport = signal<PurchaseReport | null>(null);
  stockValuation = signal<StockValuationReport | null>(null);
  profitReport = signal<ProfitReport | null>(null);
  gstReport = signal<GstReport | null>(null);
  collectionReport = signal<CollectionReport | null>(null);

  constructor(
    private reportService: ReportService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  setTab(tab: ReportTab): void {
    this.activeTab = tab;
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const filters = { from_date: this.fromDate, to_date: this.toDate };

    switch (this.activeTab) {
      case 'sales':
        this.reportService.sales({ ...filters, group_by: this.salesGroupBy }).subscribe({
          next: (res) => {
            this.salesReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'purchases':
        this.reportService.purchases(filters).subscribe({
          next: (res) => {
            this.purchaseReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'stock-valuation':
        this.reportService.stockValuation().subscribe({
          next: (res) => {
            this.stockValuation.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'profit':
        this.reportService.profit(filters).subscribe({
          next: (res) => {
            this.profitReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'gst':
        this.reportService.gst(filters).subscribe({
          next: (res) => {
            this.gstReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
      case 'collection':
        this.reportService.collection(filters).subscribe({
          next: (res) => {
            this.collectionReport.set(res.data ?? null);
            this.loading.set(false);
          },
          error: (err) => this.fail(err),
        });
        break;
    }
  }

  /** Template-facing label for a Collection Report mode column - falls back
   * to the same underscore-strip-and-titlecase every other mode label in this
   * app gets, in case a future mode isn't in MODE_LABELS yet. */
  modeColumnLabel(mode: string): string {
    return MODE_LABELS[mode] ?? this.modeLabel(mode);
  }

  filterInvoicesByMode(invoices: SalesReportInvoiceRow[]): SalesReportInvoiceRow[] {
    if (this.invoicePaymentModeFilter === 'all') return invoices;
    return invoices.filter((inv) => inv.payment_mode === this.invoicePaymentModeFilter);
  }

  /** "dd-MM-yyyy" from a plain "yyyy-mm-dd" date string (every date column
   * this report deals with - invoice_date/purchase_date - is a DATE column
   * with no time part, same as what the on-screen tables already show via
   * the `date` pipe). Falls back to the raw value for anything that isn't
   * a plain date (a '2026-09' month label, a category name) so it's safe to
   * call on every column without checking the row shape first. */
  private ddmmyyyy(value: string | null | undefined): string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? '';
    const [y, m, d] = value.split('-');
    return `${d}-${m}-${y}`;
  }

  private money(value: number | string | null | undefined): string {
    return (Number(value) || 0).toFixed(2);
  }

  private modeLabel(mode: string): string {
    return mode.replaceAll('_', ' ');
  }

  /** Same data the active tab already has loaded and on screen - this method
   * just reshapes it into plain {title, head, rows} tables so downloadPdf()
   * and downloadExcel() can render identical content two different ways.
   * Returns [] if the tab's report hasn't loaded yet (nothing to export). */
  private buildExportSections(): ExportSection[] {
    switch (this.activeTab) {
      case 'sales': {
        const r = this.salesReport();
        if (!r) return [];
        // Only the line-item detail, not the Summary/By-period/By-mode
        // aggregate cards above it on screen - the user asked for "only
        // invoice details, like All invoices in this period" specifically
        // because the earlier version's download bundled all four sections
        // together. Respects the same payment-mode filter the on-screen
        // table does, so downloading after filtering to "EMI" exports only
        // those invoices. A Grand Total row is still appended below the
        // detail rows - it uses r.summary (the same server-computed,
        // cancelled-excluded figures the Summary cards above show), not a
        // re-sum of the (possibly mode-filtered) rows above it, so it always
        // answers "what did this whole period actually total" regardless of
        // which mode is being viewed.
        const invoiceRows = this.filterInvoicesByMode(r.invoices).map((inv) => [
          inv.invoice_no,
          this.ddmmyyyy(inv.invoice_date),
          inv.customer_name,
          inv.customer_phone || '-',
          this.money(inv.taxable_amount),
          this.money(inv.gst),
          this.money(inv.total_amount),
          this.modeLabel(inv.payment_mode),
          inv.payment_mode === 'emi' ? this.money(inv.emi_amount) : '-',
          inv.status,
        ]);
        invoiceRows.push([
          'Grand Total',
          '',
          '',
          '',
          this.money(r.summary.taxable),
          this.money(r.summary.gst),
          this.money(r.summary.total),
          '',
          '',
          '',
        ]);
        return [
          {
            title: 'All Invoices in this Period',
            head: ['Invoice No', 'Date', 'Customer', 'Mobile', 'Taxable', 'GST', 'Total', 'Payment Mode', 'EMI Amount', 'Status'],
            rows: invoiceRows,
          },
        ];
      }
      case 'purchases': {
        const r = this.purchaseReport();
        if (!r) return [];
        // Per-purchase detail rows, plus a Grand Total row (from r.summary,
        // the same cancelled-excluded figures behind the cards above).
        const purchaseRows = r.rows.map((row) => [
          this.ddmmyyyy(row.purchase_date),
          row.supplier_name,
          row.supplier_invoice_no,
          row.tax_type === 'IGST' ? 'IGST' : 'CGST+SGST',
          this.money(row.total_amount),
        ]);
        purchaseRows.push(['Grand Total', '', '', '', this.money(r.summary.total)]);
        return [
          {
            title: 'Purchases in this Period',
            head: ['Date', 'Supplier', 'Invoice No', 'Tax', 'Total'],
            rows: purchaseRows,
          },
        ];
      }
      case 'stock-valuation': {
        const r = this.stockValuation();
        if (!r) return [];
        // Per-product detail rows, plus a Grand Total row for Stock Value
        // (matching the Total Stock Value card above) - On Hand isn't
        // summed since a total unit count across different products isn't
        // a meaningful figure.
        const stockRows = r.rows.map((row) => [row.product_name, row.category_name, row.on_hand, this.money(row.stock_value)]);
        stockRows.push(['Grand Total', '', '', this.money(r.total_value)]);
        return [
          {
            title: 'Stock on Hand',
            head: ['Product', 'Category', 'On Hand', 'Stock Value'],
            rows: stockRows,
          },
        ];
      }
      case 'profit': {
        const r = this.profitReport();
        if (!r) return [];
        // Per-product detail rows, plus a Grand Total row - Qty Sold summed
        // directly from the rows, Revenue/Cost/Profit from r.summary (same
        // figures the cards above show).
        const profitRows = r.rows.map((row) => [row.product_name, row.qty_sold, this.money(row.revenue), this.money(row.cost), this.money(row.profit)]);
        const totalQtySold = r.rows.reduce((sum, row) => sum + (Number(row.qty_sold) || 0), 0);
        profitRows.push(['Grand Total', totalQtySold, this.money(r.summary.revenue), this.money(r.summary.cost), this.money(r.summary.profit)]);
        return [
          {
            title: 'Profit by Product',
            head: ['Product', 'Qty Sold', 'Revenue', 'Cost', 'Profit'],
            rows: profitRows,
          },
        ];
      }
      case 'gst': {
        const r = this.gstReport();
        if (!r) return [];
        const gstHead = ['Taxable', 'CGST', 'SGST', 'IGST', 'Total GST'];
        return [
          {
            title: 'Sales GST (Output)',
            head: gstHead,
            rows: [[this.money(r.output.taxable), this.money(r.output.cgst), this.money(r.output.sgst), this.money(r.output.igst), this.money(r.output.total_gst)]],
          },
          {
            title: 'Purchases GST (Input)',
            head: gstHead,
            rows: [[this.money(r.input.taxable), this.money(r.input.cgst), this.money(r.input.sgst), this.money(r.input.igst), this.money(r.input.total_gst)]],
          },
          {
            title: 'Net',
            head: [r.net_payable >= 0 ? 'Net GST Payable' : 'Net GST Credit Carried Forward'],
            rows: [[this.money(Math.abs(r.net_payable))]],
          },
        ];
      }
      case 'collection': {
        const r = this.collectionReport();
        if (!r) return [];
        // Dynamic mode columns - only the modes actually seen in this date
        // range get a column, same as the on-screen pivot table, plus a
        // Total column and a final Total row so the export matches exactly
        // what's on screen.
        const head = ['Date', ...r.modes.map((m) => this.modeColumnLabel(m)), 'Total'];
        const rows = r.days.map((day) => [
          this.ddmmyyyy(day.date),
          ...r.modes.map((m) => this.money(day.amounts[m])),
          this.money(day.total),
        ]);
        rows.push(['Grand Total', ...r.modes.map((m) => this.money(r.mode_totals[m])), this.money(r.grand_total)]);
        return [
          {
            title: 'Collection by Day and Payment Mode',
            head,
            rows,
          },
        ];
      }
    }
  }

  private exportFilename(extension: string): string {
    return `${this.activeTab}-report_${this.fromDate}_to_${this.toDate}.${extension}`;
  }

  /** Real one-click PDF, not a "print this page" dialog - jsPDF draws each
   * section as its own table via the autoTable plugin, entirely client-side
   * (no server PDF engine involved - see SalesController's class doc comment
   * on why this app has no dompdf-based PDF generation for invoices either;
   * this keeps the same "no backend dependency" shape for Reports). */
  downloadPdf(): void {
    const sections = this.buildExportSections();
    if (sections.length === 0) {
      this.toast.error('Nothing to export yet - wait for this report to finish loading.');
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(TAB_LABELS[this.activeTab], 14, 15);
    doc.setFontSize(10);
    doc.text(`${this.ddmmyyyy(this.fromDate)} to ${this.ddmmyyyy(this.toDate)}`, 14, 21);

    let cursorY = 27;
    for (const section of sections) {
      doc.setFontSize(11);
      doc.text(section.title, 14, cursorY);
      autoTable(doc, {
        startY: cursorY + 3,
        head: [section.head],
        body: section.rows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [214, 51, 108] },
        margin: { left: 14, right: 14 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cursorY = (doc as any).lastAutoTable.finalY + 12;
      if (cursorY > 270) {
        doc.addPage();
        cursorY = 15;
      }
    }

    doc.save(this.exportFilename('pdf'));
  }

  /** "Excel download" as CSV rather than a real .xlsx - Excel opens a CSV
   * natively with no import step, and this avoids taking on the `xlsx`
   * (SheetJS) npm package, whose only currently-published version carries an
   * unpatched high-severity advisory (prototype pollution/ReDoS) - not worth
   * it for a plain export feature. Every section becomes its own little
   * table in the same file, separated by a blank line, in the same order as
   * the PDF above. */
  downloadExcel(): void {
    const sections = this.buildExportSections();
    if (sections.length === 0) {
      this.toast.error('Nothing to export yet - wait for this report to finish loading.');
      return;
    }

    const escapeCsv = (value: string | number): string => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const lines: string[] = [];
    lines.push(escapeCsv(TAB_LABELS[this.activeTab]));
    lines.push(escapeCsv(`${this.ddmmyyyy(this.fromDate)} to ${this.ddmmyyyy(this.toDate)}`));
    lines.push('');
    for (const section of sections) {
      lines.push(escapeCsv(section.title));
      lines.push(section.head.map(escapeCsv).join(','));
      for (const row of section.rows) {
        lines.push(row.map(escapeCsv).join(','));
      }
      lines.push('');
    }

    // Leading BOM so Excel (not just browsers) reliably opens this as UTF-8 -
    // otherwise the ₹ symbol, if it ever ends up in exported text, would
    // mis-render as garbled characters in Excel specifically.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.exportFilename('csv');
    link.click();
    URL.revokeObjectURL(url);
  }

  private fail(err: unknown): void {
    this.loading.set(false);
    this.toast.error(extractErrorMessage(err, 'Could not load this report.'));
  }
}
