import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ExpenseItem {
  id: number;
  name: string;
  price: number; // harga akhir item (qty x harga satuan - diskon item)
  category: string;
  qty?: number;
  discount?: number; // diskon/potongan khusus item ini
}

// Potongan level transaksi, mis. voucher atau cashback.
export interface TransactionDiscount {
  name: string;
  amount: number;
}

export interface Transaction {
  id: string;
  merchant_name: string;
  total_amount: number; // jumlah harga item - total discounts
  items: ExpenseItem[];
  discounts?: TransactionDiscount[];
  date: string;
}

interface FinanceContextType {
  transactions: Transaction[];
  addTransaction: (newTransaction: Transaction) => Promise<void>;
  clearTransactions: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);
const STORAGE_KEY = '@family_expense_transactions';

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const storedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedData) {
        setTransactions(JSON.parse(storedData));
      }
    } catch (error) {
      console.error('Gagal memuat data transaksi lokal:', error);
    }
  };

  const addTransaction = async (newTransaction: Transaction) => {
    try {
      const updated = [newTransaction, ...transactions];
      setTransactions(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Gagal menyimpan transaksi:', error);
    }
  };

  const clearTransactions = async () => {
    try {
      setTransactions([]);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Gagal menghapus data:', error);
    }
  };

  return (
    <FinanceContext.Provider value={{ transactions, addTransaction, clearTransactions }}>
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