import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const CHANNEL_ID = "timer-alerts";
const WHEEL_ITEM_HEIGHT = 44;
const HOURS_LIST = Array.from({ length: 6 }, (_, i) => i); // 0 to 5 hours
const MINUTES_LIST = Array.from({ length: 60 }, (_, i) => i); // 0 to 59 mins

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface DurationPreset {
  label: string;
  seconds: number;
}

const DURATION_PRESETS: DurationPreset[] = [
  { label: "5s Test", seconds: 5 },
  { label: "5 min", seconds: 5 * 60 },
  { label: "15 min", seconds: 15 * 60 },
  { label: "25 min", seconds: 25 * 60 },
  { label: "45 min", seconds: 45 * 60 },
  { label: "60 min", seconds: 60 * 60 },
];

export default function TimerScreen() {
  // Duration & countdown state (default: 25 minutes)
  const [totalSeconds, setTotalSeconds] = useState<number>(25 * 60);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [selectedLabel, setSelectedLabel] = useState<string>("25 min");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completedSessions, setCompletedSessions] = useState<number>(0);

  // Wheel Picker Modal state
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);
  const [pickedHours, setPickedHours] = useState<number>(0);
  const [pickedMinutes, setPickedMinutes] = useState<number>(25);

  // Notification permission state
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null,
  );

  // Refs for accurate timing and notification tracking
  const endTimeRef = useRef<number | null>(null);
  const scheduledNotifIdRef = useRef<string | null>(null);
  const activeLabelRef = useRef<string>("25 min");
  const appStateRef = useRef(AppState.currentState);

  const ensureNotificationPermission =
    useCallback(async (): Promise<boolean> => {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
            name: "Focus Timer Alerts",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 300, 200, 300],
            lightColor: "#4F46E5",
            // sound: "default",
          });
        }

        const { status: existingStatus } =
          await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        const granted = finalStatus === "granted";
        setPermissionGranted(granted);
        return granted;
      } catch {
        setPermissionGranted(false);
        return false;
      }
    }, []);

  useEffect(() => {
    ensureNotificationPermission();
    return () => {
      if (scheduledNotifIdRef.current) {
        Notifications.cancelScheduledNotificationAsync(
          scheduledNotifIdRef.current,
        ).catch(() => {});
      }
    };
  }, [ensureNotificationPermission]);

  const cancelBackgroundAlert = async () => {
    if (scheduledNotifIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(
          scheduledNotifIdRef.current,
        );
      } catch {
        // Ignore if already triggered
      } finally {
        scheduledNotifIdRef.current = null;
      }
    }
  };

  // Schedule background alert for exact target Date timestamp
  const scheduleBackgroundAlert = async (
    targetEndTimeMs: number,
    label: string,
  ) => {
    await cancelBackgroundAlert();
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Focus Session Complete!",
          body: `Your ${label} study session has ended. Time to take a break!`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(targetEndTimeMs),
          channelId: CHANNEL_ID,
        },
      });
      scheduledNotifIdRef.current = id;
    } catch (error: any) {
      console.warn(
        "Failed to schedule background notification:",
        error?.message,
      );
    }
  };

  // Immediate zero-delay alert when timer finishes while app is open
  const fireImmediateForegroundAlert = async (label: string) => {
    await cancelBackgroundAlert();
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) return;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Focus Session Complete!",
          body: `Your ${label} study session has ended. Time to take a break!`,
          sound: true,
        },
        trigger: null,
      });
    } catch (error: any) {
      console.warn("Failed to fire foreground notification:", error?.message);
    }
  };

  // Sync timer when returning from background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        isRunning &&
        endTimeRef.current
      ) {
        const remaining = Math.ceil((endTimeRef.current - Date.now()) / 1000);
        if (remaining <= 0) {
          // Completed while in background (OS notification already handled alert)
          endTimeRef.current = null;
          scheduledNotifIdRef.current = null;
          setSecondsLeft(0);
          setIsRunning(false);
          setCompletedSessions((prev) => prev + 1);
        } else {
          setSecondsLeft(remaining);
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [isRunning]);

  // Foreground countdown loop (100ms resolution for smooth ring & exact completion)
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      if (!endTimeRef.current) return;

      const msRemaining = endTimeRef.current - Date.now();
      const secsRemaining = Math.ceil(msRemaining / 1000);

      if (msRemaining <= 0) {
        clearInterval(interval);
        const completedLabel = activeLabelRef.current;
        endTimeRef.current = null;
        setSecondsLeft(0);
        setIsRunning(false);
        setCompletedSessions((prev) => prev + 1);

        if (AppState.currentState === "active") {
          fireImmediateForegroundAlert(completedLabel);
        }
      } else {
        setSecondsLeft(secsRemaining);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning]);

  const applyNewDuration = async (newSeconds: number, label: string) => {
    await cancelBackgroundAlert();
    endTimeRef.current = null;
    activeLabelRef.current = label;
    setTotalSeconds(newSeconds);
    setSecondsLeft(newSeconds);
    setSelectedLabel(label);
  };

  const handleSelectPreset = async (preset: DurationPreset) => {
    if (isRunning) {
      Alert.alert(
        "Timer Running",
        "Pause or reset the current session before changing the duration.",
      );
      return;
    }
    await applyNewDuration(preset.seconds, preset.label);
  };

  const openWheelPicker = () => {
    if (isRunning) {
      Alert.alert(
        "Timer Running",
        "Pause or reset the current session before changing the duration.",
      );
      return;
    }
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    setPickedHours(hrs);
    setPickedMinutes(mins === 0 && hrs === 0 ? 25 : mins);
    setPickerVisible(true);
  };

  const handleConfirmWheelDuration = async () => {
    const newSeconds = pickedHours * 3600 + pickedMinutes * 60;
    if (newSeconds <= 0) {
      Alert.alert("Invalid Duration", "Please select at least 1 minute.");
      return;
    }

    const label =
      pickedHours > 0
        ? pickedMinutes > 0
          ? `${pickedHours}h ${pickedMinutes}m`
          : `${pickedHours} hr`
        : `${pickedMinutes} min`;

    await applyNewDuration(newSeconds, label);
    setPickerVisible(false);
  };

  const handleStart = async () => {
    const startFrom = secondsLeft === 0 ? totalSeconds : secondsLeft;
    if (secondsLeft === 0) {
      setSecondsLeft(totalSeconds);
    }

    const targetEnd = Date.now() + startFrom * 1000;
    endTimeRef.current = targetEnd;
    activeLabelRef.current = selectedLabel;
    setIsRunning(true);

    await scheduleBackgroundAlert(targetEnd, selectedLabel);
  };

  const handlePause = async () => {
    setIsRunning(false);
    endTimeRef.current = null;
    await cancelBackgroundAlert();
  };

  const handleReset = async () => {
    setIsRunning(false);
    endTimeRef.current = null;
    await cancelBackgroundAlert();
    setSecondsLeft(totalSeconds);
  };

  const formatTime = (secs: number): string => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remSecs = secs % 60;

    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
        remSecs,
      ).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(remSecs).padStart(2, "0")}`;
  };

  // Circular progress ring math (0° to 360° clockwise)
  const progress =
    totalSeconds > 0 ? Math.max(0, Math.min(1, secondsLeft / totalSeconds)) : 0;
  const degrees = progress * 360;
  const rightDeg = Math.min(degrees, 180);
  const leftDeg = Math.max(0, degrees - 180);
  const rightRotate = `${-135 + rightDeg}deg`;
  const leftRotate = `${45 + leftDeg}deg`;
  const ringColor = secondsLeft === 0 ? "#16A34A" : "#4F46E5";

  const onHoursScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(HOURS_LIST.length - 1, idx));
    setPickedHours(HOURS_LIST[clamped]);
  };

  const onMinutesScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(MINUTES_LIST.length - 1, idx));
    setPickedMinutes(MINUTES_LIST[clamped]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerBar}>
            <Text style={styles.screenTitle}>Focus Timer</Text>
            <View style={styles.sessionBadge}>
              <Ionicons name="flame" size={16} color="#D97706" />
              <Text style={styles.sessionBadgeText}>
                {completedSessions}{" "}
                {completedSessions === 1 ? "Session" : "Sessions"}
              </Text>
            </View>
          </View>

          {/* Permission Warning Banner */}
          {permissionGranted === false && (
            <View style={styles.permissionBanner}>
              <Ionicons
                name="notifications-off-outline"
                size={20}
                color="#B45309"
              />
              <Text style={styles.permissionText}>
                Notifications are off. Enable them to get alerts when your timer
                finishes.
              </Text>
              <TouchableOpacity onPress={ensureNotificationPermission}>
                <Text style={styles.permissionLink}>Enable</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Circular Progress Bar Card */}
          <View style={styles.timerCard}>
            <TouchableOpacity
              style={styles.modePill}
              onPress={openWheelPicker}
              disabled={isRunning}
            >
              <Text style={styles.modePillText}>
                {isRunning
                  ? `Focusing • ${selectedLabel}`
                  : secondsLeft === 0
                    ? "Session Complete!"
                    : `${selectedLabel} • Tap to Adjust`}
              </Text>
              {!isRunning && (
                <Ionicons name="chevron-down" size={14} color="#4F46E5" />
              )}
            </TouchableOpacity>

            {/* Circular Progress Ring */}
            <View style={styles.circleWrapper}>
              {/* Background Track */}
              <View style={styles.circleTrack} />

              {/* Right Semicircle (0° - 180°) */}
              <View style={styles.rightClip}>
                <View
                  style={[
                    styles.halfCircleArc,
                    {
                      borderTopColor: ringColor,
                      borderRightColor: ringColor,
                      transform: [{ rotate: rightRotate }],
                    },
                  ]}
                />
              </View>

              {/* Left Semicircle (180° - 360°) */}
              <View style={styles.leftClip}>
                <View
                  style={[
                    styles.halfCircleArc,
                    styles.leftArcOffset,
                    {
                      borderTopColor: ringColor,
                      borderRightColor: ringColor,
                      transform: [{ rotate: leftRotate }],
                    },
                  ]}
                />
              </View>

              {/* Center Time Display */}
              <TouchableOpacity
                style={styles.circleCenter}
                onPress={openWheelPicker}
                disabled={isRunning}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.timerText,
                    totalSeconds >= 3600 && styles.timerTextLong,
                  ]}
                >
                  {formatTime(secondsLeft)}
                </Text>
                <Text style={styles.timerSubtext}>
                  {isRunning
                    ? "Stay focused"
                    : secondsLeft === 0
                      ? "Great work!"
                      : "Tap circle to set time"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Start / Pause / Reset Controls */}
            <View style={styles.controlsRow}>
              {!isRunning ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleStart}
                >
                  <Ionicons name="play" size={22} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {secondsLeft === 0
                      ? "Restart"
                      : secondsLeft < totalSeconds
                        ? "Resume"
                        : "Start Focus"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.pauseBtn} onPress={handlePause}>
                  <Ionicons name="pause" size={22} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Pause</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
                <Ionicons name="refresh" size={20} color="#374151" />
                <Text style={styles.resetBtnText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Duration Presets + Custom Wheel Button */}
          <View style={styles.selectorCard}>
            <View style={styles.selectorHeader}>
              <Text style={styles.sectionTitle}>Duration Presets</Text>
              <TouchableOpacity
                style={[
                  styles.customWheelBtn,
                  isRunning && styles.disabledItem,
                ]}
                onPress={openWheelPicker}
                disabled={isRunning}
              >
                <Ionicons name="time-outline" size={16} color="#4F46E5" />
                <Text style={styles.customWheelBtnText}>Custom Picker</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetsGrid}>
              {DURATION_PRESETS.map((preset) => {
                const isSelected = totalSeconds === preset.seconds;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[
                      styles.presetChip,
                      isSelected && styles.presetChipActive,
                      isRunning && styles.disabledItem,
                    ]}
                    onPress={() => handleSelectPreset(preset)}
                    disabled={isRunning}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        isSelected && styles.presetTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Scroll-Wheel Duration Picker Modal */}
        <Modal
          visible={pickerVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Set Study Duration</Text>
                <TouchableOpacity onPress={() => setPickerVisible(false)}>
                  <Ionicons name="close" size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.wheelsWrapper}>
                {/* Highlight Band */}
                <View style={styles.wheelHighlightBand} pointerEvents="none" />

                {/* Hours Column */}
                <View style={styles.wheelColumn}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    snapToInterval={WHEEL_ITEM_HEIGHT}
                    decelerationRate="fast"
                    contentOffset={{ x: 0, y: pickedHours * WHEEL_ITEM_HEIGHT }}
                    onMomentumScrollEnd={onHoursScrollEnd}
                    contentContainerStyle={styles.wheelContent}
                  >
                    {HOURS_LIST.map((hr) => (
                      <TouchableOpacity
                        key={hr}
                        style={styles.wheelItem}
                        onPress={() => setPickedHours(hr)}
                      >
                        <Text
                          style={[
                            styles.wheelItemText,
                            pickedHours === hr && styles.wheelItemTextSelected,
                          ]}
                        >
                          {String(hr).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.wheelUnitLabel}>hours</Text>
                </View>

                <Text style={styles.wheelColon}>:</Text>

                {/* Minutes Column */}
                <View style={styles.wheelColumn}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    snapToInterval={WHEEL_ITEM_HEIGHT}
                    decelerationRate="fast"
                    contentOffset={{
                      x: 0,
                      y: pickedMinutes * WHEEL_ITEM_HEIGHT,
                    }}
                    onMomentumScrollEnd={onMinutesScrollEnd}
                    contentContainerStyle={styles.wheelContent}
                  >
                    {MINUTES_LIST.map((min) => (
                      <TouchableOpacity
                        key={min}
                        style={styles.wheelItem}
                        onPress={() => setPickedMinutes(min)}
                      >
                        <Text
                          style={[
                            styles.wheelItemText,
                            pickedMinutes === min &&
                              styles.wheelItemTextSelected,
                          ]}
                        >
                          {String(min).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.wheelUnitLabel}>mins</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setPickerVisible(false)}
                >
                  <Text style={styles.cancelModalText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmModalBtn}
                  onPress={handleConfirmWheelDuration}
                >
                  <Text style={styles.confirmModalText}>Apply Duration</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const CIRCLE_SIZE = 240;
const STROKE_WIDTH = 14;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 96,
  },
  headerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  sessionBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  sessionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B45309",
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
  },
  permissionText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
  },
  permissionLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  timerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 22,
    gap: 4,
  },
  modePillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4F46E5",
  },
  circleWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 26,
  },
  circleTrack: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderColor: "#E5E7EB",
  },
  rightClip: {
    position: "absolute",
    right: 0,
    top: 0,
    width: CIRCLE_SIZE / 2,
    height: CIRCLE_SIZE,
    overflow: "hidden",
  },
  leftClip: {
    position: "absolute",
    left: 0,
    top: 0,
    width: CIRCLE_SIZE / 2,
    height: CIRCLE_SIZE,
    overflow: "hidden",
  },
  halfCircleArc: {
    position: "absolute",
    left: -(CIRCLE_SIZE / 2),
    top: 0,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: STROKE_WIDTH,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  leftArcOffset: {
    left: 0,
  },
  circleCenter: {
    width: CIRCLE_SIZE - STROKE_WIDTH * 2 - 12,
    height: CIRCLE_SIZE - STROKE_WIDTH * 2 - 12,
    borderRadius: (CIRCLE_SIZE - STROKE_WIDTH * 2 - 12) / 2,
    justifyContent: "center",
    alignItems: "center",
  },
  timerText: {
    fontSize: 46,
    fontWeight: "800",
    color: "#111827",
    fontVariant: ["tabular-nums"],
  },
  timerTextLong: {
    fontSize: 34,
  },
  timerSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "500",
  },
  controlsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryBtn: {
    flex: 2,
    flexDirection: "row",
    backgroundColor: "#4F46E5",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  pauseBtn: {
    flex: 2,
    flexDirection: "row",
    backgroundColor: "#D97706",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  resetBtn: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#E5E7EB",
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  resetBtnText: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "600",
  },
  selectorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  customWheelBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  customWheelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  presetChip: {
    width: "31%",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
  },
  presetChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#4F46E5",
  },
  presetText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  presetTextActive: {
    color: "#4F46E5",
  },
  disabledItem: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
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
  wheelsWrapper: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    height: WHEEL_ITEM_HEIGHT * 3,
    marginBottom: 20,
    position: "relative",
  },
  wheelHighlightBand: {
    position: "absolute",
    left: 16,
    right: 16,
    top: WHEEL_ITEM_HEIGHT,
    height: WHEEL_ITEM_HEIGHT,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
  },
  wheelColumn: {
    flexDirection: "row",
    alignItems: "center",
    height: WHEEL_ITEM_HEIGHT * 3,
  },
  wheelContent: {
    paddingVertical: WHEEL_ITEM_HEIGHT,
  },
  wheelItem: {
    height: WHEEL_ITEM_HEIGHT,
    width: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  wheelItemText: {
    fontSize: 22,
    fontWeight: "500",
    color: "#9CA3AF",
    fontVariant: ["tabular-nums"],
  },
  wheelItemTextSelected: {
    fontSize: 26,
    fontWeight: "800",
    color: "#4F46E5",
  },
  wheelUnitLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4B5563",
    marginLeft: 2,
  },
  wheelColon: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    marginHorizontal: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
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
  confirmModalBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
  },
  confirmModalText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
