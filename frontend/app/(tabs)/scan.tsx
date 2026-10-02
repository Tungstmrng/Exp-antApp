import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFinance } from '../../context/FinanceContext';
import { CATEGORIES, DEFAULT_CATEGORY } from '../../constants/Categories';

// Atur lewat file frontend/.env (lihat .env.example)
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.110.12:5000';

interface EditableItem {
  key: string;
  name: string;
  qty: number;
  unit_price: number;
  price: number; // harga akhir setelah diskon item
  discount: number;
  category: string;
  ocrPrice?: number; // harga asli terbaca OCR bila backend mengoreksinya otomatis
  suggestedPrice?: number; // saran koreksi harga yang tidak bisa dipastikan backend
}

interface EditableDiscount {
  key: string;
  name: string;
  amount: number;
}

let keyCounter = 0;
const newKey = () => `k${Date.now()}-${keyCounter++}`;
const toNumber = (value: string) => Number(value.replace(/[^0-9]/g, '')) || 0;
const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;

export default function ScanScreen() {
  const { addTransaction } = useFinance();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // State untuk data yang bisa diedit secara manual
  const [isScanned, setIsScanned] = useState<boolean>(false);
  const [merchantName, setMerchantName] = useState<string>('');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [discounts, setDiscounts] = useState<EditableDiscount[]>([]);
  const [receiptTotal, setReceiptTotal] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [categoryPickerKey, setCategoryPickerKey] = useState<string | null>(null);

  const itemsTotal = items.reduce((sum, item) => sum + item.price, 0);
  const itemDiscountTotal = items.reduce((sum, item) => sum + item.discount, 0);
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  const grandTotal = Math.max(0, itemsTotal - discountTotal);
  const totalMismatch = receiptTotal !== null && Math.abs(receiptTotal - grandTotal) > 1;

  // 1. Ambil foto via Kamera
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Izin Ditolak', 'Aplikasi memerlukan izin akses kamera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1, // kualitas penuh: kompresi ulang JPEG menambah salah baca OCR
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      processReceipt(result.assets[0].uri);
    }
  };

  // 2. Pilih gambar dari Galeri
  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1, // kualitas penuh: kompresi ulang JPEG menambah salah baca OCR
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      processReceipt(result.assets[0].uri);
    }
  };

  // 3. Kirim ke Backend Node.js untuk OCR
  const processReceipt = async (uri: string) => {
    setIsLoading(true);
    setIsScanned(false);

    try {
      const fetchResponse = await fetch(uri);
      const blob = await fetchResponse.blob();
      const filename = uri.split('/').pop() || 'receipt.jpg';

      const formData = new FormData();
      formData.append('receipt', blob as any, filename);

      const response = await fetch(`${BACKEND_URL}/api/scan`, {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();

      if (json.success) {
        const data = json.data;
        setMerchantName(data.merchant_name || '');
        const suggestionById = new Map<number, number>(
          (data.suggestions || []).map((sg: any) => [sg.item_id, sg.price])
        );
        setItems(
          (data.items || []).map((item: any) => ({
            key: newKey(),
            name: item.name,
            qty: item.qty || 1,
            unit_price: item.unit_price || item.price,
            price: item.price,
            discount: item.discount || 0,
            category: item.category || DEFAULT_CATEGORY,
            ocrPrice: item.ocr_price,
            suggestedPrice: suggestionById.get(item.id),
          }))
        );
        setDiscounts((data.discounts || []).map((d: any) => ({ key: newKey(), name: d.name, amount: d.amount })));
        setReceiptTotal(data.receipt_total ?? null);
        setWarnings(data.warnings || []);
        setCategoryPickerKey(null);
        setIsScanned(true);
      } else {
        Alert.alert('Gagal', json.message || 'Gagal memproses struk.');
      }
    } catch (error) {
      console.error('Error uploading receipt:', error);
      Alert.alert('Koneksi Gagal', `Pastikan backend menyala dan bisa diakses di ${BACKEND_URL}.`);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Edit item
  const updateItem = (key: string, changes: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  // Pakai saran harga; saran lain dihapus karena biasanya hanya satu yang benar.
  const applySuggestion = (key: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.key === key && item.suggestedPrice !== undefined
          ? { ...item, ocrPrice: item.price, price: item.suggestedPrice, suggestedPrice: undefined }
          : { ...item, suggestedPrice: undefined }
      )
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: newKey(), name: '', qty: 1, unit_price: 0, price: 0, discount: 0, category: DEFAULT_CATEGORY },
    ]);
  };

  const deleteItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  // 5. Edit diskon / voucher transaksi
  const updateDiscount = (key: string, changes: Partial<EditableDiscount>) => {
    setDiscounts((prev) => prev.map((d) => (d.key === key ? { ...d, ...changes } : d)));
  };

  const addDiscount = () => {
    setDiscounts((prev) => [...prev, { key: newKey(), name: 'Voucher', amount: 0 }]);
  };

  const deleteDiscount = (key: string) => {
    setDiscounts((prev) => prev.filter((d) => d.key !== key));
  };

  // 6. Simpan transaksi final setelah diverifikasi user
  const handleSaveTransaction = async () => {
    if (!merchantName.trim()) {
      Alert.alert('Peringatan', 'Nama toko/merchant tidak boleh kosong.');
      return;
    }

    if (items.length === 0) {
      Alert.alert('Peringatan', 'Minimal harus ada 1 item belanja.');
      return;
    }

    if (items.some((item) => !item.name.trim())) {
      Alert.alert('Peringatan', 'Nama barang tidak boleh kosong.');
      return;
    }

    await addTransaction({
      id: Date.now().toString(),
      merchant_name: merchantName.trim(),
      total_amount: grandTotal,
      items: items.map((item, index) => ({
        id: index + 1,
        name: item.name.trim(),
        price: item.price,
        category: item.category,
        qty: item.qty,
        discount: item.discount,
      })),
      discounts: discounts
        .filter((d) => d.amount > 0)
        .map((d) => ({ name: d.name.trim() || 'Diskon', amount: d.amount })),
      date: new Date().toISOString(),
    });

    Alert.alert('Berhasil!', 'Transaksi berhasil divalidasi dan disimpan ke Dashboard.');

    // Reset form
    setImageUri(null);
    setIsScanned(false);
    setMerchantName('');
    setItems([]);
    setDiscounts([]);
    setReceiptTotal(null);
    setWarnings([]);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerContainer}>
        <Ionicons name="scan-circle-outline" size={56} color="#2e7d32" />
        <Text style={styles.title}>Scan & Validasi Struk</Text>
        <Text style={styles.subtitle}>
          Foto struk, periksa hasil pembacaan OCR, lalu edit manual jika ada kesalahan sebelum disimpan.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Ionicons name="camera" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.buttonText}>Kamera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.galleryButton]} onPress={pickFromGallery}>
          <Ionicons name="images" size={20} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.buttonText}>Galeri</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <View style={styles.previewContainer}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={styles.loadingText}>Memproses OCR & Analisis Struk...</Text>
        </View>
      )}

      {isScanned && (
        <View style={styles.resultCard}>
          <Text style={styles.sectionHeaderTitle}>Validasi & Edit Data Struk</Text>

          {warnings.map((warning, index) => (
            <View key={index} style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color="#e65100" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}

          <Text style={styles.inputLabel}>Nama Toko / Merchant:</Text>
          <TextInput
            style={styles.merchantInput}
            value={merchantName}
            onChangeText={setMerchantName}
            placeholder="Masukkan nama toko"
          />

          <Text style={styles.inputLabel}>Daftar Item Belanja ({items.length}):</Text>

          {items.map((item) => (
            <View key={item.key} style={styles.itemCard}>
              <View style={styles.itemEditRow}>
                <View style={{ flex: 2, marginRight: 6 }}>
                  <TextInput
                    style={styles.itemNameInput}
                    value={item.name}
                    onChangeText={(val) => updateItem(item.key, { name: val })}
                    placeholder="Nama barang"
                  />
                </View>

                <View style={{ flex: 1.2, marginRight: 6 }}>
                  <TextInput
                    style={styles.itemPriceInput}
                    value={item.price.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) => updateItem(item.key, { price: toNumber(val), ocrPrice: undefined })}
                    placeholder="Harga"
                  />
                </View>

                <TouchableOpacity onPress={() => deleteItem(item.key)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={20} color="#d32f2f" />
                </TouchableOpacity>
              </View>

              <View style={styles.itemMetaRow}>
                <TouchableOpacity
                  style={styles.categoryBadge}
                  onPress={() => setCategoryPickerKey(categoryPickerKey === item.key ? null : item.key)}
                >
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  <Ionicons name="chevron-down" size={12} color="#2e7d32" style={{ marginLeft: 2 }} />
                </TouchableOpacity>

                <Text style={styles.itemMetaText}>
                  {item.qty > 1 ? `${item.qty} x ${rupiah(item.unit_price)}` : ''}
                  {item.qty > 1 && item.discount > 0 ? ' • ' : ''}
                  {item.discount > 0 ? `Diskon ${rupiah(item.discount)}` : ''}
                </Text>
              </View>

              {item.ocrPrice !== undefined && (
                <Text style={styles.ocrNoteText}>
                  Harga dikoreksi otomatis dari {rupiah(item.ocrPrice)} (terbaca OCR). Periksa kembali.
                </Text>
              )}

              {item.suggestedPrice !== undefined && (
                <TouchableOpacity style={styles.suggestionChip} onPress={() => applySuggestion(item.key)}>
                  <Ionicons name="bulb-outline" size={14} color="#e65100" style={{ marginRight: 4 }} />
                  <Text style={styles.suggestionText}>
                    Mungkin {rupiah(item.suggestedPrice)}? Ketuk untuk pakai
                  </Text>
                </TouchableOpacity>
              )}

              {categoryPickerKey === item.key && (
                <View style={styles.categoryPicker}>
                  {CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[styles.categoryOption, item.category === category && styles.categoryOptionActive]}
                      onPress={() => {
                        updateItem(item.key, { category });
                        setCategoryPickerKey(null);
                      }}
                    >
                      <Text
                        style={[styles.categoryOptionText, item.category === category && styles.categoryOptionTextActive]}
                      >
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addItem}>
            <Ionicons name="add-circle-outline" size={18} color="#2e7d32" style={{ marginRight: 4 }} />
            <Text style={styles.addButtonText}>Tambah Item</Text>
          </TouchableOpacity>

          {/* Diskon & Voucher level transaksi */}
          <Text style={styles.inputLabel}>Diskon / Voucher ({discounts.length}):</Text>

          {discounts.map((discount) => (
            <View key={discount.key} style={[styles.itemEditRow, styles.discountRow]}>
              <View style={{ flex: 2, marginRight: 6 }}>
                <TextInput
                  style={styles.itemNameInput}
                  value={discount.name}
                  onChangeText={(val) => updateDiscount(discount.key, { name: val })}
                  placeholder="Nama diskon / voucher"
                />
              </View>

              <View style={{ flex: 1.2, marginRight: 6 }}>
                <TextInput
                  style={[styles.itemPriceInput, { color: '#d32f2f' }]}
                  value={discount.amount.toString()}
                  keyboardType="numeric"
                  onChangeText={(val) => updateDiscount(discount.key, { amount: toNumber(val) })}
                  placeholder="Potongan"
                />
              </View>

              <TouchableOpacity onPress={() => deleteDiscount(discount.key)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#d32f2f" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addDiscount}>
            <Ionicons name="pricetag-outline" size={18} color="#2e7d32" style={{ marginRight: 4 }} />
            <Text style={styles.addButtonText}>Tambah Diskon / Voucher</Text>
          </TouchableOpacity>

          {/* Ringkasan Total */}
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal Item</Text>
              <Text style={styles.summaryValue}>{rupiah(itemsTotal)}</Text>
            </View>
            {itemDiscountTotal > 0 && (
              <Text style={styles.summaryNote}>Sudah termasuk diskon per item {rupiah(itemDiscountTotal)}</Text>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Diskon / Voucher</Text>
              <Text style={[styles.summaryValue, { color: '#d32f2f' }]}>- {rupiah(discountTotal)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Bayar:</Text>
              <Text style={styles.totalValue}>{rupiah(grandTotal)}</Text>
            </View>
            {receiptTotal !== null && (
              <Text style={[styles.receiptTotalText, totalMismatch && styles.receiptTotalMismatch]}>
                Total tertulis di struk: {rupiah(receiptTotal)}
                {totalMismatch ? ` (selisih ${rupiah(Math.abs(receiptTotal - grandTotal))})` : ' ✓ cocok'}
              </Text>
            )}
          </View>

          {/* Tombol Simpan */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.saveButtonText}>Simpan ke Pengeluaran</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#f5f6fa', flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginBottom: 16, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 6 },
  subtitle: { fontSize: 12, color: '#666', textAlign: 'center', paddingHorizontal: 16, marginTop: 4 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  actionButton: { flex: 1, backgroundColor: '#2e7d32', flexDirection: 'row', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  galleryButton: { backgroundColor: '#1976d2' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  previewContainer: { alignItems: 'center', marginBottom: 14 },
  previewImage: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#ddd' },
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 8, color: '#555', fontSize: 13 },
  resultCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2, marginBottom: 20 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 6 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3e0', borderRadius: 8, padding: 8, marginBottom: 8 },
  warningText: { flex: 1, fontSize: 12, color: '#e65100' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginBottom: 4, marginTop: 8 },
  merchantInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#fafafa', color: '#333' },
  itemCard: { backgroundColor: '#f9f9f9', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  itemEditRow: { flexDirection: 'row', alignItems: 'center' },
  discountRow: { backgroundColor: '#fff5f5', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#fde0e0' },
  itemNameInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, backgroundColor: '#fff', color: '#333' },
  itemPriceInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, backgroundColor: '#fff', color: '#333', textAlign: 'right' },
  deleteButton: { padding: 6, justifyContent: 'center', alignItems: 'center' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  itemMetaText: { fontSize: 11, color: '#777', flexShrink: 1, textAlign: 'right' },
  ocrNoteText: { fontSize: 11, color: '#e65100', marginTop: 4 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#fff3e0', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  suggestionText: { fontSize: 11, color: '#e65100', fontWeight: '600' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
  categoryBadgeText: { fontSize: 11, color: '#2e7d32', fontWeight: '600' },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  categoryOption: { borderWidth: 1, borderColor: '#c8e6c9', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6, backgroundColor: '#fff' },
  categoryOptionActive: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  categoryOptionText: { fontSize: 11, color: '#2e7d32' },
  categoryOptionTextActive: { color: '#fff', fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#a5d6a7', borderRadius: 8, padding: 8, marginBottom: 4 },
  addButtonText: { color: '#2e7d32', fontSize: 13, fontWeight: '600' },
  summaryBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryLabel: { fontSize: 13, color: '#555' },
  summaryValue: { fontSize: 13, color: '#333', fontWeight: '600' },
  summaryNote: { fontSize: 11, color: '#777', marginBottom: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#2e7d32' },
  receiptTotalText: { fontSize: 11, color: '#2e7d32', marginTop: 4, textAlign: 'right' },
  receiptTotalMismatch: { color: '#e65100' },
  saveButton: { backgroundColor: '#2e7d32', flexDirection: 'row', padding: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});
