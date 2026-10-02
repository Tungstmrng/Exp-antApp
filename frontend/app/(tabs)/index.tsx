import React from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance, Transaction } from '../../context/FinanceContext';

export default function DashboardScreen() {
  const { transactions, clearTransactions } = useFinance();

  // Hitung total pengeluaran keseluruhan dari semua transaksi
  const totalExpense = transactions.reduce((sum, item) => sum + item.total_amount, 0);

  const handleClear = () => {
    Alert.alert(
      'Hapus Semua Data',
      'Apakah Anda yakin ingin menghapus seluruh riwayat transaksi?',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: () => clearTransactions() },
      ]
    );
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="receipt-outline" size={20} color="#2e7d32" style={{ marginRight: 8 }} />
          <Text style={styles.merchantText}>{item.merchant_name}</Text>
        </View>
        <Text style={styles.amountText}>Rp {item.total_amount?.toLocaleString('id-ID')}</Text>
      </View>
      <Text style={styles.dateText}>{new Date(item.date).toLocaleDateString('id-ID', { dateStyle: 'medium' })} • {item.items?.length || 0} item</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Kartu Ringkasan Total Pengeluaran */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Total Pengeluaran Keluarga</Text>
        <Text style={styles.summaryAmount}>Rp {totalExpense.toLocaleString('id-ID')}</Text>
        <Text style={styles.summarySubtitle}>{transactions.length} Struk Telah Tercatat</Text>
      </View>

      {/* Bagian Daftar Transaksi */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Riwayat Transaksi Terakhir</Text>
        {transactions.length > 0 && (
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearText}>Reset Data</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>Belum ada riwayat transaksi.</Text>
            <Text style={styles.emptySubtext}>Gunakan menu "Scan Struk" untuk mulai mencatat pengeluaran.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f6fa', padding: 16 },
  summaryCard: { backgroundColor: '#2e7d32', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 20, elevation: 3 },
  summaryTitle: { color: '#e8f5e9', fontSize: 14, fontWeight: '600' },
  summaryAmount: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginVertical: 6 },
  summarySubtitle: { color: '#c8e6c9', fontSize: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  clearText: { color: '#d32f2f', fontSize: 13, fontWeight: '600' },
  listContainer: { paddingBottom: 20 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  merchantText: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  amountText: { fontSize: 15, fontWeight: 'bold', color: '#2e7d32' },
  dateText: { fontSize: 12, color: '#777' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 15, fontWeight: 'bold', marginTop: 10 },
  emptySubtext: { color: '#999', fontSize: 12, textAlign: 'center', paddingHorizontal: 30, marginTop: 4 },
});