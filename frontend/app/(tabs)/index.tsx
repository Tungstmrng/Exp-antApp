import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance, Transaction } from '../../context/FinanceContext';
import { useRouter } from 'expo-router';

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function DashboardScreen() {
  const { transactions, deleteTransaction } = useFinance();
  const router = useRouter();

  // Hitung total pengeluaran keseluruhan
  const totalAllTime = transactions.reduce((sum, t) => sum + t.total_amount, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Header dengan Nama Exp-Ant & Tombol Tambahan */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Selamat Datang</Text>
            <Text style={styles.appName}>Exp-Ant</Text>
          </View>
          
          {/* Tombol Tambahan di Kanan Atas */}
          <View style={styles.headerRightButtons}>
            <TouchableOpacity style={styles.iconButton} onPress={() => alert('Fitur Notifikasi')}>
              <Ionicons name="notifications-outline" size={18} color="#F3F4F6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Kartu Ringkasan Keuangan */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Pengeluaran Tercatat</Text>
          <Text style={styles.summaryValue}>{rupiah(totalAllTime)}</Text>
          <Text style={styles.summarySubtext}>Terakumulasi dari {transactions.length} struk/transaksi</Text>
        </View>

        {/* Tombol Aksi Cepat */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.primaryActionButton}
            onPress={() => router.push('/scan')}
          >
            <Ionicons name="scan-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.primaryActionText}>Scan Struk Baru</Text>
          </TouchableOpacity>
        </View>

        {/* Daftar Riwayat Transaksi */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Riwayat Belanja</Text>
          <Text style={styles.sectionCount}>{transactions.length} Transaksi</Text>
        </View>

        {transactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
            <Text style={styles.emptySubtext}>Ayo scan struk pertama Anda hari ini!</Text>
          </View>
        ) : (
          transactions.map((item: Transaction) => (
            <View key={item.id} style={styles.transactionCard}>
              <View style={styles.transactionInfo}>
                <Text style={styles.merchantName}>{item.merchant_name}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(item.date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })} • {item.items.length} Item
                </Text>
              </View>
              <View style={styles.transactionRight}>
                <Text style={styles.transactionAmount}>{rupiah(item.total_amount)}</Text>
                <TouchableOpacity 
                  onPress={() => deleteTransaction(item.id)}
                  style={styles.deleteIcon}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF7043" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#1A1A1A' 
  },
  container: { 
    padding: 16, 
    flexGrow: 1 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16, 
    marginTop: 8 
  },
  greeting: { 
    fontSize: 13, 
    color: '#9CA3AF', 
    fontWeight: '600' 
  },
  appName: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    color: '#F3F4F6' 
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: { 
    backgroundColor: '#2A2A2A', 
    padding: 10, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: '#333333',
    marginLeft: 8 
  },
  summaryCard: { 
    backgroundColor: '#242424', 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: '#333333' 
  },
  summaryLabel: { 
    fontSize: 13, 
    color: '#9CA3AF', 
    marginBottom: 4 
  },
  summaryValue: { 
    fontSize: 26, 
    fontWeight: 'bold', 
    color: '#FFFFFF', 
    marginBottom: 6 
  },
  summarySubtext: { 
    fontSize: 11, 
    color: '#6B7280' 
  },
  actionRow: { 
    flexDirection: 'row', 
    marginBottom: 20 
  },
  primaryActionButton: { 
    flex: 1, 
    backgroundColor: '#FF7043', 
    flexDirection: 'row', 
    padding: 14, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 2 
  },
  primaryActionText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 14 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  sectionTitle: { 
    fontSize: 15, 
    fontWeight: 'bold', 
    color: '#F3F4F6' 
  },
  sectionCount: { 
    fontSize: 12, 
    color: '#9CA3AF' 
  },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40 
  },
  emptyText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#D1D5DB', 
    marginTop: 10 
  },
  emptySubtext: { 
    fontSize: 12, 
    color: '#9CA3AF', 
    marginTop: 4 
  },
  transactionCard: { 
    backgroundColor: '#242424', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 10, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#333333' 
  },
  transactionInfo: { 
    flex: 1 
  },
  merchantName: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#F3F4F6', 
    marginBottom: 2 
  },
  transactionDate: { 
    fontSize: 11, 
    color: '#9CA3AF' 
  },
  transactionRight: { 
    alignItems: 'flex-end' 
  },
  transactionAmount: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#FF7043', 
    marginBottom: 6 
  },
  deleteIcon: { 
    padding: 4 
  },
});