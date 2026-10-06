import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // <-- Tambahkan ini
import { Ionicons } from '@expo/vector-icons';
import { useFinance, Transaction } from '../../context/FinanceContext';

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function AnalyticsScreen() {
  const { transactions } = useFinance();

  const totalAllTime = transactions.reduce((sum, t) => sum + t.total_amount, 0);

  const categoryTotals: { [category: string]: number } = {};

  transactions.forEach((t: Transaction) => {
    t.items.forEach((item) => {
      const cat = item.category || 'Lainnya';
      const itemCost = item.price;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + itemCost;
    });
  });

  const sortedCategories = Object.keys(categoryTotals).sort(
    (a, b) => categoryTotals[b] - categoryTotals[a]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Ionicons name="bar-chart-outline" size={40} color="#FF7043" />
          <Text style={styles.title}>Exp-Ant Analytics</Text>
          <Text style={styles.subtitle}>Ringkasan persebaran pengeluaran berdasarkan kategori belanja.</Text>
        </View>

        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>Total Pengeluaran Analisis</Text>
          <Text style={styles.mainCardValue}>{rupiah(totalAllTime)}</Text>
          <Text style={styles.mainCardSub}>Dari total {transactions.length} struk tersimpan</Text>
        </View>

        <Text style={styles.sectionTitle}>Rincian Per Kategori</Text>

        {sortedCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="pie-chart-outline" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Belum ada data analitik.</Text>
            <Text style={styles.emptySubtext}>Scan dan simpan beberapa struk terlebih dahulu.</Text>
          </View>
        ) : (
          sortedCategories.map((cat) => {
            const amount = categoryTotals[cat];
            const percentage = totalAllTime > 0 ? (amount / totalAllTime) * 100 : 0;

            return (
              <View key={cat} style={styles.categoryCard}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{cat}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>{rupiah(amount)}</Text>
                </View>

                <View style={styles.progressBackground}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(percentage, 100)}%` }]} />
                </View>
                <Text style={styles.percentageText}>{percentage.toFixed(1)}% dari total pengeluaran</Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A1A' }, // <-- Tambahan style safeArea
  container: { padding: 16, flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F3F4F6', marginTop: 6 },
  subtitle: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 16, marginTop: 4 },
  mainCard: { backgroundColor: '#242424', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333333', alignItems: 'center' },
  mainCardLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  mainCardValue: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  mainCardSub: { fontSize: 11, color: '#6B7280' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F3F4F6', marginBottom: 12 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#D1D5DB', marginTop: 10 },
  emptySubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  categoryCard: { backgroundColor: '#242424', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#333333' },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { backgroundColor: '#1E2922', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#2B4233' },
  categoryBadgeText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
  categoryAmount: { fontSize: 14, fontWeight: 'bold', color: '#FF7043' },
  progressBackground: { height: 6, backgroundColor: '#333333', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressBarFill: { height: '100%', backgroundColor: '#FF7043', borderRadius: 3 },
  percentageText: { fontSize: 10, color: '#9CA3AF', textAlign: 'right' },
});