import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "../../services/supabase";

type TaskStatus = "pending" | "doing" | "done";
type FilterOption = "all" | TaskStatus;

interface TaskItem {
  id: string;
  user_id: string;
  title: string;
  course: string | null;
  due_date: string | null;
  status: TaskStatus;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const FILTER_TABS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "doing", label: "Doing" },
  { value: "done", label: "Done" },
];

const STATUS_COLORS: Record<
  TaskStatus,
  { bg: string; text: string; border: string }
> = {
  pending: { bg: "#FEF3C7", text: "#B45309", border: "#F59E0B" },
  doing: { bg: "#DBEAFE", text: "#1D4ED8", border: "#3B82F6" },
  done: { bg: "#DCFCE7", text: "#15803D", border: "#22C55E" },
};

// Format local Date -> 'YYYY-MM-DD' without UTC timezone shift
const formatDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Parse 'YYYY-MM-DD' safely in local time (falls back to today)
const parseDateString = (dateStr?: string | null): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
};

export default function TasksScreen() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Filter & collapsible form state
  const [filterStatus, setFilterStatus] = useState<FilterOption>("all");
  const [showAddForm, setShowAddForm] = useState<boolean>(true);

  // Create form state
  const [title, setTitle] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("");
  const [due_date, setdue_date] = useState<string>("");
  const [status, setStatus] = useState<TaskStatus>("pending");
  const [showCreatePicker, setShowCreatePicker] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editCourseName, setEditCourseName] = useState<string>("");
  const [editdue_date, setEditdue_date] = useState<string>("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("pending");
  const [showEditPicker, setShowEditPicker] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);

  const fetchTasks = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Authentication Error", "Please sign in again.");
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks((data as TaskItem[]) || []);
    } catch (error: any) {
      Alert.alert(
        "Error Loading Tasks",
        error.message || "Could not load tasks.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTasks();
    }, [fetchTasks]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  // DatePicker handler for Create Task form
  const handleCreateDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowCreatePicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setdue_date(formatDateString(selectedDate));
    }
  };

  // DatePicker handler for Edit Task modal
  const handleEditDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    if (Platform.OS === "android") {
      setShowEditPicker(false);
    }
    if (event.type === "set" && selectedDate) {
      setEditdue_date(formatDateString(selectedDate));
    }
  };

  const handleAddTask = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter an assignment title.");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Authentication Error", "User session not found.");
        return;
      }

      const { data, error } = await supabase
        .from("tasks")
        .insert([
          {
            user_id: user.id,
            title: title.trim(),
            course: courseName.trim() || null,
            due_date: due_date || null,
            status,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setTasks((prev) => [data as TaskItem, ...prev]);
      } else {
        await fetchTasks();
      }

      setTitle("");
      setCourseName("");
      setdue_date("");
      setStatus("pending");
      setShowCreatePicker(false);
    } catch (error: any) {
      Alert.alert(
        "Create Failed",
        error.message || "Could not add assignment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (
    taskId: string,
    newStatus: TaskStatus,
  ) => {
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", taskId);

      if (error) throw error;
    } catch (error: any) {
      setTasks(previousTasks);
      Alert.alert("Update Failed", error.message || "Could not update status.");
    }
  };

  const openEditModal = (task: TaskItem) => {
    setEditingTask(task);
    setEditTitle(task.title);
    setEditCourseName(task.course || "");
    setEditdue_date(task.due_date || "");
    setEditStatus(task.status);
    setShowEditPicker(false);
    setEditModalVisible(true);
  };

  const handleUpdateTask = async () => {
    if (!editingTask) return;
    if (!editTitle.trim()) {
      Alert.alert("Missing Title", "Assignment title cannot be empty.");
      return;
    }

    setUpdating(true);
    try {
      const updates = {
        title: editTitle.trim(),
        course: editCourseName.trim() || null,
        due_date: editdue_date || null,
        status: editStatus,
      };

      const { error } = await supabase
        .from("tasks")
        .update(updates)
        .eq("id", editingTask.id);

      if (error) throw error;

      setTasks((prev) =>
        prev.map((t) => (t.id === editingTask.id ? { ...t, ...updates } : t)),
      );
      setShowEditPicker(false);
      setEditModalVisible(false);
      setEditingTask(null);
    } catch (error: any) {
      Alert.alert(
        "Save Failed",
        error.message || "Could not update assignment.",
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTask = (task: TaskItem) => {
    Alert.alert(
      "Delete Assignment",
      `Are you sure you want to delete "${task.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const previousTasks = [...tasks];
            setTasks((prev) => prev.filter((t) => t.id !== task.id));

            try {
              const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", task.id);

              if (error) throw error;
            } catch (error: any) {
              setTasks(previousTasks);
              Alert.alert(
                "Delete Failed",
                error.message || "Could not delete assignment.",
              );
            }
          },
        },
      ],
    );
  };

  const filteredTasks =
    filterStatus === "all"
      ? tasks
      : tasks.filter((t) => t.status === filterStatus);

  const renderTaskItem = ({ item }: { item: TaskItem }) => {
    return (
      <View style={styles.taskCard}>
        <View style={styles.taskHeaderRow}>
          {item.course ? (
            <View style={styles.courseBadge}>
              <Ionicons name="book-outline" size={12} color="#4F46E5" />
              <Text style={styles.courseBadgeText}>{item.course}</Text>
            </View>
          ) : (
            <View />
          )}

          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: "#EEF2FF" }]}
              onPress={() => openEditModal(item)}
              accessibilityLabel={`Edit ${item.title}`}
            >
              <Ionicons name="create-outline" size={18} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: "#FEF2F2" }]}
              onPress={() => handleDeleteTask(item)}
              accessibilityLabel={`Delete ${item.title}`}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        </View>

        <Text
          style={[
            styles.taskTitle,
            item.status === "done" && styles.taskTitleDone,
          ]}
        >
          {item.title}
        </Text>

        {item.due_date ? (
          <View style={styles.due_dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.due_dateText}>Due: {item.due_date}</Text>
          </View>
        ) : null}

        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((opt) => {
            const isSelected = item.status === opt.value;
            const optColors = STATUS_COLORS[opt.value];
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.statusChip,
                  isSelected && {
                    backgroundColor: optColors.bg,
                    borderColor: optColors.border,
                  },
                ]}
                onPress={() => handleQuickStatusChange(item.id, opt.value)}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    isSelected && {
                      color: optColors.text,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        {/* Header with Collapsible Form Toggle */}
        <View style={styles.headerBar}>
          <Text style={styles.screenTitle}>Assignments</Text>
          <TouchableOpacity
            style={styles.toggleFormBtn}
            onPress={() => {
              setShowCreatePicker(false);
              setShowAddForm((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name={showAddForm ? "chevron-up" : "add-circle-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.toggleFormBtnText}>
              {showAddForm ? "Hide Form" : "New Task"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Collapsible Create Task Card */}
        {showAddForm && (
          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder="Assignment title *"
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />

            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.halfInput]}
                placeholder="Course (e.g., CS301)"
                placeholderTextColor="#9CA3AF"
                value={courseName}
                onChangeText={setCourseName}
              />

              {/* Native Date Picker Trigger */}
              <View style={[styles.dateTrigger, styles.halfInput]}>
                <TouchableOpacity
                  style={styles.dateTriggerMain}
                  onPress={() => setShowCreatePicker(true)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dateTriggerText,
                      !due_date && styles.datePlaceholderText,
                    ]}
                    numberOfLines={1}
                  >
                    {due_date || "Due Date"}
                  </Text>
                </TouchableOpacity>

                {due_date ? (
                  <TouchableOpacity
                    onPress={() => {
                      setdue_date("");
                      setShowCreatePicker(false);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setShowCreatePicker(true)}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#4F46E5"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {showCreatePicker && (
              <View style={styles.iosPickerWrapper}>
                <DateTimePicker
                  value={parseDateString(due_date)}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "default"}
                  onChange={handleCreateDateChange}
                />
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={styles.iosDoneBtn}
                    onPress={() => setShowCreatePicker(false)}
                  >
                    <Text style={styles.iosDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Initial Status Selector (default: pending) */}
            <View style={styles.formStatusRow}>
              {STATUS_OPTIONS.map((opt) => {
                const active = status === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.formStatusBtn,
                      active && styles.formStatusBtnActive,
                    ]}
                    onPress={() => setStatus(opt.value)}
                  >
                    <Text
                      style={[
                        styles.formStatusText,
                        active && styles.formStatusTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.addBtn, submitting && styles.disabledBtn]}
              onPress={handleAddTask}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.addBtnText}>Add Assignment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Status Filter Tabs */}
        <View style={styles.filterRow}>
          {FILTER_TABS.map((tab) => {
            const isActive = filterStatus === tab.value;
            const count =
              tab.value === "all"
                ? tasks.length
                : tasks.filter((t) => t.status === tab.value).length;

            return (
              <TouchableOpacity
                key={tab.value}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setFilterStatus(tab.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Filtered Task List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            renderItem={renderTaskItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="checkmark-done-circle-outline"
                  size={48}
                  color="#9CA3AF"
                />
                <Text style={styles.emptyTitle}>
                  {filterStatus === "all"
                    ? "No Assignments Yet"
                    : `No ${
                        filterStatus.charAt(0).toUpperCase() +
                        filterStatus.slice(1)
                      } Tasks`}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {filterStatus === "all"
                    ? 'Tap "New Task" above to start tracking due_dates.'
                    : "Switch filter tabs above or update a task status."}
                </Text>
              </View>
            }
          />
        )}

        {/* Edit Task Modal */}
        <Modal
          visible={editModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => !updating && setEditModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Assignment</Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  disabled={updating}
                >
                  <Ionicons name="close" size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Assignment title"
                placeholderTextColor="#9CA3AF"
                editable={!updating}
              />

              <Text style={styles.fieldLabel}>Course Name</Text>
              <TextInput
                style={styles.input}
                value={editCourseName}
                onChangeText={setEditCourseName}
                placeholder="e.g., CS301"
                placeholderTextColor="#9CA3AF"
                editable={!updating}
              />

              <Text style={styles.fieldLabel}>Due Date</Text>
              <View style={[styles.dateTrigger, { marginBottom: 12 }]}>
                <TouchableOpacity
                  style={styles.dateTriggerMain}
                  onPress={() => setShowEditPicker(true)}
                  disabled={updating}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.dateTriggerText,
                      !editdue_date && styles.datePlaceholderText,
                    ]}
                  >
                    {editdue_date || "Select due date (optional)"}
                  </Text>
                </TouchableOpacity>

                {editdue_date ? (
                  <TouchableOpacity
                    onPress={() => {
                      setEditdue_date("");
                      setShowEditPicker(false);
                    }}
                    disabled={updating}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setShowEditPicker(true)}
                    disabled={updating}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#4F46E5"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {showEditPicker && (
                <View style={styles.iosPickerWrapper}>
                  <DateTimePicker
                    value={parseDateString(editdue_date)}
                    mode="date"
                    display={Platform.OS === "ios" ? "inline" : "default"}
                    onChange={handleEditDateChange}
                  />
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.iosDoneBtn}
                      onPress={() => setShowEditPicker(false)}
                    >
                      <Text style={styles.iosDoneBtnText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.formStatusRow}>
                {STATUS_OPTIONS.map((opt) => {
                  const active = editStatus === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.formStatusBtn,
                        active && styles.formStatusBtnActive,
                      ]}
                      onPress={() => setEditStatus(opt.value)}
                      disabled={updating}
                    >
                      <Text
                        style={[
                          styles.formStatusText,
                          active && styles.formStatusTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setEditModalVisible(false)}
                  disabled={updating}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, updating && styles.disabledBtn]}
                  onPress={handleUpdateTask}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  toggleFormBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 5,
  },
  toggleFormBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
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
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
  },
  dateTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  dateTriggerMain: {
    flex: 1,
    marginRight: 6,
  },
  dateTriggerText: {
    fontSize: 15,
    color: "#111827",
  },
  datePlaceholderText: {
    color: "#9CA3AF",
  },
  iosPickerWrapper: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  iosDoneBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  iosDoneBtnText: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 14,
  },
  formStatusRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  formStatusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  formStatusBtnActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  formStatusText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  formStatusTextActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  addBtn: {
    flexDirection: "row",
    backgroundColor: "#4F46E5",
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  disabledBtn: {
    opacity: 0.6,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
  },
  filterTabActive: {
    backgroundColor: "#4F46E5",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 96,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  taskHeaderRow: {
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
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  taskTitleDone: {
    textDecorationLine: "line-through",
    color: "#9CA3AF",
  },
  due_dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 10,
  },
  due_dateText: {
    fontSize: 13,
    color: "#6B7280",
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  statusChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  statusChipText: {
    fontSize: 12,
    color: "#6B7280",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
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
    marginBottom: 14,
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
    marginBottom: 5,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  cancelBtnText: {
    color: "#374151",
    fontWeight: "600",
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
