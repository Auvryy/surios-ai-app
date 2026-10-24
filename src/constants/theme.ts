import { useColorScheme } from 'react-native';

const light = {
  background: '#FAFAFA', surface: '#FFFFFF', text: '#18181B', muted: '#62626B',
  border: '#DEDEE3', primary: '#C93D00', onPrimary: '#FFFFFF', accent: '#FFF0E8',
};
const dark = {
  background: '#111113', surface: '#1C1C20', text: '#FAFAFA', muted: '#B5B5BF',
  border: '#414148', primary: '#FF9A66', onPrimary: '#211008', accent: '#392318',
};
export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
