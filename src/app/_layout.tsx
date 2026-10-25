import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/constants/theme';
import { SessionProvider, useSession } from '@/auth/session-provider';

export default function RootLayout() {
  return <SessionProvider><RootNavigator /></SessionProvider>;
}

function RootNavigator() {
  const { colors } = useTheme();
  const { session } = useSession();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="register" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="citizen" options={{ headerShown: false }} />
          <Stack.Screen name="home" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Screen name="about" options={{ title: 'About SuriOS' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Page not found' }} />
      </Stack>
    </>
  );
}
