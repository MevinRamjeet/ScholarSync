import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Adjust this import path if your supabase.ts file lives in another folder
import { supabase } from "../../services/supabase";

type ActiveTaskStatus = "pending" | "doing";

interface DashboardTask {
  id: string;
  user_id: string;
  title: string;
  course?: string | null;
  due_date?: string | null;
  status: ActiveTaskStatus;
}

const STATUS_BADGE: Record<
  ActiveTaskStatus,
  { label: string; color: string; bg: string }
> = {
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  doing: { label: "Doing", color: "#1D4ED8", bg: "#DBEAFE" },
};

export default function DashboardScreen() {
  const router = useRouter();

  const [userName, setUserName] = useState<string>("Student");
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [notesCount, setNotesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Authentication Error", "Please sign in again.");
        return;
      }

      if (user.email) {
        const prefix = user.email.split("@")[0];
        setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }

      // Fetch active tasks ('pending' and 'doing') for the current user
      const { data: taskData, error: taskError } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "doing"])
        .order("due_date", { ascending: true, nullsFirst: false });

      if (taskError) throw taskError;
      setTasks((taskData as DashboardTask[]) || []);

      // Fetch scanned notes count for summary card
      const { count, error: notesError } = await supabase
        .from("notes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (!notesError && typeof count === "number") {
        setNotesCount(count);
      }
    } catch (error: any) {
      Alert.alert(
        "Dashboard Error",
        error.message || "Could not load dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Re-fetch whenever the Dashboard tab comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const doingCount = tasks.filter((t) => t.status === "doing").length;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Top Greeting Header */}
        <View style={styles.headerBar}>
          <View>
            <Text style={styles.greetingSub}>Welcome back,</Text>
            <Text style={styles.screenTitle}>{userName}</Text>
          </View>
          <View style={styles.brandPill}>
            <Ionicons name="school" size={18} color="#4F46E5" />
            <Text style={styles.brandPillText}>ScholarSync</Text>
          </View>
        </View>

        {/* Workload Summary Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="time-outline" size={20} color="#B45309" />
            </View>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "#DBEAFE" }]}>
              <Ionicons name="flash-outline" size={20} color="#1D4ED8" />
            </View>
            <Text style={styles.statValue}>{doingCount}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconBox, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color="#4F46E5"
              />
            </View>
            <Text style={styles.statValue}>{notesCount}</Text>
            <Text style={styles.statLabel}>Notes</Text>
          </View>
        </View>

        {/* Quick Navigation Shortcuts */}
        {/* <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/tasks")}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="add-circle-outline" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.actionLabel}>Manage Tasks</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/scanner")}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="camera-outline" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.actionLabel}>Scan Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/timer")}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="timer-outline" size={22} color="#4F46E5" />
            </View>
            <Text style={styles.actionLabel}>Focus Timer</Text>
          </TouchableOpacity>
        </View> */}

        {/* Active Assignments Section (Pending & Doing) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>
            Active Assignments ({tasks.length})
          </Text>
          <TouchableOpacity
            style={styles.viewAllBtn}
            onPress={() => router.push("/(tabs)/tasks")}
          >
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={15} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centeredBox}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={46}
              color="#9CA3AF"
            />
            <Text style={styles.emptyTitle}>All Caught Up!</Text>
            <Text style={styles.emptySubtitle}>
              You have no pending or in-progress assignments right now.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push("/(tabs)/tasks")}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyBtnText}>Add Assignment</Text>
            </TouchableOpacity>
          </View>
        ) : (
          tasks.map((item) => {
            const badge = STATUS_BADGE[item.status] || STATUS_BADGE.pending;

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.taskCard}
                onPress={() => router.push("/(tabs)/tasks")}
                activeOpacity={0.8}
              >
                <View style={styles.taskTopRow}>
                  {item.course ? (
                    <View style={styles.courseBadge}>
                      <Ionicons name="book-outline" size={12} color="#4F46E5" />
                      <Text style={styles.courseBadgeText}>{item.course}</Text>
                    </View>
                  ) : (
                    <View />
                  )}

                  <View
                    style={[styles.statusBadge, { backgroundColor: badge.bg }]}
                  >
                    <Text
                      style={[styles.statusBadgeText, { color: badge.color }]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <Text style={styles.taskTitle}>{item.title}</Text>

                {item.due_date ? (
                  <View style={styles.due_dateRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color="#6B7280"
                    />
                    <Text style={styles.due_dateText}>
                      Due: {item.due_date}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  greetingSub: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "500",
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  brandPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 2,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  centeredBox: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginTop: 10,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  courseBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  courseBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4F46E5",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  due_dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  due_dateText: {
    fontSize: 13,
    color: "#6B7280",
  },
});
