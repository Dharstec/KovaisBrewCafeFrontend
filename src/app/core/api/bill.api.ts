import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillApi {

  private http = inject(HttpClient);

  create(items: any[]) {
    return this.http.post(`${environment.apiUrl}/bills`, { items });
  }

  update(id: number, items: any[]) {
    return this.http.put(`${environment.apiUrl}/bills/${id}`, { items });
  }

  pending() {
    return this.http.get<any[]>(`${environment.apiUrl}/pending`);
  }

  get(id: number) {
    return this.http.get<any[]>(`${environment.apiUrl}/bills/${id}`);
  }

  complete(id: number, body: any) {
    return this.http.post(`${environment.apiUrl}/bill/complete/${id}`, body);
  }

  applyCoupon(id: number, body: any) {
    return this.http.post(`${environment.apiUrl}/apply/${id}`, body);
  }



  completed(
    startDate?: string,
    endDate?: string,
    page = 1,
    limit = 6
  ) {
    return this.http.get<any>(
      `${environment.apiUrl}/completed`,
      {
        params: {
          ...(startDate && { start_date: startDate }),
          ...(endDate && { end_date: endDate }),
          page,
          limit
        }
      }
    );
  }

}
