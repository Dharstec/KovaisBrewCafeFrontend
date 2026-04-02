import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaInstallService } from '../../core/services/pwa-install.service';

@Component({
  standalone: true,
  selector: 'app-pwa-install-banner',
  imports: [CommonModule],
  templateUrl: './pwa-install-banner.component.html',
  styleUrls: ['./pwa-install-banner.component.scss']
})
export class PwaInstallBannerComponent {
  pwa = inject(PwaInstallService);
}
