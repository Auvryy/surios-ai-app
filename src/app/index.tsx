import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ONBOARDING_COMPLETE_KEY } from '@/constants/onboarding';
import { useTheme } from '@/constants/theme';
import { useSession } from '@/auth/session-provider';
import { SessionPanel } from '@/components/auth/session-panel';
type Destination = '/onboarding' | '/login';

export default function EntryScreen() {
  const [destination, setDestination] = useState<Destination | null>(null);
  const { colors } = useTheme();
  const { session, status } = useSession();

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)
      .then((completed) => {
        if (active) setDestination(completed === 'true' ? '/login' : '/onboarding');
      })
      .catch(() => {
        if (active) setDestination('/onboarding');
      });
    return () => { active = false; };
  }, []);

  if (status === 'loading' || status === 'unavailable') return <SessionPanel />;
  if (session) return <Redirect href="/citizen" />;
  if (destination) return <Redirect href={destination} />;
  return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} accessibilityLabel="Loading SuriOS" /></View>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
