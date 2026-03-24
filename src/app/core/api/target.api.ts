import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TargetApi {
  private http = inject(HttpClient);
  private API = `${environment.apiUrl}/targets`;

  getAll() { return this.http.get<any[]>(this.API); }
  getById(id: number) { return this.http.get<any>(`${this.API}/${id}`); }
  create(body: any) { return this.http.post<any>(this.API, body); }
  update(id: number, body: any) { return this.http.put<any>(`${this.API}/${id}`, body); }
  delete(id: number) { return this.http.delete<any>(`${this.API}/${id}`); }
  addItem(targetId: number, body: any) { return this.http.post<any>(`${this.API}/${targetId}/items`, body); }
  deleteItem(targetId: number, itemId: number) { return this.http.delete<any>(`${this.API}/${targetId}/items/${itemId}`); }
  getAchievement(id: number) { return this.http.get<any>(`${this.API}/${id}/achievement`); }
}
