import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;

  /** true = Android Chrome has a native install prompt ready */
  canInstall   = signal(false);
  /** true = iOS Safari (must use Share → Add to Home Screen) */
  isIos        = signal(false);
  /** true = already running as installed PWA */
  isInstalled  = signal(false);
  /** true = user dismissed the banner (persisted 30 days) */
  isDismissed  = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;

    // Already installed?
    if ((window.navigator as any).standalone === true
        || window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled.set(true);
      return;
    }

    // iOS detection
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua) && !(window as any).MSStream) {
      this.isIos.set(true);
    }

    // Check dismiss cookie
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed && Date.now() < Number(dismissed)) {
      this.isDismissed.set(true);
    }

    // Android Chrome prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.canInstall.set(false);
      this.deferredPrompt = null;
    });
  }

  get showBanner(): boolean {
    if (this.isInstalled()) return false;
    if (this.isDismissed()) return false;
    return this.canInstall() || this.isIos();
  }

  async triggerInstall(): Promise<void> {
    if (!this.deferredPrompt) return;
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.isInstalled.set(true);
    }
    this.deferredPrompt = null;
    this.canInstall.set(false);
  }

  dismiss() {
    // Suppress for 30 days
    localStorage.setItem('pwa_banner_dismissed', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    this.isDismissed.set(true);
  }
}
