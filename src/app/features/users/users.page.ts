import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthApi } from '../../core/api/auth.api';
import { UsersApi } from '../../core/api/users.api';
import { ToastService } from '../../core/services/toast.service';

type Tab = 'users' | 'roles';

@Component({
  standalone: true,
  selector: 'app-users-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './users.page.html'
})
export class UsersPage implements OnInit {
  private usersApi = inject(UsersApi);
  private authApi  = inject(AuthApi);
  private toast    = inject(ToastService);

  activeTab: Tab = 'users';
  currentUserId  = this.authApi.getUser()?.id;

  /* ── Users ── */
  users: any[]    = [];
  usersLoading    = false;
  shops: any[]    = [];

  showCreateForm  = false;
  createForm = { user_name: '', email: '', password: '', role_id: null as number | null, shop_id: null as number | null };
  createLoading   = false;
  createError     = '';

  editingUserId: number | null = null;
  editForm = { user_name: '', role_id: null as number | null, shop_id: null as number | null, password: '' };
  editLoading     = false;
  editError       = '';

  /* ── Roles ── */
  roles: any[]    = [];
  rolesLoading    = false;
  newRoleName     = '';
  roleLoading     = false;
  roleError       = '';

  ngOnInit() {
    this.loadUsers();
    this.loadShops();
    this.loadRoles();
  }

  setTab(t: Tab) { this.activeTab = t; }

  /* ══ USERS ══════════════════════════════════════════════ */
  loadUsers() {
    this.usersLoading = true;
    this.usersApi.getUsers().subscribe({
      next: res => { this.users = res.data || []; this.usersLoading = false; },
      error: () => { this.usersLoading = false; this.toast.error('Failed to load users'); }
    });
  }

  loadShops() {
    this.authApi.getShops().subscribe({
      next: res => { this.shops = res.data || []; }
    });
  }

  roleLabel(id: number | null): string {
    return this.roles.find(r => r.id === id)?.role_type || '—';
  }

  isAdminRole(role_id: number | null): boolean {
    return this.roles.find(r => r.id === Number(role_id))?.role_type === 'Admin';
  }

  toggleCreate() {
    this.showCreateForm = !this.showCreateForm;
    this.createError = '';
    this.createForm = { user_name: '', email: '', password: '', role_id: null, shop_id: null };
  }

  submitCreate() {
    if (!this.createForm.user_name.trim())   { this.createError = 'Username required'; return; }
    if (!this.createForm.email.trim())        { this.createError = 'Email required'; return; }
    if (!this.createForm.password.trim())     { this.createError = 'Password required'; return; }
    if (!this.createForm.role_id)             { this.createError = 'Select a role'; return; }

    this.createLoading = true;
    this.createError   = '';
    const payload: any = {
      user_name: this.createForm.user_name.trim(),
      email:     this.createForm.email.trim(),
      password:  this.createForm.password,
      role_id:   Number(this.createForm.role_id)
    };
    if (!this.isAdminRole(this.createForm.role_id) && this.createForm.shop_id) {
      payload.shop_id = Number(this.createForm.shop_id);
    }

    this.usersApi.createUser(payload).subscribe({
      next: () => {
        this.createLoading = false;
        this.showCreateForm = false;
        this.toast.success('User created');
        this.loadUsers();
      },
      error: err => {
        this.createLoading = false;
        this.createError   = err.error?.message || 'Failed to create user';
      }
    });
  }

  startEdit(u: any) {
    this.editingUserId = u.id;
    this.editForm = {
      user_name: u.user_name || '',
      role_id:   u.role_id   || null,
      shop_id:   u.shop_id   || null,
      password:  ''
    };
    this.editError = '';
  }

  cancelEdit() { this.editingUserId = null; }

  submitEdit(u: any) {
    if (!this.editForm.user_name.trim()) { this.editError = 'Username required'; return; }
    if (!this.editForm.role_id)          { this.editError = 'Select a role'; return; }

    this.editLoading = true;
    this.editError   = '';
    const payload: any = {
      user_name: this.editForm.user_name.trim(),
      role_id:   Number(this.editForm.role_id),
      shop_id:   this.isAdminRole(this.editForm.role_id) ? null : (this.editForm.shop_id ? Number(this.editForm.shop_id) : 1)
    };
    if (this.editForm.password.trim()) {
      payload.password = this.editForm.password.trim();
    }

    this.usersApi.updateUser(u.id, payload).subscribe({
      next: () => {
        this.editLoading = false;
        this.editingUserId = null;
        this.toast.success('User updated');
        this.loadUsers();
      },
      error: err => {
        this.editLoading = false;
        this.editError = err.error?.message || 'Failed to update';
      }
    });
  }

  deleteUser(u: any) {
    if (!confirm(`Delete user "${u.user_name}"?\nThis cannot be undone.`)) return;
    this.usersApi.deleteUser(u.id).subscribe({
      next: () => {
        this.users = this.users.filter(x => x.id !== u.id);
        this.toast.success('User deleted');
      },
      error: err => this.toast.error(err.error?.message || 'Delete failed')
    });
  }

  /* ══ ROLES ══════════════════════════════════════════════ */
  loadRoles() {
    this.rolesLoading = true;
    this.usersApi.getRoles().subscribe({
      next: res => { this.roles = res.data || []; this.rolesLoading = false; },
      error: () => { this.rolesLoading = false; }
    });
  }

  submitCreateRole() {
    if (!this.newRoleName.trim()) { this.roleError = 'Role name required'; return; }
    this.roleLoading = true;
    this.roleError   = '';
    this.usersApi.createRole(this.newRoleName.trim()).subscribe({
      next: res => {
        this.roleLoading = false;
        this.newRoleName = '';
        this.roles.push(res.data);
        this.toast.success(`Role "${res.data.role_type}" created`);
      },
      error: err => {
        this.roleLoading = false;
        this.roleError   = err.error?.message || 'Failed to create role';
      }
    });
  }

  usersInRole(roleId: number): string {
    const count = this.users.filter(u => u.role_id === roleId).length;
    return count ? `${count} user${count > 1 ? 's' : ''}` : '—';
  }

  fmtDate(d: string) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
