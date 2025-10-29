import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

function formatMinutes(minutes: number, allowOff: boolean) {
  if (allowOff && minutes === 0) return "Off";
  return `${minutes} min`;
}

type Props = {
  label: string;
  helper: string;
  value: number;
  options: number[];
  allowOff?: boolean;
  min?: number;
  max?: number;
  onChange: (minutes: number) => void;
};

export default function TimeSelectField({
  label,
  helper,
  value,
  options,
  allowOff = false,
  min,
  max,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(String(value));
  const inputRef = useRef<TextInput>(null);

  const minBound = allowOff ? min ?? 0 : min ?? 1;
  const optionMax = options.length ? Math.max(...options) : minBound;
  const maxBound = max ?? Math.max(optionMax, minBound);

  const clamp = (minutes: number) => {
    if (!Number.isFinite(minutes)) return minBound;
    let next = Math.round(minutes);
    if (allowOff && next < 0) next = 0;
    if (!allowOff && next <= 0) next = minBound;
    next = Math.max(next, minBound);
    next = Math.min(next, maxBound);
    return next;
  };

  const display = useMemo(() => formatMinutes(value, allowOff), [value, allowOff]);

  const optionList = useMemo(() => {
    if (allowOff && !options.includes(0)) {
      return [0, ...options];
    }
    return options;
  }, [allowOff, options]);

  const openPicker = () => {
    setCustom(String(value));
    setOpen(true);
  };

  const sanitize = (raw: string) => {
    const cleaned = raw.replace(/[^0-9]/g, "");
    if (!cleaned) return allowOff ? 0 : minBound;
    const parsed = Number.parseInt(cleaned, 10);
    if (allowOff && parsed === 0) return 0;
    return clamp(parsed);
  };

  const handleSelect = (minutes: number) => {
    onChange(minutes);
    setOpen(false);
  };

  const applyCustom = () => {
    const minutes = sanitize(custom);
    setCustom(String(minutes));
    onChange(minutes);
    setOpen(false);
  };

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [open]);

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.field} onPress={openPicker}>
        <View>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.helper}>{helper}</Text>
        </View>
        <Text style={styles.value}>{display}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.optionContainer}>
              {optionList.map((minutes) => {
                const normalized = clamp(minutes);
                const active = normalized === value;
                return (
                  <Pressable
                    key={minutes}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => handleSelect(normalized)}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>
                      {formatMinutes(normalized, allowOff)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <TextInput
                ref={inputRef}
                value={custom}
                onChangeText={setCustom}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholder="minutes"
                style={styles.customInput}
              />
              <Pressable
                style={styles.customApply}
                onPress={applyCustom}
              >
                <Text style={styles.customApplyText}>Apply</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  field: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.2)",
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  helper: {
    marginTop: 4,
    color: "#64748B",
    fontSize: 13,
  },
  value: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1976D2",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 18,
    paddingBottom: 32,
    paddingHorizontal: 20,
    gap: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  optionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  option: {
    minWidth: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  optionActive: {
    borderColor: "#1976D2",
    backgroundColor: "rgba(25,118,210,0.12)",
  },
  optionText: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "500",
  },
  optionTextActive: {
    color: "#1976D2",
    fontWeight: "700",
  },
  customRow: {
    marginTop: 20,
    flexDirection: "row",
    gap: 12,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.28)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#0F172A",
  },
  customApply: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F57C00",
  },
  customApplyText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
