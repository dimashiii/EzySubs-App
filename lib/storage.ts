import AsyncStorage from "@react-native-async-storage/async-storage";

// Save any JSON data
export async function saveJSON(key: string, value: any) {
  try {
    const json = JSON.stringify(value);
    await AsyncStorage.setItem(key, json);
  } catch (e) {
    console.error("Error saving to storage", e);
  }
}

// Load JSON data (with optional default)
export async function loadJSON<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value != null ? JSON.parse(value) : defaultValue;
  } catch (e) {
    console.error("Error loading from storage", e);
    return defaultValue;
  }
}

// Remove data
export async function removeJSON(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.error("Error removing from storage", e);
  }
}
