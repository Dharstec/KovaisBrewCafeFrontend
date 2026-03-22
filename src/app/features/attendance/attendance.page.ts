import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthApi } from '../../core/api/auth.api';

interface Attendance {
  employee_id: number;
  name: string;
  status: 'P' | 'A';
  date: string;
}

@Component({
  standalone: true,
  selector: 'app-attendance-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './attendance.page.html',
  styleUrls: ['./attendance.page.scss']
})
export class AttendancePage implements OnInit {

  private http = inject(HttpClient);
  auth = inject(AuthApi);

  isAdmin = this.auth.isAdmin();  
  date = '';             
  list: Attendance[] = [];

  ngOnInit() {
    // 📅 Always default to TODAY
    this.date = new Date().toISOString().slice(0, 10);

    this.load();
  }

  load() {
    this.http
      .get<Attendance[]>(`${environment.apiUrl}/attendance?date=${this.date}`)
      .subscribe(res => {
        this.list = res.map(r => ({
          ...r,
          date: this.date
        }));
      });
  }

  save() {
    this.http
      .post(`${environment.apiUrl}/attendance`, this.list)
      .subscribe(() => {
        alert('Attendance saved successfully');
      });
  }
}
