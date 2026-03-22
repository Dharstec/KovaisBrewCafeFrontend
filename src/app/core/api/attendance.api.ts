import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Attendance {
  employee_id: number;
  name: string;
  status: 'P' | 'A';
  date: string;
}

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private http = inject(HttpClient);

  getByDate(date: string) {
    return this.http.get<Attendance[]>(
      `${environment.apiUrl}/attendance?date=${date}`
    );
  }

  save(list: Attendance[]) {
    return this.http.post(
      `${environment.apiUrl}/attendance`,
      list
    );
  }
}
