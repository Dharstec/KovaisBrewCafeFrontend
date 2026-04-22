import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface CafeSettings {
  zomato_packing_default: string;
  swiggy_packing_default: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  get() {
    return this.http.get<CafeSettings>(`${this.base}/settings`);
  }

  update(payload: Partial<CafeSettings>) {
    return this.http.put<any>(`${this.base}/settings`, payload);
  }
}
