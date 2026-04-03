import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private deferredPrompt: any = null;

  canInstall    = signal(false);
  isIos         = signal(false);
  /** iOS but NOT in Safari — must open Safari first */
  iosNotSafari  = signal(false);
  isInstalled   = signal(false);
  isDismissed   = signal(false);
  showIosGuide  = signal(false);

  constructor() {
    if (typeof window === 'undefined') return;

    // Already installed?
    if ((window.navigator as any).standalone === true
        || window.matchMedia('(display-mode: standalone)').matches) {
      this.isInstalled.set(true);
      return;
    }

    const ua = navigator.userAgent;
    const isIosDevice = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;

    if (isIosDevice) {
      this.isIos.set(true);
      const isSafari = /safari/i.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua);
      if (!isSafari) this.iosNotSafari.set(true);
    }

    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed && Date.now() < Number(dismissed)) {
      this.isDismissed.set(true);
    }

    // Pick up the prompt captured in index.html before Angular booted
    const early = (window as any).__pwaInstallPrompt;
    if (early) {
      this.deferredPrompt = early;
      this.canInstall.set(true);
      (window as any).__pwaInstallPrompt = null;
    }

    // Also listen for future firings (e.g. after dismissal / update)
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
    if (outcome === 'accepted') this.isInstalled.set(true);
    this.deferredPrompt = null;
    this.canInstall.set(false);
  }

  dismiss() {
    localStorage.setItem('pwa_banner_dismissed', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    this.isDismissed.set(true);
    this.showIosGuide.set(false);
  }
}
