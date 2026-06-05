import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
}

export interface LocalCategory {
  name: string;
}

export interface LocalCustomer {
  id: string; // unique ID or barcode
  name: string;
  address: string;
  contact_number: string;
  birthdate: string;
  suki_number?: string;
  points?: number;
  created_at: string;
}

export interface LocalAttendance {
  id: string;
  user_id: string;
  user_name: string;
  time_in: string;
  time_out?: string;
  date: string; // YYYY-MM-DD
}

export interface LocalStaff {
  id: string;
  name: string;
  address: string;
  contact_number: string;
  joined_at: string;
}

export interface LocalOrder {
  id: string;
  content: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface LocalGCashAccount {
  id: string;
  name: string;
  capital?: number;
  capital_cashout?: number;
  created_at: string;
}

export interface LocalGCashTransaction {
  id: string;
  account_id: string;
  customer_name: string;
  reference_number: string;
  mode: 'cash-in' | 'cash-out' | 'load';
  amount: number;
  fee: number;
  status: 'pending' | 'complete';
  created_at: string;
}

export interface PendingTransaction {
  id?: number;
  path: string;
  method: string;
  data: any;
  status: 'pending' | 'syncing' | 'failed';
  timestamp: number;
}

export class POSDatabase extends Dexie {
  products!: Table<LocalProduct>;
  categories!: Table<LocalCategory>;
  pendingTransactions!: Table<PendingTransaction>;
  credits!: Table<any>;
  customers!: Table<LocalCustomer>;
  attendance!: Table<LocalAttendance>;
  staff!: Table<LocalStaff>;
  orders!: Table<LocalOrder>;
  gcash!: Table<LocalGCashTransaction>;
  gcashAccounts!: Table<LocalGCashAccount>;

  constructor() {
    super('SwiftPOS_Offline_DB');
    this.version(13).stores({
      products: 'id, name, category, sku',
      categories: 'name',
      pendingTransactions: '++id, status, timestamp, path, method',
      credits: 'id, borrower_name, status, created_at',
      customers: null,
      attendance: null,
      staff: null,
      orders: 'id, created_at',
      gcash: 'id, account_id, reference_number, mode, status, created_at',
      gcashAccounts: 'id, name',
      customers_v2: 'id, name, contact_number, suki_number',
      attendance_v2: 'id, user_id, date, time_in',
      staff_v2: 'id, name, contact_number'
    });
    
    // Map class properties to the new storage tables
    this.customers = this.table('customers_v2');
    this.attendance = this.table('attendance_v2');
    this.staff = this.table('staff_v2');
  }
}

export const db = new POSDatabase();
