import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../services/supabase";

export default function SettingsScreen() {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    // No need to manually route here! Our _layout.tsx listener will see the
    // logout event and automatically push us back to the login screen.
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings</Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F7FA",
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 40 },
  logoutBtn: {
    backgroundColor: "#F44336",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  logoutText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
