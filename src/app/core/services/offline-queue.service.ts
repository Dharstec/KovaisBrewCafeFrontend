import { Injectable } from '@angular/core';

export interface OfflineBill {
  local_id: string;
  type: 'pending' | 'complete';
  bill_id?: number | null;
  customer_name: string;
  items: any[];
  payment_mode?: string;
  grand_total?: number;
  discount_amount?: number;
  platform?: string | null;
  created_at: string;
  status: 'queued' | 'synced';
}

@Injectable({ providedIn: 'root' })
export class OfflineQueueService {

  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'brew_cafe_offline';
  private readonly STORE  = 'bill_queue';
  private ready: Promise<void>;

  constructor() {
    this.ready = this.openDB();
  }

  private openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE)) {
          db.createObjectStore(this.STORE, { keyPath: 'local_id' });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async add(bill: OfflineBill): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).put(bill);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getAll(): Promise<OfflineBill[]> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE, 'readonly');
      const req = tx.objectStore(this.STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => reject(req.error);
    });
  }

  async remove(local_id: string): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(this.STORE, 'readwrite');
      const req = tx.objectStore(this.STORE).delete(local_id);
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
