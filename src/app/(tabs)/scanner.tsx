import { Ionicons } from "@expo/vector-icons";
import { decode } from "base64-arraybuffer";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

interface NoteItem {
  id: string;
  user_id: string;
  image_name: string;
  image_url: string;
  created_at: string;
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Notes list state
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Camera & capture state
  const [cameraVisible, setCameraVisible] = useState<boolean>(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [capturing, setCapturing] = useState<boolean>(false);

  // Name & save modal state (before uploading)
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [nameModalVisible, setNameModalVisible] = useState<boolean>(false);
  const [imageName, setImageName] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // Download & view modal state
  const [viewerVisible, setViewerVisible] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [downloadedUri, setDownloadedUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);

  const fetchNotes = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Authentication Error", "Please log in again.");
        return;
      }

      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes((data as NoteItem[]) || []);
    } catch (error: any) {
      Alert.alert(
        "Error Loading Notes",
        error.message || "Could not fetch scanned notes.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotes();
  };

  // 4. Open camera after checking runtime permissions
  const handleOpenCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Camera Permission Required",
          "Please enable camera access in your device settings to scan lecture notes.",
        );
        return;
      }
    }
    setCameraVisible(true);
  };

  // 4. Take picture and prompt for image name before saving
  const handleTakePicture = async () => {
    if (!cameraRef.current || capturing) return;

    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
      });

      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setImageName("");
        setCameraVisible(false);
        setNameModalVisible(true);
      }
    } catch (error: any) {
      Alert.alert(
        "Capture Failed",
        error.message || "Could not capture photo.",
      );
    } finally {
      setCapturing(false);
    }
  };

  // Compress image without losing readability (max width 1200px, 72% JPEG quality)
  const compressImage = async (uri: string): Promise<string> => {
    const context = ImageManipulator.manipulate(uri);
    const imageRef = await context.resize({ width: 1200 }).renderAsync();
    const result = await imageRef.saveAsync({
      compress: 0.72,
      format: SaveFormat.JPEG,
    });
    return result.uri;
  };

  // 4. Compress, upload to Supabase Storage, and insert into notes table
  const handleSaveNote = async () => {
    if (!capturedUri) return;

    if (!imageName.trim()) {
      Alert.alert(
        "Name Required",
        "Please enter a name for this scanned note.",
      );
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Authentication Error", "User session not found.");
        return;
      }

      // Step A: Compress & resize image
      const compressedUri = await compressImage(capturedUri);

      // Step B: Convert compressed file to base64 using modern expo-file-system File API
      const fileInstance = new File(compressedUri);
      const base64 = await fileInstance.base64();

      // Step C: Upload to 'notes' bucket
      const filePath = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("notes")
        .upload(filePath, decode(base64), {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Step D: Get public URL and save metadata to 'notes' table
      const { data: urlData } = supabase.storage
        .from("notes")
        .getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      const { data: insertedNote, error: dbError } = await supabase
        .from("notes")
        .insert([
          {
            user_id: user.id,
            image_name: imageName.trim(),
            image_url: publicUrl,
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      if (insertedNote) {
        setNotes((prev) => [insertedNote as NoteItem, ...prev]);
      } else {
        await fetchNotes();
      }

      // Clean up temporary captured files
      try {
        if (fileInstance.exists) fileInstance.delete();
        const rawFile = new File(capturedUri);
        if (rawFile.exists) rawFile.delete();
      } catch {
        // Ignore cache cleanup errors
      }

      setNameModalVisible(false);
      setCapturedUri(null);
      setImageName("");
    } catch (error: any) {
      Alert.alert(
        "Upload Failed",
        error.message || "Could not save scanned note.",
      );
    } finally {
      setSaving(false);
    }
  };

  // 2. Download and view actual image when list item is pressed
  const handleViewNote = async (note: NoteItem) => {
    setSelectedNote(note);
    setDownloadedUri(null);
    setViewerVisible(true);
    setDownloading(true);

    try {
      const localTarget = new File(Paths.cache, `note_${note.id}.jpg`);
      if (localTarget.exists) {
        localTarget.delete();
      }

      const downloadedFile = await File.downloadFileAsync(
        note.image_url,
        localTarget,
      );
      setDownloadedUri(downloadedFile.uri);
    } catch (error: any) {
      // Fallback to remote URL if local download encounters a network/cache issue
      setDownloadedUri(note.image_url);
      Alert.alert(
        "Download Warning",
        error.message || "Loaded image from remote URL.",
      );
    } finally {
      setDownloading(false);
    }
  };

  // Extract relative storage path from public URL for storage deletion
  const extractStoragePath = (publicUrl: string): string | null => {
    const marker = "/object/public/notes/";
    const index = publicUrl.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(publicUrl.substring(index + marker.length));
  };

  // 3. Delete note from database and storage
  const handleDeleteNote = (note: NoteItem) => {
    Alert.alert(
      "Delete Note",
      `Are you sure you want to delete "${note.image_name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const previousNotes = [...notes];
            setNotes((prev) => prev.filter((item) => item.id !== note.id));

            if (selectedNote?.id === note.id) {
              setViewerVisible(false);
              setSelectedNote(null);
              setDownloadedUri(null);
            }

            try {
              const { error: dbError } = await supabase
                .from("notes")
                .delete()
                .eq("id", note.id);

              if (dbError) throw dbError;

              // Remove image from Supabase Storage bucket as well
              const storagePath = extractStoragePath(note.image_url);
              if (storagePath) {
                await supabase.storage.from("notes").remove([storagePath]);
              }

              // Remove cached file if present
              const cachedFile = new File(Paths.cache, `note_${note.id}.jpg`);
              if (cachedFile.exists) {
                cachedFile.delete();
              }
            } catch (error: any) {
              setNotes(previousNotes);
              Alert.alert(
                "Delete Failed",
                error.message || "Could not delete note.",
              );
            }
          },
        },
      ],
    );
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const renderNoteItem = ({ item }: { item: NoteItem }) => (
    <TouchableOpacity
      style={styles.noteCard}
      onPress={() => handleViewNote(item)}
      activeOpacity={0.75}
    >
      <View style={styles.noteIconBox}>
        <Ionicons name="document-text-outline" size={24} color="#4F46E5" />
      </View>

      <View style={styles.noteInfo}>
        <Text style={styles.noteTitle} numberOfLines={1}>
          {item.image_name}
        </Text>
        <Text style={styles.noteSubtitle}>
          Scanned {formatDate(item.created_at)} • Tap to view
        </Text>
      </View>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDeleteNote(item)}
        accessibilityLabel={`Delete ${item.image_name}`}
      >
        <Ionicons name="trash-outline" size={20} color="#DC2626" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.container}>
        {/* Header with Take Picture Button */}
        <View style={styles.headerBar}>
          <Text style={styles.screenTitle}>Scanned Notes</Text>
          <TouchableOpacity
            style={styles.takePicBtn}
            onPress={handleOpenCamera}
          >
            <Ionicons name="camera" size={20} color="#FFFFFF" />
            <Text style={styles.takePicBtnText}>Take Picture</Text>
          </TouchableOpacity>
        </View>

        {/* Permission Warning Banner if explicitly denied */}
        {permission && !permission.granted && (
          <View style={styles.permissionBanner}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={styles.permissionBannerText}>
              Camera permission is required to scan notes.
            </Text>
            <TouchableOpacity onPress={requestPermission}>
              <Text style={styles.permissionLink}>Grant</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Notes List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={(item) => item.id}
            renderItem={renderNoteItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="scan-outline" size={52} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No Scanned Notes Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Tap "Take Picture" to capture and compress your lecture notes.
                </Text>
              </View>
            }
          />
        )}

        {/* Fullscreen Camera Modal */}
        <Modal
          visible={cameraVisible}
          animationType="slide"
          onRequestClose={() => setCameraVisible(false)}
        >
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} />

            <View style={styles.cameraOverlay} pointerEvents="box-none">
              <View style={styles.cameraTopBar}>
                <TouchableOpacity
                  style={styles.cameraCircleBtn}
                  onPress={() => setCameraVisible(false)}
                >
                  <Ionicons name="close" size={26} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cameraCircleBtn}
                  onPress={() =>
                    setFacing((prev) => (prev === "back" ? "front" : "back"))
                  }
                >
                  <Ionicons
                    name="camera-reverse-outline"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.cameraBottomBar}>
                <TouchableOpacity
                  style={[styles.shutterOuter, capturing && styles.disabledBtn]}
                  onPress={handleTakePicture}
                  disabled={capturing}
                >
                  {capturing ? (
                    <ActivityIndicator color="#4F46E5" />
                  ) : (
                    <View style={styles.shutterInner} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Ask Image Name & Save Modal */}
        <Modal
          visible={nameModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => !saving && setNameModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.nameModalCard}>
              <Text style={styles.modalTitle}>Name Your Scanned Note</Text>

              {capturedUri && (
                <Image
                  source={{ uri: capturedUri }}
                  style={styles.previewThumbnail}
                  resizeMode="cover"
                />
              )}

              <Text style={styles.inputLabel}>Image Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., CS301 Lecture 5 Diagram"
                placeholderTextColor="#9CA3AF"
                value={imageName}
                onChangeText={setImageName}
                autoFocus={true}
                editable={!saving}
              />

              <Text style={styles.compressHint}>
                Image will be automatically resized and compressed before
                upload.
              </Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  disabled={saving}
                  onPress={() => {
                    setNameModalVisible(false);
                    setCapturedUri(null);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Discard</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.disabledBtn]}
                  disabled={saving}
                  onPress={handleSaveNote}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveBtnText}>Compress & Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Download & View Actual Image Modal */}
        <Modal
          visible={viewerVisible}
          animationType="fade"
          transparent={false}
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={styles.viewerContainer}>
            <View style={styles.viewerHeader}>
              <TouchableOpacity
                style={styles.viewerIconBtn}
                onPress={() => setViewerVisible(false)}
              >
                <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <Text style={styles.viewerTitle} numberOfLines={1}>
                {selectedNote?.image_name || "Note Preview"}
              </Text>

              {selectedNote && (
                <TouchableOpacity
                  style={styles.viewerIconBtn}
                  onPress={() => handleDeleteNote(selectedNote)}
                >
                  <Ionicons name="trash-outline" size={22} color="#FCA5A5" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.viewerBody}>
              {downloading ? (
                <View style={styles.downloadingBox}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                  <Text style={styles.downloadingText}>
                    Downloading image...
                  </Text>
                </View>
              ) : downloadedUri ? (
                <Image
                  source={{ uri: downloadedUri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
    paddingTop: 16,
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
  takePicBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4F46E5",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
  },
  takePicBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
  },
  permissionLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4F46E5",
  },
  listContent: {
    paddingBottom: 96,
  },
  noteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  noteIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  noteInfo: {
    flex: 1,
    paddingRight: 8,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  noteSubtitle: {
    fontSize: 12,
    color: "#6B7280",
  },
  deleteBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  cameraTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  cameraCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBottomBar: {
    alignItems: "center",
    paddingBottom: 42,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },
  nameModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  previewThumbnail: {
    width: "100%",
    height: 180,
    borderRadius: 10,
    backgroundColor: "#E5E7EB",
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  compressHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
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
    minWidth: 130,
    alignItems: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: "#111827",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 48,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: "#1F2937",
  },
  viewerIconBtn: {
    padding: 6,
  },
  viewerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginHorizontal: 10,
  },
  viewerBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  downloadingBox: {
    alignItems: "center",
    gap: 12,
  },
  downloadingText: {
    color: "#D1D5DB",
    fontSize: 15,
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
});
