import { Injectable } from '@angular/core';
import { formatDate } from '@angular/common';

/**
 * PrinterService — one receipt, two ways to print it
 *
 *  • Browser (laptop + USB/Bluetooth 58 mm thermal printer, e.g. HOP-H58):
 *    the Completed page renders toReceiptView() as HTML and calls printPage().
 *  • Android + RawBT app (Bluetooth): buildReceiptBytes() turns the same view
 *    into ESC/POS commands and printViaRawBT() hands them to RawBT.
 *
 * Both use the same numbers, the same one-line item names (long names end
 * in "..."), and dates as dd/mm/yy.
 */

/** A bill, in whatever shape it comes from (the API or the billing screen). */
export interface ReceiptSource {
  id           : number | string;
  createdAt?   : string | Date | null;
  customerName?: string | null;
  paymentMode? : string | null;            // CASH | UPI | SPLIT
  cashAmount?  : number | string | null;   // SPLIT only
  upiAmount?   : number | string | null;   // SPLIT only
  couponCode?  : string | null;
  items        : { name: string; qty: number | string; price: number | string }[];
  grandTotal   : number | string;
}

/** Everything a receipt prints, already worked out. */
export interface ReceiptView {
  billNo       : string;
  date         : string;                   // dd/MM/yy
  time         : string;                   // hh:mm AM — empty for back-dated bills
  customer     : string;
  payMode      : string;                   // Cash | UPI | Cash + UPI
  lines        : { name: string; qty: number; amount: number }[];
  qtyCount     : number;
  subtotal     : number;
  discount     : number;                   // subtotal − total, when the total is lower
  discountLabel: string;
  extra        : number;                   // total − subtotal, if the total is ever higher
  total        : number;                   // what was charged (grand_total)
  payments     : { label: string; amount: number }[];   // split payments only
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable({ providedIn: 'root' })
export class PrinterService {

  /** Printed at the top and bottom of every receipt. Leave a field empty to hide it. */
  readonly shop = {
    name   : "KOVAI'S BREW CAFÉ",
    address: 'Saravanampatti, Coimbatore',
    phone  : '+91 63690 46081',
    gstin  : '',                           // add when GST registered
    social : '@kovaisbrewcafe',
    thanks : 'Thank you! Visit again',
  };

  private readonly PRINTER_WIDTH = 32;     // ESC/POS: 58 mm paper = 32 characters (Font A)

  // ─── Receipt maths ───────────────────────────────────────

  /**
   * The total is always the bill's own grand_total. Any gap between it and
   * the items is shown as its own line, so the printed lines always add up
   * to the amount charged — even for bills edited after completion.
   */
  toReceiptView(src: ReceiptSource): ReceiptView {
    const lines = (src.items || []).map(i => {
      const qty = Number(i.qty) || 0;
      return { name: String(i.name || '').trim(), qty, amount: round2((Number(i.price) || 0) * qty) };
    });
    const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
    const total    = round2(Number(src.grandTotal) || 0);
    const gap      = round2(subtotal - total);

    const mode = String(src.paymentMode || 'CASH').toUpperCase();
    const payMode = mode === 'CASH' ? 'Cash'
                  : mode === 'SPLIT' ? 'Cash + UPI'
                  : mode === 'UPI' ? 'UPI'
                  : mode.charAt(0) + mode.slice(1).toLowerCase();
    const payments = mode === 'SPLIT'
      ? [
          { label: 'Cash', amount: round2(Number(src.cashAmount) || 0) },
          { label: 'UPI',  amount: round2(Number(src.upiAmount)  || 0) },
        ].filter(p => p.amount > 0)
      : [];

    /* "2026-10-12" (a back-dated bill) is a local date, not UTC midnight */
    const ymd = typeof src.createdAt === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(src.createdAt);
    let when = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3])
             : src.createdAt ? new Date(src.createdAt as any) : new Date();
    if (isNaN(when.getTime())) when = new Date();
    /* back-dated bills are stored at midnight — their real time isn't known */
    const midnight = when.getHours() === 0 && when.getMinutes() === 0 && when.getSeconds() === 0;
    const code = String(src.couponCode || '').trim();

