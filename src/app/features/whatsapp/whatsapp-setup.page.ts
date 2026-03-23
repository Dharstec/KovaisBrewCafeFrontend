import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardApi } from '../../core/api/dashboard.api';

@Component({
  selector: 'app-whatsapp-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './whatsapp-setup.page.html',
  styleUrls: ['./whatsapp-setup.page.scss']
})
export class WhatsappSetupPage implements OnInit, OnDestroy {

  api = inject(DashboardApi);

  isReady    = false;
  qr: string | null = null;
  initError: string | null = null;
  groups: { id: string; name: string }[] = [];
  selectedGroup = '';
  preview   = '';

  sending   = false;
  sendMsg   = '';
  sendError = '';

  loadingStatus = true;
  private pollTimer: any;

  ngOnInit() {
    this.pollStatus();
    // Poll every 4 seconds until ready
    this.pollTimer = setInterval(() => {
      if (!this.isReady) this.pollStatus();
    }, 4000);
  }

  ngOnDestroy() {
    clearInterval(this.pollTimer);
  }

  pollStatus() {
    this.api.getWhatsappStatus().subscribe({
      next: (s: any) => {
        this.loadingStatus = false;
        this.isReady    = s.ready;
        this.qr         = s.qr;
        this.initError  = s.error || null;
        if (s.ready) {
          clearInterval(this.pollTimer);
          this.loadGroups();
          this.loadPreview();
        }
      },
      error: () => { this.loadingStatus = false; }
    });
  }

  loadGroups() {
    this.api.getWhatsappGroups().subscribe({
      next: (g) => { this.groups = g; }
    });
  }

  loadPreview() {
    this.api.getWhatsappPreview().subscribe({
      next: (p) => { this.preview = p.message; }
    });
  }

  sendNow() {
    this.sending   = true;
    this.sendMsg   = '';
    this.sendError = '';
    const gid = this.selectedGroup || undefined;
    this.api.sendWhatsappNow(gid).subscribe({
      next: (r) => {
        this.sending = false;
        this.sendMsg = r.message;
      },
      error: (e) => {
        this.sending   = false;
        this.sendError = e.error?.message || 'Send failed';
      }
    });
  }
}
