import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "pp_theme_id";

export async function loadThemePreference(): Promise<string> {
  const v = await AsyncStorage.getItem(KEY);
  return v ?? "classic_dark";
}

export async function saveThemePreference(themeId: string): Promise<void> {
  await AsyncStorage.setItem(KEY, themeId);
}
