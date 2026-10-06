import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TransactionItem {
  id: number;
  name: string;
  price: number;
  category: string;
  qty: number;
  discount: number;
}

export interface Transaction {
  id: string;
  merchant_name: string;
  total_amount: number;
  items: TransactionItem[];
  discounts?: { name: string; amount: number }[];
  date: string;
}

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  clearTransactions: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEY = '@smart_expense_transactions_v1';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // 1. Muat data tersimpan saat aplikasi pertama kali dibuka
  useEffect(() => {
    loadStoredTransactions();
  }, []);

  const loadStoredTransactions = async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedData) {
        setTransactions(JSON.parse(storedData));
      }
    } catch (error) {
      console.error('Gagal memuat data transaksi lokal:', error);
    }
  };

  // 2. Simpan transaksi baru dan perbarui AsyncStorage
  const addTransaction = async (newTransaction: Transaction) => {
    try {
      const updatedTransactions = [newTransaction, ...transactions];
      setTransactions(updatedTransactions);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTransactions));
    } catch (error) {
      console.error('Gagal menyimpan transaksi:', error);
    }
  };

  // 3. Hapus transaksi berdasarkan ID
  const deleteTransaction = async (id: string) => {
    try {
      const updatedTransactions = transactions.filter((t) => t.id !== id);
      setTransactions(updatedTransactions);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTransactions));
    } catch (error) {
      console.error('Gagal menghapus transaksi:', error);
    }
  };

  // 4. Bersihkan semua data (opsional untuk testing)
  const clearTransactions = async () => {
    try {
      setTransactions([]);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Gagal membersihkan data:', error);
    }
  };

  return (
    <FinanceContext.Provider value={{ transactions, addTransaction, deleteTransaction, clearTransactions }}>
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