import { Injectable } from '@angular/core';

/**
 * PrinterService — prints receipts via RawBT app on Android
 *
 * How it works:
 *  1. Builds ESC/POS byte commands for the receipt
 *  2. Encodes them as Base64
 *  3. Opens rawbt:// URI — RawBT app intercepts it and sends to SC588 via Bluetooth
 *
 * Requirements:
 *  - Android device with RawBT app installed
 *  - SC588 printer paired via Bluetooth in RawBT
 */

@Injectable({ providedIn: 'root' })
export class PrinterService {

  private readonly CAFE_NAME    = 'Kovais Brew Cafe';
  private readonly CAFE_ADDRESS = '';          // optional: add your address
  private readonly CAFE_PHONE   = '';          // optional: add phone number
  private readonly PRINTER_WIDTH = 32;         // 58mm paper = ~32 chars wide

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

  buildReceiptBytes(bill: {
    billId      : number;
    customerName: string;
    paymentMode : string;
    items       : { name: string; qty: number; price: number }[];
    subtotal    : number;
    discount    : number;
    grandTotal  : number;
    date?       : string;
  }): Uint8Array {

    const bytes: number[] = [];

    const push = (...args: number[]) => bytes.push(...args);
    const text = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i) & 0xFF);
      }
    };
    const line  = (str: string) => { text(str); push(this.LF); };
    const newLine = () => push(this.LF);
    const separator = (char = '-') => line(char.repeat(this.PRINTER_WIDTH));

    const padRight = (s: string, w: number) => s.padEnd(w, ' ').substring(0, w);
    const padLeft  = (s: string, w: number) => s.padStart(w, ' ').substring(0, w);

    // ── Init + Darkness settings ──
    push(...this.cmd.init);
    push(...this.cmd.densityDarkest);   // max print density
    push(...this.cmd.doubleStrikeOn);   // print each dot twice = darker output

    // ── Header ──
    push(...this.cmd.alignCenter);
    push(...this.cmd.textDouble);
    line(this.CAFE_NAME);
    push(...this.cmd.textNormal);

    if (this.CAFE_ADDRESS) line(this.CAFE_ADDRESS);
    if (this.CAFE_PHONE)   line('Ph: ' + this.CAFE_PHONE);

    newLine();
    separator('=');

    // ── Bill info ──
    push(...this.cmd.alignLeft);
    const dateStr = bill.date || new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
    line('Bill #: ' + bill.billId);
    line('Date  : ' + dateStr);
    if (bill.customerName) line('Name  : ' + bill.customerName);
    line('Pay   : ' + (bill.paymentMode || 'CASH'));

    separator('-');

    // ── Column headers ──
    push(...this.cmd.boldOn);
    const itemW = this.PRINTER_WIDTH - 8 - 7;   // name | qty | amount
    line(padRight('Item', itemW) + padLeft('Qty', 4) + padLeft('Amt', 7));
    push(...this.cmd.boldOff);
    separator('-');

    // ── Items ──
    for (const item of bill.items) {
      const name   = item.name.substring(0, itemW);
      const qty    = String(item.qty);
      const amount = (item.price * item.qty).toFixed(0);
      line(padRight(name, itemW) + padLeft(qty, 4) + padLeft(amount, 7));
    }

    separator('-');

    // ── Totals ──
    const totalW = this.PRINTER_WIDTH;
    if (bill.discount > 0) {
      line(padRight('Subtotal', totalW - 7) + padLeft(bill.subtotal.toFixed(0), 7));
      line(padRight('Discount', totalW - 7) + padLeft('-' + bill.discount.toFixed(0), 7));
    }

    push(...this.cmd.boldOn);
    push(...this.cmd.textDouble);
    const totalStr = 'Rs.' + bill.grandTotal.toFixed(0);
    line(padRight('TOTAL', 16) + padLeft(totalStr, 16));
    push(...this.cmd.textNormal);
    push(...this.cmd.boldOff);

    separator('=');

    // Feed 1 line after total, then cut
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

  printViaRawBT(bill: {
    billId      : number;
    customerName: string;
    paymentMode : string;
    items       : { name: string; qty: number; price: number }[];
    subtotal    : number;
    discount    : number;
    grandTotal  : number;
    date?       : string;
  }): void {
    const bytes  = this.buildReceiptBytes(bill);
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
