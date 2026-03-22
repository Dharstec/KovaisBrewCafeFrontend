import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class StockService {
  http = inject(HttpClient);

  getStock() {
    return this.http.get<any[]>(`${environment.apiUrl}/stock`);
  }

  refill(productId:number, qty:number) {
    return this.http.post(`${environment.apiUrl}/stock/refill`, {
      productId, qty
    });
  }
}
