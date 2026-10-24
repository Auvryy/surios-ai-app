import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Screen } from '@/components/screen';
import { useTheme } from '@/constants/theme';
export default function NotFoundScreen() {
  const { colors } = useTheme();
  return <Screen><Text style={{ color: colors.text, fontSize: 24 }}>This page does not exist.</Text><Link href="/" style={{ color: colors.primary, paddingVertical: 16, fontSize: 16 }}>Return to SuriOS</Link></Screen>;
}
