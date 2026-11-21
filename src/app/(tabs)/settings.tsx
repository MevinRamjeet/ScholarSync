import { Ionicons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";

export default function SettingsScreen() {
  const router = useRouter();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // User account state
  const [email, setEmail] = useState<string>("");
  const [memberSince, setMemberSince] = useState<string>("");
  const [completedTasksCount, setCompletedTasksCount] = useState<number>(0);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);

  // Permission & action states
  const [notifGranted, setNotifGranted] = useState<boolean>(false);
  const [clearingTasks, setClearingTasks] = useState<boolean>(false);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  // Change password modal state
  const [passwordModalVisible, setPasswordModalVisible] =
    useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [updatingPassword, setUpdatingPassword] = useState<boolean>(false);

  const loadSettingsData = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) return;

      setEmail(user.email || "Student Account");

      if (user.created_at) {
        const formattedDate = new Date(user.created_at).toLocaleDateString(
          undefined,
          { year: "numeric", month: "short", day: "numeric" },
        );
        setMemberSince(formattedDate);
      }

      // Count completed ('done') tasks for the cleanup option
      const { count } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "done");

      setCompletedTasksCount(typeof count === "number" ? count : 0);

      // Check notification permission status
      const { status } = await Notifications.getPermissionsAsync();
      setNotifGranted(status === "granted");
    } catch {
      // Fail silently on background refresh
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettingsData();
    }, [loadSettingsData]),
  );

  const handleNotificationPermission = async () => {
    if (notifGranted) {
      Linking.openSettings();
      return;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status === "granted") {
      setNotifGranted(true);
    } else {
      Alert.alert(
        "Notifications Disabled",
        "Enable notifications in your device settings to receive Focus Timer alerts.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleCameraPermission = async () => {
    if (cameraPermission?.granted) {
      Linking.openSettings();
      return;
    }
    const result = await requestCameraPermission();
    if (!result.granted) {
      Alert.alert(
        "Camera Disabled",
        "Enable camera access in your device settings to scan lecture notes.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ],
      );
    }
  };

  const handleClearCompletedTasks = () => {
    if (completedTasksCount === 0) {
      Alert.alert("Nothing to Clear", "You have no completed tasks to remove.");
      return;
    }

    Alert.alert(
      "Clear Completed Tasks",
      `Delete all ${completedTasksCount} completed ${
        completedTasksCount === 1 ? "task" : "tasks"
      }? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete All",
          style: "destructive",
          onPress: async () => {
            setClearingTasks(true);
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              if (!user) return;

              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("user_id", user.id)
                .eq("status", "done");

              if (error) throw error;
              setCompletedTasksCount(0);
              Alert.alert("Cleared", "All completed tasks have been removed.");
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.message || "Could not clear completed tasks.",
              );
            } finally {
              setClearingTasks(false);
            }
          },
        },
      ],
    );
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert(
        "Weak Password",
        "New password must be at least 6 characters long.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordModalVisible(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password Updated", "Your password has been changed.");
    } catch (error: any) {
      Alert.alert(
        "Update Failed",
        error.message || "Could not update password.",
      );
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of ScholarSync?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setSigningOut(true);
            try {
              const { error } = await supabase.auth.signOut();
              if (error) throw error;
              router.replace("/(auth)/login");
            } catch (error: any) {
              Alert.alert(
                "Sign Out Failed",
                error.message || "Could not sign out.",
              );
              setSigningOut(false);
            }
          },
        },
      ],
    );
  };

  const avatarInitial = email ? email.charAt(0).toUpperCase() : "S";

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.screenTitle}>Settings</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <View style={styles.profileInfo}>
            {loadingProfile ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <>
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {email}
                </Text>
                <Text style={styles.profileMeta}>
                  {memberSince
                    ? `Member since ${memberSince}`
                    : "Student Account"}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Account Section */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.rowIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="key-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Change Password</Text>
              <Text style={styles.rowSubtitle}>
                Update your login credentials
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Permissions & Device Section */}
        <Text style={styles.sectionLabel}>PERMISSIONS & DEVICE</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={[styles.rowItem, styles.rowBorder]}
            onPress={handleCameraPermission}
            activeOpacity={0.75}
          >
            <View style={[styles.rowIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="camera-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Camera Access</Text>
              <Text style={styles.rowSubtitle}>
                Required for scanning lecture notes
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: cameraPermission?.granted
                    ? "#DCFCE7"
                    : "#FEF3C7",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  {
                    color: cameraPermission?.granted ? "#15803D" : "#B45309",
                  },
                ]}
              >
                {cameraPermission?.granted ? "Allowed" : "Off"}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.rowItem,
              Platform.OS === "android" && styles.rowBorder,
            ]}
            onPress={handleNotificationPermission}
            activeOpacity={0.75}
          >
            <View style={[styles.rowIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons
                name="notifications-outline"
                size={20}
                color="#4F46E5"
              />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Timer Notifications</Text>
              <Text style={styles.rowSubtitle}>
                Alerts when focus sessions end
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: notifGranted ? "#DCFCE7" : "#FEF3C7" },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: notifGranted ? "#15803D" : "#B45309" },
                ]}
              >
                {notifGranted ? "Allowed" : "Off"}
              </Text>
            </View>
          </TouchableOpacity>

          {Platform.OS === "android" && (
            <TouchableOpacity
              style={styles.rowItem}
              onPress={() => Linking.openSettings()}
              activeOpacity={0.75}
            >
              <View style={[styles.rowIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons
                  name="battery-charging-outline"
                  size={20}
                  color="#B45309"
                />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowTitle}>Background Battery Mode</Text>
                <Text style={styles.rowSubtitle}>
                  Set Battery to Unrestricted for on-time timer alerts
                </Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Data Management Section */}
        <Text style={styles.sectionLabel}>DATA MANAGEMENT</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.rowItem}
            onPress={handleClearCompletedTasks}
            disabled={clearingTasks}
            activeOpacity={0.75}
          >
            <View style={[styles.rowIconBox, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="trash-bin-outline" size={20} color="#DC2626" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>Clear Completed Tasks</Text>
              <Text style={styles.rowSubtitle}>
                {completedTasksCount} completed{" "}
                {completedTasksCount === 1 ? "assignment" : "assignments"}{" "}
                stored
              </Text>
            </View>
            {clearingTasks ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            )}
          </TouchableOpacity>
        </View>

        {/* About Card */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <View style={styles.rowItem}>
            <View style={[styles.rowIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="school-outline" size={20} color="#4F46E5" />
            </View>
            <View style={styles.rowTextContainer}>
              <Text style={styles.rowTitle}>ScholarSync</Text>
              <Text style={styles.rowSubtitle}>
                Version 1.0.0 • Student Productivity Hub
              </Text>
            </View>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.signOutBtn, signingOut && styles.disabledBtn]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#DC2626" />
              <Text style={styles.signOutBtnText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() =>
          !updatingPassword && setPasswordModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                disabled={updatingPassword}
              >
                <Ionicons name="close" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
              editable={!updatingPassword}
            />

            <Text style={styles.fieldLabel}>Confirm New Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              editable={!updatingPassword}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setPasswordModalVisible(false)}
                disabled={updatingPassword}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveModalBtn,
                  updatingPassword && styles.disabledBtn,
                ]}
                onPress={handleChangePassword}
                disabled={updatingPassword}
              >
                {updatingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 96,
  },
  headerBar: {
    marginBottom: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#4F46E5",
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 2,
  },
  profileMeta: {
    fontSize: 13,
    color: "#6B7280",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rowIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rowTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  rowSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  signOutBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#DC2626",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 4,
  },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  cancelModalText: {
    color: "#374151",
    fontWeight: "600",
  },
  saveModalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  saveModalText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
