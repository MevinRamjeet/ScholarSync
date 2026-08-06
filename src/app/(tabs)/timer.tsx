import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function TimerScreen() {
  const [secondsLeft, setSecondsLeft] = useState(25 * 60); // 25 minutes
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Type-safe interval declaration
    let interval: ReturnType<typeof setInterval>;

    if (isActive) {
      interval = setInterval(() => {
        setSecondsLeft((prevSeconds) => {
          if (prevSeconds <= 1) {
            clearInterval(interval);
            setIsActive(false);

            // Delay alert slightly so the UI can paint "00:00" first
            setTimeout(
              () => alert("Focus session complete! Take a break."),
              10,
            );
            return 0;
          }
          return prevSeconds - 1;
        });
      }, 1000);
    }

    // Cleanup interval on unmount or when isActive changes
    return () => clearInterval(interval);
  }, [isActive]); // secondsLeft is no longer here!

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setSecondsLeft(25 * 60);
  };

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pomodoro Focus</Text>

      <View style={styles.timerCircle}>
        <Text style={styles.timeText}>{formatTime(secondsLeft)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, isActive ? styles.pauseBtn : styles.startBtn]}
          onPress={toggleTimer}
        >
          <Text style={styles.buttonText}>{isActive ? "Pause" : "Start"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.resetBtn]}
          onPress={resetTimer}
        >
          <Text style={styles.buttonText}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 40 },
  timerCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 8,
    borderColor: "#4A90E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
  },
  timeText: { fontSize: 60, fontWeight: "bold", color: "#4A90E2" },
  controls: { flexDirection: "row", gap: 20 },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    minWidth: 120,
    alignItems: "center",
  },
  startBtn: { backgroundColor: "#4CAF50" },
  pauseBtn: { backgroundColor: "#FF9800" },
  resetBtn: { backgroundColor: "#F44336" },
  buttonText: { color: "white", fontSize: 18, fontWeight: "bold" },
});
