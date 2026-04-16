// app/(modals)/add-sleep.tsx
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createSleep } from '@/lib/health-api';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export default function AddSleepModal() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [bedTime, setBedTime] = useState(new Date(new Date().setHours(23, 0, 0, 0)));
  const [wakeTime, setWakeTime] = useState(new Date(new Date().setHours(7, 0, 0, 0)));
  const [quality, setQuality] = useState(7);
  const [interruptions, setInterruptions] = useState('');
  const [notes, setNotes] = useState('');

  const [showBedPicker, setShowBedPicker] = useState(false);
  const [showWakePicker, setShowWakePicker] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      return createSleep({
        date: todayStr(),
        bedTime: formatTime(bedTime),
        wakeTime: formatTime(wakeTime),
        quality,
        interruptions: interruptions ? parseInt(interruptions, 10) : undefined,
        notes: notes.trim() || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sleep'] });
      Alert.alert('✅ Успешно', 'Сон сохранён');
      router.back();
    },
    onError: () => {
      Alert.alert('❌ Ошибка', 'Не удалось сохранить сон. Проверьте данные.');
    },
  });

  const handleClose = () => router.back();

  const handleSave = () => {
    const bedMins = bedTime.getHours() * 60 + bedTime.getMinutes();
    const wakeMins = wakeTime.getHours() * 60 + wakeTime.getMinutes();
    let diff = wakeMins - bedMins;
    if (diff < 0) diff += 24 * 60;

    if (diff < 60) {
      Alert.alert('⚠️ Внимание', 'Время пробуждения должно быть минимум на 1 час позже отхода ко сну');
      return;
    }

    mutation.mutate();
  };

  const handleTimeChange = (setter: (date: Date) => void, showSetter: (show: boolean) => void) => 
    (_: any, selectedDate?: Date) => {
      if (Platform.OS === 'android') showSetter(false);
      if (selectedDate) setter(selectedDate);
    };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Добавить сон</Text>
        <TouchableOpacity onPress={handleClose} hitSlop={12}>
          <X size={28} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Отход ко сну</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={bedTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange(setBedTime, setShowBedPicker)}
                style={styles.timePicker}
                textColor="#f5f5f5"
              />
            ) : (
              <>
                <TouchableOpacity style={styles.timeButton} onPress={() => setShowBedPicker(true)}>
                  <Text style={styles.timeButtonText}>{formatTime(bedTime)}</Text>
                </TouchableOpacity>
                {showBedPicker && (
                  <DateTimePicker
                    value={bedTime}
                    mode="time"
                    is24Hour
                    onChange={handleTimeChange(setBedTime, setShowBedPicker)}
                  />
                )}
              </>
            )}
          </View>

          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Пробуждение</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={wakeTime}
                mode="time"
                display="spinner"
                onChange={handleTimeChange(setWakeTime, setShowWakePicker)}
                style={styles.timePicker}
                textColor="#f5f5f5"
              />
            ) : (
              <>
                <TouchableOpacity style={styles.timeButton} onPress={() => setShowWakePicker(true)}>
                  <Text style={styles.timeButtonText}>{formatTime(wakeTime)}</Text>
                </TouchableOpacity>
                {showWakePicker && (
                  <DateTimePicker
                    value={wakeTime}
                    mode="time"
                    is24Hour
                    onChange={handleTimeChange(setWakeTime, setShowWakePicker)}
                  />
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Качество сна (1–10)</Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={quality}
            onValueChange={setQuality}
            minimumTrackTintColor="#a3e635"
            maximumTrackTintColor="#27272a"
            thumbTintColor="#a3e635"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>Плохо</Text>
            <Text style={styles.sliderValue}>{quality}/10</Text>
            <Text style={styles.sliderLabel}>Отлично</Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Пробуждений за ночь</Text>
          <TextInput
            style={styles.input}
            value={interruptions}
            onChangeText={setInterruptions}
            placeholder="0"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Заметки</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Как спалось, что мешало..."
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveBtn, mutation.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text style={styles.saveBtnText}>СОХРАНИТЬ</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#f5f5f5' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  fieldHalf: { flex: 1 },
  field: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '500', color: '#9ca3af', marginBottom: 8 },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#f5f5f5',
  },
  textarea: { minHeight: 110, paddingTop: 14 },
  timePicker: { height: 130 },
  timeButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  timeButtonText: { fontSize: 18, fontWeight: '600', color: '#f5f5f5' },
  slider: { width: '100%', height: 40 },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sliderLabel: { fontSize: 13, color: '#6b7280' },
  sliderValue: { fontSize: 15, fontWeight: '700', color: '#f5f5f5' },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
  },
  saveBtn: {
    backgroundColor: '#a3e635',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#0a0a0a', letterSpacing: 0.5 },
});