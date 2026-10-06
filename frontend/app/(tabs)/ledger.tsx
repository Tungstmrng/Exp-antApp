import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFinance, Transaction } from '../../context/FinanceContext';

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function LedgerScreen() {
  const { transactions, toggleSplitSharePaid } = useFinance();

  // Filter transaksi yang memiliki split shares
  const splitTransactions = transactions.filter((t) => t.splitShares && t.splitShares.length > 0);

  // Hitung total piutang yang belum dibayar
  let totalPendingDebt = 0;
  splitTransactions.forEach((t) => {
    t.splitShares?.forEach((share) => {
      if (!share.isPaid) {
        totalPendingDebt += share.amount;
      }
    });
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerContainer}>
          <Ionicons name="people-circle-outline" size={40} color="#FF7043" />
          <Text style={styles.title}>Rekap Split Bill</Text>
          <Text style={styles.subtitle}>Pantau teman yang belum lunasin tagihan!</Text>
        </View>

        {/* Kartu Ringkasan Total Piutang Belum Lunas */}
        <View style={styles.mainCard}>
          <Text style={styles.mainCardLabel}>Total Belum Dibayar Teman</Text>
          <Text style={styles.mainCardValue}>{rupiah(totalPendingDebt)}</Text>
          <Text style={styles.mainCardSub}>Dari {splitTransactions.length} riwayat split bill</Text>
        </View>

        <Text style={styles.sectionTitle}>Daftar Tagihan Per Transaksi</Text>

        {splitTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color="#6B7280" />
            <Text style={styles.emptyText}>Belum ada data rekap utang.</Text>
            <Text style={styles.emptySubtext}>Lakukan scan struk dan aktifkan Split Bill untuk mulai melacak.</Text>
          </View>
        ) : (
          splitTransactions.map((t: Transaction) => (
            <View key={t.id} style={styles.transactionCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.merchantName}>{t.merchant_name}</Text>
                <Text style={styles.transactionDate}>
                  {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </Text>
              </View>

              <View style={styles.sharesContainer}>
                {t.splitShares?.map((share) => (
                  <View key={share.name} style={styles.shareRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{share.name}</Text>
                      <Text style={styles.personAmount}>{rupiah(share.amount)}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.statusButton, share.isPaid ? styles.statusPaid : styles.statusUnpaid]}
                      onPress={() => toggleSplitSharePaid(t.id, share.name)}
                    >
                      <Ionicons
                        name={share.isPaid ? 'checkmark-circle' : 'time-outline'}
                        size={14}
                        color={share.isPaid ? '#4ADE80' : '#F59E0B'}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[styles.statusText, share.isPaid ? styles.statusTextPaid : styles.statusTextUnpaid]}>
                        {share.isPaid ? 'Lunas' : 'Belum Bayar'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#1A1A1A' },
  container: { padding: 16, flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F3F4F6', marginTop: 6 },
  subtitle: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 16, marginTop: 4 },
  
  mainCard: { backgroundColor: '#242424', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#333333', alignItems: 'center' },
  mainCardLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  mainCardValue: { fontSize: 24, fontWeight: 'bold', color: '#FF7043', marginBottom: 4 },
  mainCardSub: { fontSize: 11, color: '#6B7280' },

  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#F3F4F6', marginBottom: 12 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#D1D5DB', marginTop: 10 },
  emptySubtext: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  transactionCard: { backgroundColor: '#242424', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#333333' },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#333333', paddingBottom: 6 },
  merchantName: { fontSize: 14, fontWeight: 'bold', color: '#F3F4F6' },
  transactionDate: { fontSize: 11, color: '#9CA3AF' },
  
  sharesContainer: { marginTop: 4 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  personName: { fontSize: 13, fontWeight: '600', color: '#F3F4F6' },
  personAmount: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  statusButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  statusUnpaid: { backgroundColor: '#32261A', borderColor: '#4A351F' },
  statusPaid: { backgroundColor: '#1E2922', borderColor: '#2B4233' },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  statusTextUnpaid: { color: '#F59E0B' },
  statusTextPaid: { color: '#4ADE80' },
});