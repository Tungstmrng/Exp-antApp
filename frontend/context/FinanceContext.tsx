import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SQLite from 'expo-sqlite';

export interface TransactionItem {
  id: number;
  name: string;
  price: number;
  category: string;
  qty: number;
  discount: number;
}

export interface SplitShare {
  name: string;
  amount: number;
  isPaid: boolean;
}

export interface Transaction {
  id: string;
  merchant_name: string;
  total_amount: number;
  items: TransactionItem[];
  discounts?: { name: string; amount: number }[];
  date: string;
  splitShares?: SplitShare[];
}

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  toggleSplitSharePaid: (transactionId: string, participantName: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

// Buka koneksi database SQLite secara sinkron (Standar Expo SQLite modern)
const db = SQLite.openDatabaseSync('expant_finance.db');

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    initDatabase();
  }, []);

  // 1. Inisialisasi Tabel SQLite
  const initDatabase = async () => {
    try {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY NOT NULL,
          merchant_name TEXT NOT NULL,
          total_amount REAL NOT NULL,
          date TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS items (
          id INTEGER,
          transaction_id TEXT NOT NULL,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          category TEXT NOT NULL,
          qty INTEGER NOT NULL,
          discount REAL NOT NULL,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS split_shares (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id TEXT NOT NULL,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          is_paid INTEGER NOT NULL,
          FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE
        );
      `);
      loadTransactionsFromDB();
    } catch (error) {
      console.error('Gagal menginisialisasi database SQLite:', error);
    }
  };

  // 2. Muat Semua Transaksi dari SQLite
  const loadTransactionsFromDB = async () => {
    try {
      const txRows: any[] = await db.getAllAsync('SELECT * FROM transactions ORDER BY date DESC;');
      console.log('📥 [SQLITE LOAD] Berhasil membaca data transaksi dari database. Jumlah data:', txRows.length);
      console.log('📋 Isi data transaksi:', txRows);
      const loadedTransactions: Transaction[] = [];

      for (const tx of txRows) {
        // Ambil item terkait
        const itemsRows: any[] = await db.getAllAsync('SELECT * FROM items WHERE transaction_id = ?;', [tx.id]);
        
        // Ambil split shares terkait
        const splitRows: any[] = await db.getAllAsync('SELECT * FROM split_shares WHERE transaction_id = ?;', [tx.id]);

        loadedTransactions.push({
          id: tx.id,
          merchant_name: tx.merchant_name,
          total_amount: tx.total_amount,
          date: tx.date,
          items: itemsRows.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            category: i.category,
            qty: i.qty,
            discount: i.discount,
          })),
          splitShares: splitRows.length > 0 ? splitRows.map((s) => ({
            name: s.name,
            amount: s.amount,
            isPaid: s.is_paid === 1,
          })) : undefined,
        });
      }

      setTransactions(loadedTransactions);
    } catch (error) {
      console.error('Gagal memuat data dari database:', error);
    }
  };

  // 3. Tambah Transaksi ke SQLite
  const addTransaction = async (newTransaction: Transaction) => {
    try {
      await db.runAsync(
        'INSERT INTO transactions (id, merchant_name, total_amount, date) VALUES (?, ?, ?, ?);',
        [newTransaction.id, newTransaction.merchant_name, newTransaction.total_amount, newTransaction.date]
      );

      for (const item of newTransaction.items) {
        await db.runAsync(
          'INSERT INTO items (id, transaction_id, name, price, category, qty, discount) VALUES (?, ?, ?, ?, ?, ?, ?);',
          [item.id, newTransaction.id, item.name, item.price, item.category, item.qty, item.discount]
        );
      }

      if (newTransaction.splitShares) {
        for (const share of newTransaction.splitShares) {
          await db.runAsync(
            'INSERT INTO split_shares (transaction_id, name, amount, is_paid) VALUES (?, ?, ?, ?);',
            [newTransaction.id, share.name, share.amount, share.isPaid ? 1 : 0]
          );
        }
      }

      // Perbarui state lokal
      console.log('✅ [SQLITE SUCCESS] Transaksi baru berhasil disimpan:', newTransaction.merchant_name, 'Total:', newTransaction.total_amount);
      setTransactions((prev) => [newTransaction, ...prev]);
    } catch (error) {
      console.error('Gagal menyimpan transaksi ke SQLite:', error);
    }
  };

  // 4. Hapus Transaksi
  const deleteTransaction = async (id: string) => {
    try {
      await db.runAsync('DELETE FROM transactions WHERE id = ?;', [id]);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (error) {
      console.error('Gagal menghapus transaksi dari SQLite:', error);
    }
  };

  // 5. Ubah Status Lunas / Belum Lunas pada Rekap Utang
  const toggleSplitSharePaid = async (transactionId: string, participantName: string) => {
    try {
      // Cari status saat ini di state
      const targetTx = transactions.find((t) => t.id === transactionId);
      if (!targetTx || !targetTx.splitShares) return;

      const targetShare = targetTx.splitShares.find((s) => s.name === participantName);
      if (!targetShare) return;

      const newIsPaidVal = !targetShare.isPaid;

      // Update di SQLite
      await db.runAsync(
        'UPDATE split_shares SET is_paid = ? WHERE transaction_id = ? AND name = ?;',
        [newIsPaidVal ? 1 : 0, transactionId, participantName]
      );

      // Perbarui state lokal
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.id !== transactionId || !t.splitShares) return t;
          return {
            ...t,
            splitShares: t.splitShares.map((s) =>
              s.name === participantName ? { ...s, isPaid: newIsPaidVal } : s
            ),
          };
        })
      );
    } catch (error) {
      console.error('Gagal mengubah status lunas di SQLite:', error);
    }
  };

  // 6. Reset Seluruh Database (Opsional)
  const clearTransactions = async () => {
    try {
      await db.execAsync(`
        DELETE FROM items;
        DELETE FROM split_shares;
        DELETE FROM transactions;
      `);
      setTransactions([]);
    } catch (error) {
      console.error('Gagal membersihkan database:', error);
    }
  };

  return (
    <FinanceContext.Provider value={{ transactions, addTransaction, deleteTransaction, toggleSplitSharePaid, clearTransactions }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance harus digunakan di dalam FinanceProvider');
  }
  return context;
};