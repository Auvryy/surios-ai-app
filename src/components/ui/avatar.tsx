import { useState } from "react";
import { Image, Text, View } from "react-native";
import { useTheme } from "@/constants/theme";

export function Avatar({ name, uri, size = 44 }: { name: string; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return (
    <View accessibilityRole="image" accessibilityLabel={`${name}'s profile picture`}
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: colors.accent }}>
      {uri && failed !== uri ? (
        <Image accessible={false} source={{ uri }} resizeMode="cover" onError={() => setFailed(uri)} style={{ width: size, height: size }} />
      ) : <Text accessible={false} style={{ color: colors.primary, fontWeight: "600", fontSize: size * 0.32 }}>{initials}</Text>}
    </View>
  );
}
