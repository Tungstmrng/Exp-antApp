import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ActivityIndicator, Alert, ScrollView, TextInput, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFinance } from '../../context/FinanceContext';
import { CATEGORIES, DEFAULT_CATEGORY } from '../../constants/Categories';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  assignedTo: string[]; // Partisipan yang memikul item ini
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

  // State untuk Fitur Split Bill & WhatsApp Share
  const [isSplitBillActive, setIsSplitBillActive] = useState<boolean>(false);
  const [participants, setParticipants] = useState<string[]>(['Saya']);
  const [inputParticipant, setInputParticipant] = useState<string>('');

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
      quality: 1,
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
      quality: 1,
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
    setIsSplitBillActive(false);
    setParticipants(['Saya']);

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
        
        const initialParticipants = ['Saya'];
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
            assignedTo: initialParticipants,
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
      {
        key: newKey(),
        name: '',
        qty: 1,
        unit_price: 0,
        price: 0,
        discount: 0,
        category: DEFAULT_CATEGORY,
        assignedTo: participants,
      },
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

  // 6. Manajemen Partisipan Split Bill
  const addParticipant = () => {
    if (!inputParticipant.trim()) return;
    const trimmedName = inputParticipant.trim();
    if (participants.includes(trimmedName)) {
      Alert.alert('Peringatan', 'Nama partisipan sudah ada.');
      return;
    }
    const updatedParticipants = [...participants, trimmedName];
    setParticipants(updatedParticipants);
    setInputParticipant('');

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedTo: [...item.assignedTo, trimmedName],
      }))
    );
  };

  const removeParticipant = (name: string) => {
    if (participants.length <= 1) {
      Alert.alert('Peringatan', 'Minimal harus ada 1 partisipan.');
      return;
    }
    setParticipants(participants.filter((p) => p !== name));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignedTo: item.assignedTo.filter((p) => p !== name),
      }))
    );
  };

  const toggleItemParticipant = (itemKey: string, participantName: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== itemKey) return item;
        const exists = item.assignedTo.includes(participantName);
        let updatedAssigned: string[];

        if (exists) {
          if (item.assignedTo.length === 1) return item;
          updatedAssigned = item.assignedTo.filter((p) => p !== participantName);
        } else {
          updatedAssigned = [...item.assignedTo, participantName];
        }
        return { ...item, assignedTo: updatedAssigned };
      })
    );
  };

  // 7. Bagikan Split Bill ke WhatsApp
  const handleShareWhatsApp = async () => {
    if (items.length === 0) {
      Alert.alert('Peringatan', 'Belum ada item belanja untuk dibagikan.');
      return;
    }

    const calculationByPerson: { [key: string]: { subtotal: number; details: string[] } } = {};
    participants.forEach((p) => {
      calculationByPerson[p] = { subtotal: 0, details: [] };
    });

    items.forEach((item) => {
      const shareCount = item.assignedTo.length > 0 ? item.assignedTo.length : 1;
      const splitPrice = item.price / shareCount;

      item.assignedTo.forEach((p) => {
        if (calculationByPerson[p]) {
          calculationByPerson[p].subtotal += splitPrice;
          const shareText = shareCount > 1 ? ` (bagi ${shareCount})` : '';
          calculationByPerson[p].details.push(`   • ${item.name}${shareText}: ${rupiah(Math.round(splitPrice))}`);
        }
      });
    });

    const rawItemsTotal = itemsTotal > 0 ? itemsTotal : 1;

    let message = `🧾 *SPLIT BILL - ${merchantName.toUpperCase() || 'Belanja'}*\n`;
    message += `──────────────────────\n\n`;

    participants.forEach((p) => {
      const data = calculationByPerson[p];
      const proportion = data.subtotal / rawItemsTotal;
      const personDiscountShare = discountTotal * proportion;
      const finalPersonTotal = Math.max(0, data.subtotal - personDiscountShare);

      message += `👤 *${p}* (Total: *${rupiah(Math.round(finalPersonTotal))}*)\n`;
      
      if (personDiscountShare > 0) {
        message += `   Subtotal: ${rupiah(Math.round(data.subtotal))}\n`;
        message += `   Potongan Diskon/Voucher: -${rupiah(Math.round(personDiscountShare))}\n`;
      }

      data.details.forEach((d) => {
        message += `${d}\n`;
      });
      message += `\n`;
    });

    if (discountTotal > 0) {
      message += `Total Diskon/Voucher Toko: -${rupiah(discountTotal)}\n`;
    }

    message += `──────────────────────\n`;
    message += `💰 *Grand Total: ${rupiah(grandTotal)}*\n\n`;
    message += `_Dikirim via Smart Expense Tracker_`;

    try {
      await Share.share({ message });
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  // 8. Simpan transaksi final setelah diverifikasi user
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

    // Hitung rincian split shares jika split bill aktif
    let splitSharesData: { name: string; amount: number; isPaid: boolean }[] = [];
    if (isSplitBillActive) {
      const rawItemsTotal = itemsTotal > 0 ? itemsTotal : 1;
      const calculationByPerson: { [key: string]: number } = {};
      participants.forEach((p) => {
        calculationByPerson[p] = 0;
      });

      items.forEach((item) => {
        const shareCount = item.assignedTo.length > 0 ? item.assignedTo.length : 1;
        const splitPrice = item.price / shareCount;
        item.assignedTo.forEach((p) => {
          if (calculationByPerson[p] !== undefined) {
            calculationByPerson[p] += splitPrice;
          }
        });
      });

      participants.forEach((p) => {
        // Rekap utang khusus untuk teman (selain "Saya")
        if (p !== 'Saya') {
          const subtotal = calculationByPerson[p] || 0;
          const proportion = subtotal / rawItemsTotal;
          const personDiscountShare = discountTotal * proportion;
          const finalAmount = Math.max(0, subtotal - personDiscountShare);

          if (finalAmount > 0) {
            splitSharesData.push({
              name: p,
              amount: Math.round(finalAmount),
              isPaid: false, // Default belum bayar
            });
          }
        }
      });
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
      splitShares: splitSharesData.length > 0 ? splitSharesData : undefined,
    });

    Alert.alert('Berhasil!', 'Transaksi dan rekap split bill berhasil disimpan.');

    setImageUri(null);
    setIsScanned(false);
    setMerchantName('');
    setItems([]);
    setDiscounts([]);
    setReceiptTotal(null);
    setWarnings([]);
    setIsSplitBillActive(false);
    setParticipants(['Saya']);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"><View style={styles.headerContainer}>
        <Ionicons name="scan-circle-outline" size={56} color="#FF7043" />
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
          <ActivityIndicator size="large" color="#FF7043" />
          <Text style={styles.loadingText}>Memproses OCR & Analisis Struk...</Text>
        </View>
      )}

      {isScanned && (
        <View style={styles.resultCard}>
          <Text style={styles.sectionHeaderTitle}>Validasi & Edit Data Struk</Text>

          {warnings.map((warning, index) => (
            <View key={index} style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}

          <Text style={styles.inputLabel}>Nama Toko / Merchant:</Text>
          <TextInput
            style={styles.merchantInput}
            value={merchantName}
            onChangeText={setMerchantName}
            placeholder="Masukkan nama toko"
            placeholderTextColor="#6B7280"
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
                    placeholderTextColor="#6B7280"
                  />
                </View>

                <View style={{ flex: 1.2, marginRight: 6 }}>
                  <TextInput
                    style={styles.itemPriceInput}
                    value={item.price.toString()}
                    keyboardType="numeric"
                    onChangeText={(val) => updateItem(item.key, { price: toNumber(val), ocrPrice: undefined })}
                    placeholder="Harga"
                    placeholderTextColor="#6B7280"
                  />
                </View>

                <TouchableOpacity onPress={() => deleteItem(item.key)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={20} color="#FF7043" />
                </TouchableOpacity>
              </View>

              <View style={styles.itemMetaRow}>
                <TouchableOpacity
                  style={styles.categoryBadge}
                  onPress={() => setCategoryPickerKey(categoryPickerKey === item.key ? null : item.key)}
                >
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                  <Ionicons name="chevron-down" size={12} color="#FF7043" style={{ marginLeft: 2 }} />
                </TouchableOpacity>

                <Text style={styles.itemMetaText}>
                  {item.qty > 1 ? `${item.qty} x ${rupiah(item.unit_price)}` : ''}
                  {item.qty > 1 && item.discount > 0 ? ' • ' : ''}
                  {item.discount > 0 ? `Diskon ${rupiah(item.discount)}` : ''}
                </Text>
              </View>

              {isSplitBillActive && (
                <View style={styles.itemParticipantRow}>
                  <Text style={styles.itemParticipantLabel}>Ditanggung:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                    {participants.map((p) => {
                      const isSelected = item.assignedTo.includes(p);
                      return (
                        <TouchableOpacity
                          key={p}
                          style={[styles.personChip, isSelected && styles.personChipActive]}
                          onPress={() => toggleItemParticipant(item.key, p)}
                        >
                          <Text style={[styles.personChipText, isSelected && styles.personChipTextActive]}>
                            {p} {item.assignedTo.length > 1 && isSelected ? `(1/${item.assignedTo.length})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {item.ocrPrice !== undefined && (
                <Text style={styles.ocrNoteText}>
                  Harga dikoreksi otomatis dari {rupiah(item.ocrPrice)} (terbaca OCR). Periksa kembali.
                </Text>
              )}

              {item.suggestedPrice !== undefined && (
                <TouchableOpacity style={styles.suggestionChip} onPress={() => applySuggestion(item.key)}>
                  <Ionicons name="bulb-outline" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
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
            <Ionicons name="add-circle-outline" size={18} color="#FF7043" style={{ marginRight: 4 }} />
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
                  placeholderTextColor="#6B7280"
                />
              </View>

              <View style={{ flex: 1.2, marginRight: 6 }}>
                <TextInput
                  style={[styles.itemPriceInput, { color: '#FF7043' }]}
                  value={discount.amount.toString()}
                  keyboardType="numeric"
                  onChangeText={(val) => updateDiscount(discount.key, { amount: toNumber(val) })}
                  placeholder="Potongan"
                  placeholderTextColor="#6B7280"
                />
              </View>

              <TouchableOpacity onPress={() => deleteDiscount(discount.key)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={20} color="#FF7043" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addDiscount}>
            <Ionicons name="pricetag-outline" size={18} color="#FF7043" style={{ marginRight: 4 }} />
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
              <Text style={[styles.summaryValue, { color: '#FF7043' }]}>- {rupiah(discountTotal)}</Text>
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

          {/* TOMBOL TOGGLE SPLIT BILL */}
          <TouchableOpacity
            style={[styles.toggleSplitButton, isSplitBillActive && styles.toggleSplitButtonActive]}
            onPress={() => setIsSplitBillActive(!isSplitBillActive)}
          >
            <Ionicons
              name={isSplitBillActive ? 'people' : 'people-outline'}
              size={18}
              color={isSplitBillActive ? '#fff' : '#FF7043'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.toggleSplitButtonText, isSplitBillActive && styles.toggleSplitButtonTextActive]}>
              {isSplitBillActive ? 'Tutup Fitur Split Bill' : 'Aktifkan Split Bill (Bagi Tagihan)'}
            </Text>
          </TouchableOpacity>

          {/* BAGIAN SPLIT BILL */}
          {isSplitBillActive && (
            <View style={styles.splitBillContainer}>
              <Text style={styles.inputLabel}>Partisipan Split Bill ({participants.length}):</Text>

              <View style={styles.participantInputRow}>
                <TextInput
                  style={[styles.merchantInput, { flex: 1, marginRight: 8, marginTop: 0 }]}
                  value={inputParticipant}
                  onChangeText={setInputParticipant}
                  placeholder="Nama teman (cth: Budi)"
                  placeholderTextColor="#6B7280"
                />
                <TouchableOpacity style={styles.addParticipantButton} onPress={addParticipant}>
                  <Text style={styles.addParticipantButtonText}>Tambah</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.participantChipsContainer}>
                {participants.map((p) => (
                  <View key={p} style={styles.participantChip}>
                    <Text style={styles.participantChipText}>{p}</Text>
                    {participants.length > 1 && (
                      <TouchableOpacity onPress={() => removeParticipant(p)} style={{ marginLeft: 6 }}>
                        <Ionicons name="close-circle" size={14} color="#FF7043" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.whatsappButton} onPress={handleShareWhatsApp}>
                <Ionicons name="logo-whatsapp" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.whatsappButtonText}>Bagikan Split Bill ke WhatsApp</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Tombol Simpan */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSaveTransaction}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.saveButtonText}>Simpan ke Pengeluaran</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#1A1A1A', flexGrow: 1 },
  headerContainer: { alignItems: 'center', marginBottom: 16, marginTop: 10 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F3F4F6', marginTop: 6 },
  subtitle: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingHorizontal: 16, marginTop: 4 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  actionButton: { flex: 1, backgroundColor: '#FF7043', flexDirection: 'row', padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 4 },
  galleryButton: { backgroundColor: '#3B82F6' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  previewContainer: { alignItems: 'center', marginBottom: 14 },
  previewImage: { width: '100%', height: 160, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#2A2A2A' },
  loadingContainer: { alignItems: 'center', marginVertical: 20 },
  loadingText: { marginTop: 8, color: '#9CA3AF', fontSize: 13 },
  resultCard: { backgroundColor: '#242424', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333333', marginBottom: 20 },
  sectionHeaderTitle: { fontSize: 16, fontWeight: 'bold', color: '#FF7043', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#333333', paddingBottom: 6 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#32261A', borderRadius: 8, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: '#4A351F' },
  warningText: { flex: 1, fontSize: 12, color: '#F59E0B' },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 4, marginTop: 8 },
  merchantInput: { borderWidth: 1, borderColor: '#3D3D3D', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, backgroundColor: '#1F1F1F', color: '#F3F4F6' },
  itemCard: { backgroundColor: '#1F1F1F', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#333333' },
  itemEditRow: { flexDirection: 'row', alignItems: 'center' },
  discountRow: { backgroundColor: '#2A1F1F', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#422828' },
  itemNameInput: { borderWidth: 1, borderColor: '#3D3D3D', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 13, backgroundColor: '#242424', color: '#F3F4F6' },
  itemPriceInput: { borderWidth: 1, borderColor: '#3D3D3D', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, backgroundColor: '#242424', color: '#F3F4F6', textAlign: 'right' },
  deleteButton: { padding: 6, justifyContent: 'center', alignItems: 'center' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  itemMetaText: { fontSize: 11, color: '#9CA3AF', flexShrink: 1, textAlign: 'right' },
  ocrNoteText: { fontSize: 11, color: '#F59E0B', marginTop: 4 },
  suggestionChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#32261A', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6, borderWidth: 1, borderColor: '#4A351F' },
  suggestionText: { fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2922', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, borderWidth: 1, borderColor: '#2B4233' },
  categoryBadgeText: { fontSize: 11, color: '#4ADE80', fontWeight: '600' },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  categoryOption: { borderWidth: 1, borderColor: '#2B4233', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 6, marginBottom: 6, backgroundColor: '#1F1F1F' },
  categoryOptionActive: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  categoryOptionText: { fontSize: 11, color: '#4ADE80' },
  categoryOptionTextActive: { color: '#fff', fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: '#4B5563', borderRadius: 8, padding: 8, marginBottom: 4, backgroundColor: '#1F1F1F' },
  addButtonText: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
  summaryBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#333333', paddingTop: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  summaryLabel: { fontSize: 13, color: '#9CA3AF' },
  summaryValue: { fontSize: 13, color: '#F3F4F6', fontWeight: '600' },
  summaryNote: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, borderTopWidth: 1, borderTopColor: '#333333', paddingTop: 8 },
  totalLabel: { fontSize: 14, fontWeight: 'bold', color: '#F3F4F6' },
  totalValue: { fontSize: 16, fontWeight: 'bold', color: '#FF7043' },
  receiptTotalText: { fontSize: 11, color: '#4ADE80', marginTop: 4, textAlign: 'right' },
  receiptTotalMismatch: { color: '#F59E0B' },
  safeArea: { flex: 1, backgroundColor: '#1A1A1A' },
  
  // Style Split Bill & Toggle dalam mode Night Ant
  toggleSplitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FF7043',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    backgroundColor: '#1F1F1F',
  },
  toggleSplitButtonActive: {
    backgroundColor: '#FF7043',
  },
  toggleSplitButtonText: {
    color: '#FF7043',
    fontWeight: 'bold',
    fontSize: 13,
  },
  toggleSplitButtonTextActive: {
    color: '#fff',
  },
  splitBillContainer: {
    marginTop: 12,
    backgroundColor: '#1F1F1F',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  participantInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  addParticipantButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addParticipantButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  participantChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  participantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3A8A',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  participantChipText: {
    fontSize: 12,
    color: '#93C5FD',
    fontWeight: '500',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  itemParticipantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 6,
  },
  itemParticipantLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginRight: 6,
    fontWeight: '600',
  },
  personChip: {
    backgroundColor: '#333333',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 4,
  },
  personChipActive: {
    backgroundColor: '#FF7043',
  },
  personChipText: {
    fontSize: 10,
    color: '#D1D5DB',
  },
  personChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButton: { backgroundColor: '#FF7043', flexDirection: 'row', padding: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});