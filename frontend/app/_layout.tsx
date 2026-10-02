import { Stack } from 'expo-router';
import { FinanceProvider } from '../context/FinanceContext';

export default function RootLayout() {
  return (
    <FinanceProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </FinanceProvider>
  );
}