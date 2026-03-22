import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class  SpendService {

  private http = inject(HttpClient);
  private API = `${environment.apiUrl}/shop_spend`;

  /* =============================
     GET ALL SPEND (LIST PAGE)
     ============================= */
  getAll(
    searchTerm = '',
    page = 1,
    pageSize = 10,
    sortColumn = 'date',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) {
    return this.http.get<any>(this.API, {
      params: {
        searchTerm,
        page,
        pageSize,
        sortColumn,
        sortOrder
      }
    });
  }

  /* =============================
     CREATE SPEND
     ============================= */
  create(body: any) {
    return this.http.post<any>(this.API, body);
  }

  /* =============================
     UPDATE SPEND
     ============================= */
  update(id: number, body: any) {
    return this.http.put<any>(`${this.API}/${id}`, body);
  }

  /* =============================
     DELETE SPEND
     ============================= */
  delete(id: number) {
    return this.http.delete<any>(`${this.API}/${id}`);
  }
}
