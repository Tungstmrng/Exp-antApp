import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF7043', // Warna aksen saat tab dipilih (Jingga Terakota)
        tabBarInactiveTintColor: '#9CA3AF', // Warna saat tab tidak aktif (Abu-abu)
        tabBarStyle: {
          backgroundColor: '#1A1A1A', // Warna latar belakang tab bar (Mode Gelap Arang)
          borderTopColor: '#333333',
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerStyle: {
          backgroundColor: '#1A1A1A',
        },
        headerTintColor: '#F3F4F6',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false, // Disembunyikan karena Dashboard sudah punya header sendiri
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan Struk',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analitik',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: 'Rekap Utang',
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}