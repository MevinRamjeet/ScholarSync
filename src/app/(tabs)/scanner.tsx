import { decode } from "base64-arraybuffer";
import { CameraView, useCameraPermissions } from "expo-camera";
import { File } from "expo-file-system";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../services/supabase";

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<any>(null);

  if (!permission)
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Loading...</Text>
      </View>
    );

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>
          We need your permission to show the camera
        </Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        shutterSound: false,
      });
      setPhotoUri(photo.uri);
    }
  };

  const uploadPhoto = async () => {
    if (!photoUri) return;
    setUploading(true);

    try {
      // 1. Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No user logged in");

      // 2. Read image as Base64
      // const base64 = await FileSystem.readAsStringAsync(photoUri, {
      //   encoding: "base64",
      // });

      const fileInstance = new File(photoUri);
      const base64 = await fileInstance.base64();

      // 3. Create a unique file path (User ID / Timestamp)
      const filePath = `${user.id}/${Date.now()}.jpg`;

      // 4. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, decode(base64), { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      Alert.alert("Success!", "Note saved to your study drive.");
      setPhotoUri(null); // Reset scanner
    } catch (error: any) {
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  if (photoUri) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        <View style={styles.actionRow}>
          <Button
            title="Discard"
            onPress={() => setPhotoUri(null)}
            color="#F44336"
          />
          {uploading ? (
            <ActivityIndicator color="#4A90E2" />
          ) : (
            <Button
              title="Save to Cloud"
              onPress={uploadPhoto}
              color="#4CAF50"
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back" ref={cameraRef} />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
          <View style={styles.captureInner} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  text: { textAlign: "center", marginBottom: 20, color: "white" },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 40,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "white",
  },
  preview: { flex: 1, resizeMode: "contain" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
    backgroundColor: "#222",
  },
});
