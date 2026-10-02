import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFinance } from '../../context/FinanceContext';

export default function AnalyticsScreen() {
  const { transactions } = useFinance();

  // Hitung pengeluaran per kategori berdasarkan item di setiap transaksi
  const categoryTotals: { [key: string]: number } = {};
  let totalOverall = 0;
  let totalSaved = 0;

  transactions.forEach((tx) => {
    tx.items?.forEach((item) => {
      const cat = item.category || 'Kebutuhan Umum';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + item.price;
      totalOverall += item.price;
      totalSaved += item.discount || 0;
    });
    tx.discounts?.forEach((d) => {
      totalSaved += d.amount;
    });
  });

  const categories = Object.keys(categoryTotals);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={40} color="#2e7d32" />
        <Text style={styles.title}>Analitik Pengeluaran</Text>
        <Text style={styles.subtitle}>Ringkasan kategori belanja keluarga berdasarkan hasil scan.</Text>
      </View>

      {totalSaved > 0 && (
        <View style={styles.savedCard}>
          <Ionicons name="pricetags-outline" size={20} color="#e65100" style={{ marginRight: 8 }} />
          <Text style={styles.savedText}>Total hemat dari diskon & voucher: Rp {totalSaved.toLocaleString('id-ID')}</Text>
        </View>
      )}

      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="pie-chart-outline" size={50} color="#ccc" />
          <Text style={styles.emptyText}>Belum ada data analitik.</Text>
          <Text style={styles.emptySubtext}>Lakukan scan struk belanja terlebih dahulu untuk melihat grafik kategori.</Text>
        </View>
      ) : (
        categories.map((cat, index) => {
          const amount = categoryTotals[cat];
          const percentage = totalOverall > 0 ? (amount / totalOverall) * 100 : 0;

          return (
            <View key={index} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.categoryName}>{cat}</Text>
                <Text style={styles.categoryAmount}>Rp {amount.toLocaleString('id-ID')}</Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` as `${number}%` }]} />
              </View>
              <Text style={styles.percentageText}>{percentage.toFixed(1)}% dari total pengeluaran</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f5f6fa', flexGrow: 1 },
  header: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 6 },
  subtitle: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 20, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryName: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  categoryAmount: { fontSize: 14, fontWeight: 'bold', color: '#2e7d32' },
  progressBarContainer: { height: 8, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: '#2e7d32', borderRadius: 4 },
  percentageText: { fontSize: 11, color: '#777', textAlign: 'right' },
  savedCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 12, padding: 12, marginBottom: 12 },
  savedText: { flex: 1, fontSize: 13, color: '#e65100', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#666', fontSize: 15, fontWeight: 'bold', marginTop: 10 },
  emptySubtext: { color: '#999', fontSize: 12, textAlign: 'center', paddingHorizontal: 30, marginTop: 4 },
});