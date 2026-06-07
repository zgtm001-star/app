export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
}

export interface Receipt {
  id: string;
  merchantName: string;
  date: string; // YYYY-MM-DD
  totalAmount: number;
  taxAmount?: number;
  category: string;
  items: ReceiptItem[];
  status: 'pending_sync' | 'synced' | 'failed';
  timestamp: string;
  imageUrl?: string; // Base64 or local URL
  syncedAt?: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  autoSync: boolean;
}