    return {
      billNo  : String(src.id),
      date    : formatDate(when, 'dd/MM/yy', 'en-US'),
      time    : midnight ? '' : formatDate(when, 'hh:mm a', 'en-US'),
      customer: String(src.customerName || '').trim(),
      payMode,
      lines,
      qtyCount: lines.reduce((s, l) => s + l.qty, 0),
      subtotal,
      discount: gap > 0 ? gap : 0,
      discountLabel: code ? `Discount (${code})` : 'Discount',
      extra   : gap < 0 ? -gap : 0,
      total,
      payments,
    };
  }

  // ─── Browser printing (58 mm thermal via the print dialog) ───

  /**
   * Prints the page with zero page margins, so the receipt starts at the top
   * of the paper with no blank band. The rule is added only for this print
   * and removed afterwards, so A4 reports keep their normal margins.
   */
  printPage(): void {
    const style = document.createElement('style');
    style.id = 'receipt-page';
    style.textContent = '@page { margin: 0; }';
    document.getElementById('receipt-page')?.remove();
    document.head.appendChild(style);

    const done = () => { style.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
  }

  // ─── ESC/POS command bytes ───────────────────────────────

  private readonly LF  = 0x0A;   // new line

  private cmd = {
    init:            [0x1B, 0x40],          // ESC @ — initialize printer
    cutFull:         [0x1D, 0x56, 0x00],    // GS V 0 — full cut
    cutPartial:      [0x1D, 0x56, 0x01],    // GS V 1 — partial cut
    alignLeft:       [0x1B, 0x61, 0x00],    // ESC a 0
    alignCenter:     [0x1B, 0x61, 0x01],    // ESC a 1
    alignRight:      [0x1B, 0x61, 0x02],    // ESC a 2
    textNormal:      [0x1B, 0x21, 0x00],    // ESC ! 0 — normal size
    textBold:        [0x1B, 0x21, 0x08],    // ESC ! 8 — bold
    textTall:        [0x1B, 0x21, 0x18],    // ESC ! 24 — bold + double height (same width, so 32 columns still fit)
    textDouble:      [0x1B, 0x21, 0x30],    // ESC ! 48 — double width+height
    boldOn:          [0x1B, 0x45, 0x01],    // ESC E 1 — bold on
    boldOff:         [0x1B, 0x45, 0x00],    // ESC E 0 — bold off
    doubleStrikeOn:  [0x1B, 0x47, 0x01],    // ESC G 1 — double-strike (darker print)
    doubleStrikeOff: [0x1B, 0x47, 0x00],    // ESC G 0
    // Print density: GS ( E 3 0 4 n  (n=0 lightest … 8 darkest)
    densityDarkest:  [0x1D, 0x28, 0x45, 0x03, 0x00, 0x04, 0x08],
    feedLines:       (n: number) => [0x1B, 0x64, n], // ESC d n
  };

  // ─── Build receipt bytes ─────────────────────────────────

  buildReceiptBytes(r: ReceiptView): Uint8Array {
    const W = this.PRINTER_WIDTH;
    const bytes: number[] = [];

    /* The printer's code page has no ₹, É or curly quotes — send plain ASCII. */
    const ascii = (s: string) => String(s)
      .replace(/₹/g, 'Rs.')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
      .replace(/[^\x20-\x7E]/g, '');
    /* One line only: anything too long ends in "..." */
    const fit = (s: string, w: number) => s.length <= w ? s : w > 3 ? s.slice(0, w - 3).trimEnd() + '...' : s.slice(0, w);
    const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const push = (...args: number[]) => bytes.push(...args);
    const line = (str = '') => {
      const t = ascii(str);
      for (let i = 0; i < t.length; i++) bytes.push(t.charCodeAt(i));
      push(this.LF);
    };
    const separator = (char = '-') => line(char.repeat(W));
    /* left text, right text, on one 32-character line */
    const lr = (left: string, right: string) => {
      const R = ascii(right), room = Math.max(0, W - R.length - 1);
      line(fit(ascii(left), room).padEnd(W - R.length) + R);
    };

    // ── Init + Darkness settings ──
    push(...this.cmd.init);
    push(...this.cmd.densityDarkest);   // max print density
    push(...this.cmd.doubleStrikeOn);   // print each dot twice = darker output

    // ── Header ──
    push(...this.cmd.alignCenter);
    push(...this.cmd.textTall);
    line(fit(ascii(this.shop.name), W));
    push(...this.cmd.textNormal);
    if (this.shop.address) line(fit(ascii(this.shop.address), W));
    if (this.shop.phone)   line('Ph: ' + this.shop.phone);
    if (this.shop.gstin)   line('GSTIN: ' + this.shop.gstin);

    // ── Bill info ──
    push(...this.cmd.alignLeft);
    separator('-');
    lr('Bill No: ' + r.billNo, r.date);
    lr('Payment: ' + r.payMode, r.time);
    if (r.customer) line(fit(ascii('Customer: ' + r.customer), W));
    separator('-');

    // ── Items: name | qty | amount ──
    const cols = (qty: string, amt: string) => qty.padStart(3) + ' ' + amt.padStart(8);
    push(...this.cmd.boldOn);
    lr('ITEM', cols('QTY', 'AMOUNT'));
    push(...this.cmd.boldOff);
    for (const l of r.lines) lr(l.name, cols(String(l.qty), money(l.amount)));
    separator('-');

    // ── Totals ──
    lr(`Sub Total (${r.qtyCount} ${r.qtyCount === 1 ? 'item' : 'items'})`, money(r.subtotal));
    if (r.discount) lr(r.discountLabel, '-' + money(r.discount));
    if (r.extra)    lr('Other charges', money(r.extra));
    separator('=');
    push(...this.cmd.textTall);
    lr('TOTAL', 'Rs.' + money(r.total));
    push(...this.cmd.textNormal);
    separator('=');
    for (const p of r.payments) lr('Paid by ' + p.label, money(p.amount));

    // ── Footer ──
    push(...this.cmd.alignCenter);
    push(...this.cmd.boldOn);
    line(this.shop.thanks);
    push(...this.cmd.boldOff);
    if (this.shop.social) line('Follow us ' + this.shop.social);

    // Feed 1 line, then cut
    push(...this.cmd.feedLines(1));
    push(...this.cmd.cutPartial);

    return new Uint8Array(bytes);
  }

  // ─── Convert to Base64 ───────────────────────────────────

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // ─── Trigger RawBT print ─────────────────────────────────

  printViaRawBT(bill: ReceiptSource): void {
    const bytes  = this.buildReceiptBytes(this.toReceiptView(bill));
    const base64 = this.toBase64(bytes);

    // Correct RawBT URI format: rawbt://base64/<base64-escpos-data>
    const uri = `rawbt://base64/${base64}`;
    window.location.href = uri;
  }

  // ─── Quick test print (plain text, no ESC/POS) ───────────
  // Call this from a test button to verify RawBT connection
  testPrint(): void {
    const text = [
      '\x1B\x40',                        // init
      '\x1D\x28\x45\x03\x00\x04\x08',   // density darkest
      '\x1B\x47\x01',                    // double-strike on
      '\x1B\x61\x01',                    // center
      'Kovais Brew Cafe\n',
      '----------------\n',
      '\x1B\x61\x00',                    // left
      'Test Print OK\n',
      'Printer working!\n',
      '\n\n\n',
      '\x1D\x56\x01'                     // partial cut
    ].join('');

    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 0xFF);
    const base64 = this.toBase64(new Uint8Array(bytes));

    window.location.href = `rawbt://base64/${base64}`;
  }

  // ─── Check if running on Android ─────────────────────────

  isAndroid(): boolean {
    return /android/i.test(navigator.userAgent);
  }
}
