// app/game-court/index.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  Animated,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { loadJSON, removeJSON, saveJSON } from "../../lib/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Enhanced device detection
const isSmallDevice = SCREEN_WIDTH < 375;
const isTinyDevice = SCREEN_WIDTH < 350;
const isShortDevice = SCREEN_HEIGHT < 700;
const isTablet = SCREEN_WIDTH >= 768;
const isLargeTablet = SCREEN_WIDTH >= 1024;

// Improved responsive scaling
const scale = (size: number) => {
  if (isLargeTablet) return size * 1.4;
  if (isTablet) return size * 1.2;
  const ratio = SCREEN_WIDTH / 375;
  const clamped = Math.max(0.85, Math.min(ratio, 1.15));
  return size * clamped;
};

const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// ----------------------
// CONFIG & HELPERS
// ----------------------

const KEYS = {
  playersDB: "playersDB",
  selectedToday: "selectedPlayers",
  gameSettings: "gameSettings",
  lineup: "gameLineup",
  gameHistory: "gameHistory",
  livePreview: "liveGamePreview",
  ongoingGame: "ongoingGameState",
};

const DEFAULT_HALF_MINUTES = 18;
const DEFAULT_QUARTER_MINUTES = 8;
const DEFAULT_SUB_INTERVAL_MINUTES = 4;
const DEFAULT_HALF_LENGTH_SECONDS = DEFAULT_HALF_MINUTES * 60;
const DEFAULT_SUB_INTERVAL_SECONDS = DEFAULT_SUB_INTERVAL_MINUTES * 60;
const DEFAULT_SUB_WARNING_SECONDS = 30;

type Player = { id: string; name: string };

type ManualSwapDraft = {
  reason: string;
  incoming?: Player;
  outgoing?: Player;
};

type ManualPromptConfig =
  | { type: "starterReason"; player: Player }
  | { type: "benchReason"; player: Player }
  | { type: "confirm"; incoming: Player; outgoing: Player; reason: string };

type SavedPlayerSnapshot = {
  id: string;
  name: string;
  seconds: number;
  subs: number;
};

type LayoutBox = {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
};

type SavedGameSnapshot = {
  id: string;
  practiceDate: string;
  startedAt: number;
  endedAt: number;
  totalGameSeconds: number;
  players: SavedPlayerSnapshot[];
};

type PersistedGameState = {
  version: number;
  savedAt: number;
  starters: Player[];
  bench: Player[];
  initialRoster: Player[];
  pendingIn: Player | null;
  pendingOut: Player | null;
  subCountdownActive: boolean;
  subWindowClock: number;
  gameClock: number;
  isPaused: boolean;
  pauseReason: "quarter" | "half" | "end" | null;
  quarterPauseTriggered: boolean;
  lastQuarterLabel: string | null;
  lastHalfLabel: string | null;
  breakOverlayDismissed: boolean;
  halfLengthSeconds: number;
  subIntervalSeconds: number;
  subWarningSeconds: number;
  quarterBreakSeconds: number;
  quarterCounter: number;
  halfCounter: number;
  playerCourtSeconds: [string, number][];
  playerSubCounts: [string, number][];
  gameStartTimestamp: number;
  gameEnded: boolean;
  latestSavedGameId: string | null;
};

const CURRENT_GAME_STATE_VERSION = 1;

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

const UI = {
  pad: isLargeTablet ? 32 : isTablet ? 28 : isTinyDevice ? 16 : 24,
  cardRadius: isTablet ? 28 : 24,
  chipRadius: 999,
  avatar: moderateScale(48),
};

const COLORS = {
  bg: "#F1F5F9",
  card: "#FFFFFF",
  border: "rgba(15,23,42,0.08)",
  text: "#0F172A",
  textMuted: "#64748B",
  accent: "#2563EB",
  accentStrong: "#1E40AF",
  accentSoft: "rgba(37,99,235,0.08)",
  warn: "#F59E0B",
  warnBg: "rgba(245,158,11,0.12)",
  danger: "#EF4444",
  dangerBg: "rgba(239,68,68,0.1)",
  success: "#10B981",
  successBg: "rgba(16,185,129,0.12)",
  avatar: "#E2E8F0",
  courtBg: "rgba(37,99,235,0.03)",
};

const starterPositions: {
  top: number;
  left: number | "50%";
  right?: number;
}[] = [
  { top: moderateScale(20), left: moderateScale(30) },
  { top: moderateScale(20), left: moderateScale(isTablet ? 280 : 240) },
  { top: moderateScale(100), left: moderateScale(60) },
  { top: moderateScale(100), left: moderateScale(isTablet ? 250 : 210) },
  { top: moderateScale(170), left: "50%" },
];

export default function GameCourtScreen() {
  // ----------------------
  // STATE
  // ----------------------

  const [starters, setStarters] = useState<Player[]>([]);
  const [bench, setBench] = useState<Player[]>([]);
  const [manualSwapDraft, setManualSwapDraft] = useState<ManualSwapDraft | null>(null);
  const [manualPrompt, setManualPrompt] = useState<ManualPromptConfig | null>(null);
  const manualSwapActive = manualSwapDraft !== null;
  const waitingForIncoming = !!manualSwapDraft?.outgoing && !manualSwapDraft?.incoming;
  const waitingForOutgoing = !!manualSwapDraft?.incoming && !manualSwapDraft?.outgoing;
  const manualSwapReason = manualSwapDraft?.reason ?? null;
  const manualSwapIncomingName = manualSwapDraft?.incoming?.name ?? null;
  const manualSwapOutgoingName = manualSwapDraft?.outgoing?.name ?? null;
  const [draggingPlayer, setDraggingPlayer] = useState<Player | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [dragHoverTargetId, setDragHoverTargetId] = useState<string | null>(null);
  const dragOriginRef = useRef<"bench" | null>(null);
  const courtItemRefs = useRef<Map<string, View | null>>(new Map());
  const courtLayoutsRef = useRef<Map<string, LayoutBox>>(new Map());
  const quarterCounterRef = useRef(1);
  const [lastQuarterLabel, setLastQuarterLabel] = useState<string | null>(null);
  const halfCounterRef = useRef(1);
  const [lastHalfLabel, setLastHalfLabel] = useState<string | null>(null);
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const [breakOverlayDismissed, setBreakOverlayDismissed] = useState(false);
  const playerSubCountRef = useRef<Map<string, number>>(new Map());
  const initialRosterRef = useRef<Player[]>([]);
  const gameStartTimestampRef = useRef<number>(Date.now());
  const gameEndedRef = useRef(false);
  const latestSavedGameIdRef = useRef<string | null>(null);
  const gameInitializedRef = useRef(false);
  const [gameReady, setGameReady] = useState(false);
  const saveCurrentGameStateRef = useRef<(() => Promise<void>) | null>(null);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const { finalize: finalizeParam } = useLocalSearchParams<{ finalize?: string }>();
  const finalizeOnLoadRef = useRef(
    Array.isArray(finalizeParam)
      ? finalizeParam.includes("1") || finalizeParam.includes("true")
      : finalizeParam === "1" || finalizeParam === "true"
  );

  const [halfLengthSeconds, setHalfLengthSeconds] = useState(DEFAULT_HALF_LENGTH_SECONDS);
  const [subIntervalSeconds, setSubIntervalSeconds] = useState(DEFAULT_SUB_INTERVAL_SECONDS);
  const [subWarningSeconds, setSubWarningSeconds] = useState(DEFAULT_SUB_WARNING_SECONDS);
  const [quarterBreakSeconds, setQuarterBreakSeconds] = useState<number>(0);

  const [gameClock, setGameClock] = useState<number>(halfLengthSeconds);
  const [subWindowClock, setSubWindowClock] = useState<number>(subIntervalSeconds);
  const gameClockRef = useRef<number>(halfLengthSeconds);
  const subWindowClockRef = useRef<number>(subIntervalSeconds);
  const lastTickTimestampRef = useRef<number>(Date.now());

  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [pendingIn, setPendingIn] = useState<Player | null>(null);
  const [pendingOut, setPendingOut] = useState<Player | null>(null);
  const [subCountdownActive, setSubCountdownActive] = useState<boolean>(false);
  const [pauseReason, setPauseReason] = useState<"quarter" | "half" | "end" | null>(null);
  const [quarterPauseTriggered, setQuarterPauseTriggered] = useState<boolean>(false);
  const showPauseOverlay =
    !breakOverlayDismissed &&
    (pauseReason === "quarter" || pauseReason === "half" || pauseReason === "end");

  useEffect(() => {
    gameClockRef.current = gameClock;
  }, [gameClock]);

  useEffect(() => {
    subWindowClockRef.current = subWindowClock;
  }, [subWindowClock]);

  useEffect(() => {
    if (showPauseOverlay) {
      overlayAnim.setValue(0);
      Animated.spring(overlayAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }).start();
    } else {
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showPauseOverlay, overlayAnim]);

  useEffect(() => {
    if (pauseReason === null) {
      setBreakOverlayDismissed(false);
    }
  }, [pauseReason]);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const playerCourtSecondsRef = useRef<Map<string, number>>(new Map());
  const startersRef = useRef<Player[]>([]);

  const registerCourtItem = useCallback(
    (playerId: string) => (node: View | null) => {
      if (node) {
        courtItemRefs.current.set(playerId, node);
        requestAnimationFrame(() => {
          const measurable = node as unknown as {
            measureInWindow: (
              callback: (pageX: number, pageY: number, width: number, height: number) => void
            ) => void;
          };
          measurable.measureInWindow((pageX, pageY, width, height) => {
            courtLayoutsRef.current.set(playerId, { pageX, pageY, width, height });
          });
        });
      } else {
        courtItemRefs.current.delete(playerId);
        courtLayoutsRef.current.delete(playerId);
      }
    },
    []
  );

  const refreshCourtLayout = useCallback((playerId: string) => {
    const node = courtItemRefs.current.get(playerId);
    if (!node) return;
    const measurable = node as unknown as {
      measureInWindow: (
        callback: (pageX: number, pageY: number, width: number, height: number) => void
      ) => void;
    };
    measurable.measureInWindow((pageX, pageY, width, height) => {
      courtLayoutsRef.current.set(playerId, { pageX, pageY, width, height });
    });
  }, []);

  const findCourtTarget = useCallback((pageX: number, pageY: number) => {
    for (const [playerId, box] of courtLayoutsRef.current.entries()) {
      if (
        pageX >= box.pageX &&
        pageX <= box.pageX + box.width &&
        pageY >= box.pageY &&
        pageY <= box.pageY + box.height
      ) {
        return playerId;
      }
    }
    return null;
  }, []);

  const resetDragState = useCallback(() => {
    setDraggingPlayer(null);
    setDragPosition(null);
    setDragHoverTargetId(null);
    dragOriginRef.current = null;
  }, []);

  // ----------------------
  // GAME HELPERS
  // ----------------------

  const applyElapsedSeconds = useCallback(
    (deltaSeconds: number) => {
      if (deltaSeconds <= 0) return;

      const newGameClock = Math.max(0, gameClockRef.current - deltaSeconds);
      gameClockRef.current = newGameClock;
      setGameClock(newGameClock);

      const newSubWindowClock = Math.max(0, subWindowClockRef.current - deltaSeconds);
      subWindowClockRef.current = newSubWindowClock;
      setSubWindowClock(newSubWindowClock);

      const secondsMap = playerCourtSecondsRef.current;
      startersRef.current.forEach((player) => {
        const prevSeconds = secondsMap.get(player.id) ?? 0;
        secondsMap.set(player.id, prevSeconds + deltaSeconds);
      });
    },
    []
  );

  const flushElapsedTime = useCallback(() => {
    const now = Date.now();
    if (isPaused || gameEndedRef.current) {
      lastTickTimestampRef.current = now;
      return;
    }
    const deltaSeconds = Math.floor((now - lastTickTimestampRef.current) / 1000);
    if (deltaSeconds <= 0) {
      return;
    }
    applyElapsedSeconds(deltaSeconds);
    lastTickTimestampRef.current += deltaSeconds * 1000;
  }, [applyElapsedSeconds, isPaused]);

  const getCourtSeconds = useCallback((player: Player | null | undefined) => {
    if (!player) return 0;
    return playerCourtSecondsRef.current.get(player.id) ?? 0;
  }, []);

  const pickPendingSwap = useCallback(
    (onCourt: Player[], bnch: Player[]) => {
      if (onCourt.length === 0 || bnch.length === 0) {
        return { incoming: null, outgoing: null };
      }

      const incomingCandidates = [...bnch].sort(
        (a, b) => getCourtSeconds(a) - getCourtSeconds(b)
      );
      const outgoingCandidates = [...onCourt].sort(
        (a, b) => getCourtSeconds(b) - getCourtSeconds(a)
      );

      const incoming = incomingCandidates[0] ?? null;
      const outgoing = outgoingCandidates[0] ?? null;

      if (!incoming || !outgoing) {
        return { incoming: null, outgoing: null };
      }

      return { incoming, outgoing };
    },
    [getCourtSeconds]
  );

  const performSub = useCallback(
    (override?: { incoming: Player; outgoing: Player }) => {
      const incomingPlayer = override?.incoming ?? pendingIn;
      const outgoingPlayer = override?.outgoing ?? pendingOut;

      if (!incomingPlayer || !outgoingPlayer) return;

      const subsMap = playerSubCountRef.current;
      subsMap.set(incomingPlayer.id, (subsMap.get(incomingPlayer.id) ?? 0) + 1);
      subsMap.set(outgoingPlayer.id, (subsMap.get(outgoingPlayer.id) ?? 0) + 1);

      setStarters((prevStarters) => {
        const withoutOut = prevStarters.filter((p) => p.id !== outgoingPlayer.id);
        return [...withoutOut, incomingPlayer];
      });

      setBench((prevBench) => {
        const withoutIn = prevBench.filter((p) => p.id !== incomingPlayer.id);
        return [...withoutIn, outgoingPlayer];
      });
    },
    [pendingIn, pendingOut]
  );

  const persistGameHistory = useCallback(async () => {
    const roster = initialRosterRef.current;
    if (!roster || roster.length === 0) return null;

    const secondsMap = playerCourtSecondsRef.current;
    const subsMap = playerSubCountRef.current;

    const playerSnapshots: SavedPlayerSnapshot[] = roster.map((player) => ({
      id: player.id,
      name: player.name,
      seconds: secondsMap.get(player.id) ?? 0,
      subs: subsMap.get(player.id) ?? 0,
    }));

    const endedAt = Date.now();
    const practiceDate = new Date(endedAt).toISOString().slice(0, 10);
    const record: SavedGameSnapshot = {
      id: `${endedAt}`,
      practiceDate,
      startedAt: gameStartTimestampRef.current,
      endedAt,
      totalGameSeconds: Math.max(
        1,
        Math.round((endedAt - gameStartTimestampRef.current) / 1000)
      ),
      players: playerSnapshots,
    };

    const existing = await loadJSON<SavedGameSnapshot[]>(KEYS.gameHistory, []);
    const updated = [record, ...existing];
    await saveJSON(KEYS.gameHistory, updated);
    await removeJSON(KEYS.livePreview);
    await removeJSON(KEYS.ongoingGame);
    latestSavedGameIdRef.current = record.id;
    return record.id;
  }, []);

  const buildCurrentGameSnapshot = useCallback((): SavedGameSnapshot | null => {
    const roster = initialRosterRef.current;
    if (!roster || roster.length === 0) return null;

    const secondsMap = playerCourtSecondsRef.current;
    const subsMap = playerSubCountRef.current;
    const now = Date.now();
    const practiceDate = new Date(gameStartTimestampRef.current)
      .toISOString()
      .slice(0, 10);

    const players: SavedPlayerSnapshot[] = roster.map((player) => ({
      id: player.id,
      name: player.name,
      seconds: secondsMap.get(player.id) ?? 0,
      subs: subsMap.get(player.id) ?? 0,
    }));

    const totalGameSeconds = Math.max(
      1,
      Math.round((now - gameStartTimestampRef.current) / 1000)
    );

    return {
      id: "live",
      practiceDate,
      startedAt: gameStartTimestampRef.current,
      endedAt: now,
      totalGameSeconds,
      players,
    };
  }, []);

  const openStatsForCurrentGame = useCallback(async () => {
    flushElapsedTime();
    const snapshot = buildCurrentGameSnapshot();
    if (!snapshot) {
      router.push("/game-stat");
      return;
    }
    await saveJSON(KEYS.livePreview, snapshot);
    router.push({ pathname: "/game-stat", params: { live: "1" } });
  }, [buildCurrentGameSnapshot, flushElapsedTime]);

  const openStatsScreen = useCallback(() => {
    if (!gameEndedRef.current) {
      void openStatsForCurrentGame();
      return;
    }
    const savedId = latestSavedGameIdRef.current;
    if (savedId) {
      router.push({ pathname: "/game-stat", params: { gameId: savedId } });
    } else {
      router.push("/game-stat");
    }
  }, [openStatsForCurrentGame]);

  const restoreFromPersisted = useCallback(
    (state: PersistedGameState) => {
      const startersList = state.starters ?? [];
      const benchList = state.bench ?? [];
      const initialRoster =
        state.initialRoster && state.initialRoster.length > 0
          ? state.initialRoster
          : [...startersList, ...benchList];
      const startersClone = startersList.map((player) => ({ ...player }));
      const benchClone = benchList.map((player) => ({ ...player }));
      const initialRosterClone = initialRoster.map((player) => ({ ...player }));

      initialRosterRef.current = initialRosterClone;
      startersRef.current = startersClone;
      playerCourtSecondsRef.current = new Map(state.playerCourtSeconds ?? []);
      playerSubCountRef.current = new Map(state.playerSubCounts ?? []);
      quarterCounterRef.current = state.quarterCounter ?? 1;
      halfCounterRef.current = state.halfCounter ?? 1;
      gameStartTimestampRef.current = state.gameStartTimestamp ?? Date.now();
      gameEndedRef.current = state.gameEnded ?? false;
      latestSavedGameIdRef.current = state.latestSavedGameId ?? null;

      setStarters(startersClone);
      setBench(benchClone);
      setPendingIn(state.pendingIn ? { ...state.pendingIn } : null);
      setPendingOut(state.pendingOut ? { ...state.pendingOut } : null);
      setSubCountdownActive(state.subCountdownActive ?? false);

      const fallbackSubWindow = state.subIntervalSeconds ?? DEFAULT_SUB_INTERVAL_SECONDS;
      const fallbackGameClock = state.halfLengthSeconds ?? DEFAULT_HALF_LENGTH_SECONDS;
      const restoredSubWindow =
        typeof state.subWindowClock === "number" ? state.subWindowClock : fallbackSubWindow;
      const restoredGameClock =
        typeof state.gameClock === "number" ? state.gameClock : fallbackGameClock;

      subWindowClockRef.current = restoredSubWindow;
      setSubWindowClock(restoredSubWindow);
      gameClockRef.current = restoredGameClock;
      setGameClock(restoredGameClock);

      const storedIsPaused = state.isPaused ?? false;
      setIsPaused(storedIsPaused);
      setPauseReason(state.pauseReason ?? null);
      setQuarterPauseTriggered(state.quarterPauseTriggered ?? false);
      setLastQuarterLabel(state.lastQuarterLabel ?? null);
      setLastHalfLabel(state.lastHalfLabel ?? null);
      setBreakOverlayDismissed(state.breakOverlayDismissed ?? false);
      setManualSwapDraft(null);
      setManualPrompt(null);

      setHalfLengthSeconds(
        typeof state.halfLengthSeconds === "number"
          ? state.halfLengthSeconds
          : DEFAULT_HALF_LENGTH_SECONDS
      );
      setSubIntervalSeconds(
        typeof state.subIntervalSeconds === "number"
          ? state.subIntervalSeconds
          : DEFAULT_SUB_INTERVAL_SECONDS
      );
      setSubWarningSeconds(
        typeof state.subWarningSeconds === "number"
          ? state.subWarningSeconds
          : DEFAULT_SUB_WARNING_SECONDS
      );
      setQuarterBreakSeconds(
        typeof state.quarterBreakSeconds === "number" ? state.quarterBreakSeconds : 0
      );

      const now = Date.now();
      if (!state.gameEnded && !storedIsPaused) {
        const savedAt = state.savedAt ?? now;
        const elapsedSeconds = Math.max(0, Math.floor((now - savedAt) / 1000));
        if (elapsedSeconds > 0) {
          const adjustedGame = Math.max(0, gameClockRef.current - elapsedSeconds);
          gameClockRef.current = adjustedGame;
          setGameClock(adjustedGame);

          const adjustedSub = Math.max(0, subWindowClockRef.current - elapsedSeconds);
          subWindowClockRef.current = adjustedSub;
          setSubWindowClock(adjustedSub);

          const secondsMap = playerCourtSecondsRef.current;
          startersClone.forEach((player) => {
            const prevSeconds = secondsMap.get(player.id) ?? 0;
            secondsMap.set(player.id, prevSeconds + elapsedSeconds);
          });
        }
      }
      lastTickTimestampRef.current = Date.now();
    },
    []
  );

  const triggerSaveCurrentGameState = useCallback(() => {
    const fn = saveCurrentGameStateRef.current;
    if (fn) {
      void fn();
    }
  }, []);

  const finalizeGame = useCallback(() => {
    if (gameEndedRef.current) return;
    flushElapsedTime();
    gameEndedRef.current = true;
    setIsPaused(true);
    setGameReady(false);
    setPendingIn(null);
    setPendingOut(null);
    setSubCountdownActive(false);
    setManualSwapDraft(null);
    setManualPrompt(null);
    setSubWindowClock(subIntervalSeconds);
    subWindowClockRef.current = subIntervalSeconds;
    setPauseReason("end");
    setBreakOverlayDismissed(false);
    setQuarterPauseTriggered(false);
    setLastQuarterLabel(null);
    setLastHalfLabel(null);
    void persistGameHistory();
    lastTickTimestampRef.current = Date.now();
  }, [flushElapsedTime, persistGameHistory, subIntervalSeconds]);

  // Save function
  saveCurrentGameStateRef.current = async () => {
    if (!gameInitializedRef.current) return;
    flushElapsedTime();
    const savedAt = Date.now();
    if (gameEndedRef.current) {
      await removeJSON(KEYS.ongoingGame);
      return;
    }
    const payload: PersistedGameState = {
      version: CURRENT_GAME_STATE_VERSION,
      savedAt,
      starters: starters.map((player) => ({ ...player })),
      bench: bench.map((player) => ({ ...player })),
      initialRoster: initialRosterRef.current.map((player) => ({ ...player })),
      pendingIn: pendingIn ? { ...pendingIn } : null,
      pendingOut: pendingOut ? { ...pendingOut } : null,
      subCountdownActive,
      subWindowClock: subWindowClockRef.current,
      gameClock: gameClockRef.current,
      isPaused,
      pauseReason,
      quarterPauseTriggered,
      lastQuarterLabel,
      lastHalfLabel,
      breakOverlayDismissed,
      halfLengthSeconds,
      subIntervalSeconds,
      subWarningSeconds,
      quarterBreakSeconds,
      quarterCounter: quarterCounterRef.current,
      halfCounter: halfCounterRef.current,
      playerCourtSeconds: Array.from(playerCourtSecondsRef.current.entries()),
      playerSubCounts: Array.from(playerSubCountRef.current.entries()),
      gameStartTimestamp: gameStartTimestampRef.current,
      gameEnded: gameEndedRef.current,
      latestSavedGameId: latestSavedGameIdRef.current,
    };
    await saveJSON(KEYS.ongoingGame, payload);
  };

  // ----------------------
  // LOAD INITIAL DATA
  // ----------------------
  useEffect(() => {
    let isActive = true;
    (async () => {
      const persisted = await loadJSON<PersistedGameState | null>(KEYS.ongoingGame, null);
      if (!isActive) return;

      if (
        persisted &&
        persisted.version === CURRENT_GAME_STATE_VERSION &&
        !persisted.gameEnded
      ) {
        restoreFromPersisted(persisted);
        gameInitializedRef.current = true;
        setGameReady(true);
        setRestoreComplete(true);
        await removeJSON(KEYS.livePreview);
        return;
      }

      if (persisted && persisted.gameEnded) {
        await removeJSON(KEYS.ongoingGame);
      }

      await removeJSON(KEYS.livePreview);

      const allPlayers = (await loadJSON<Player[]>(KEYS.playersDB, [])) ?? ([] as Player[]);
      const todaysIds = (await loadJSON<string[]>(KEYS.selectedToday, [])) ?? ([] as string[]);
      const todaysPlayers = allPlayers.filter((p) => todaysIds.includes(p.id));

      const storedLineup =
        (await loadJSON<{ starters: string[]; bench: string[] } | null>(
          KEYS.lineup,
          null
        )) ?? null;

      const playerMap = new Map(todaysPlayers.map((p) => [p.id, p]));
      const baseOrderIds = todaysPlayers.map((p) => p.id);
      const storedOrderIds = storedLineup
        ? [...storedLineup.starters, ...storedLineup.bench, ...baseOrderIds]
        : baseOrderIds;

      const orderedPlayers: Player[] = [];
      const seen = new Set<string>();
      for (const id of storedOrderIds) {
        const player = playerMap.get(id);
        if (player && !seen.has(id)) {
          seen.add(id);
          orderedPlayers.push(player);
        }
      }

      const startersList = orderedPlayers.slice(0, 5);
      const benchList = orderedPlayers.slice(5);

      gameStartTimestampRef.current = Date.now();
      gameEndedRef.current = false;
      latestSavedGameIdRef.current = null;
      setPauseReason(null);
      setBreakOverlayDismissed(false);
      setLastQuarterLabel(null);
      setLastHalfLabel(null);
      setManualSwapDraft(null);
      setManualPrompt(null);
      quarterCounterRef.current = 1;
      halfCounterRef.current = 1;

      const secondsMap = new Map<string, number>();
      const subsMap = new Map<string, number>();
      orderedPlayers.forEach((player) => {
        secondsMap.set(player.id, 0);
        subsMap.set(player.id, 0);
      });
      playerCourtSecondsRef.current = secondsMap;
      playerSubCountRef.current = subsMap;
      initialRosterRef.current = orderedPlayers;
      startersRef.current = startersList;

      setStarters(startersList);
      setBench(benchList);

      type StoredGameSettings = {
        halfLengthSeconds?: number;
        subIntervalSeconds?: number;
        subWarningSeconds?: number;
        halfTime?: number;
        quarterTime?: number;
        subsTime?: number;
      };

      const settings = (await loadJSON(KEYS.gameSettings, null)) as StoredGameSettings | null;

      const halfMinutes =
        typeof settings?.halfLengthSeconds === "number"
          ? settings.halfLengthSeconds / 60
          : Number(settings?.halfTime ?? DEFAULT_HALF_MINUTES);
      const subsMinutes =
        typeof settings?.subIntervalSeconds === "number"
          ? settings.subIntervalSeconds / 60
          : Number(settings?.subsTime ?? DEFAULT_SUB_INTERVAL_MINUTES);
      const quarterMinutes =
        typeof settings?.quarterTime === "number"
          ? settings.quarterTime
          : DEFAULT_QUARTER_MINUTES;

      const halfSeconds = Math.max(60, Math.round(halfMinutes * 60));
      const subsSeconds = Math.max(30, Math.round(subsMinutes * 60));
      const quarterSeconds = Math.max(0, Math.round(quarterMinutes * 60));

      setHalfLengthSeconds(halfSeconds);
      const warnSeconds =
        typeof settings?.subWarningSeconds === "number"
          ? settings.subWarningSeconds
          : DEFAULT_SUB_WARNING_SECONDS;

      setSubIntervalSeconds(subsSeconds);
      setSubWarningSeconds(warnSeconds);
      setQuarterBreakSeconds(quarterSeconds);
      setQuarterPauseTriggered(false);
      setPauseReason(null);
      quarterCounterRef.current = 1;
      halfCounterRef.current = 1;
      setLastQuarterLabel(null);
      setLastHalfLabel(null);

      setGameClock(halfSeconds);
      setSubWindowClock(subsSeconds);
      setIsPaused(false);
      gameClockRef.current = halfSeconds;
      subWindowClockRef.current = subsSeconds;
      lastTickTimestampRef.current = Date.now();

      gameInitializedRef.current = true;
      setGameReady(true);
      setRestoreComplete(true);
    })();
    return () => {
      isActive = false;
    };
  }, [restoreFromPersisted]);

  useEffect(() => {
    if (!gameReady) return;
    const interval = setInterval(() => {
      triggerSaveCurrentGameState();
    }, 5000);
    return () => clearInterval(interval);
  }, [gameReady, triggerSaveCurrentGameState]);

  useEffect(() => {
    return () => {
      if (!gameEndedRef.current) {
        flushElapsedTime();
        triggerSaveCurrentGameState();
      }
    };
  }, [flushElapsedTime, triggerSaveCurrentGameState]);

  useFocusEffect(
    useCallback(() => {
      flushElapsedTime();
      return () => {
        flushElapsedTime();
        if (!gameEndedRef.current) {
          triggerSaveCurrentGameState();
        }
      };
    }, [flushElapsedTime, triggerSaveCurrentGameState])
  );

  useEffect(() => {
    if (!gameReady) return;
    const handleAppStateChange = (status: AppStateStatus) => {
      if (status === "background" || status === "inactive") {
        flushElapsedTime();
        if (!gameEndedRef.current) {
          triggerSaveCurrentGameState();
        }
      } else if (status === "active") {
        flushElapsedTime();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [flushElapsedTime, gameReady, triggerSaveCurrentGameState]);

  useEffect(() => {
    if (!restoreComplete) return;
    if (finalizeOnLoadRef.current) {
      finalizeOnLoadRef.current = false;
      finalizeGame();
    }
  }, [restoreComplete, finalizeGame]);

  useEffect(() => {
    startersRef.current = starters;
    const roster = [...starters, ...bench];
    const secondsMap = playerCourtSecondsRef.current;
    const subsMap = playerSubCountRef.current;

    const knownIds = new Set(initialRosterRef.current.map((p) => p.id));
    const updatedRoster = [...initialRosterRef.current];

    roster.forEach((player) => {
      if (!secondsMap.has(player.id)) {
        secondsMap.set(player.id, 0);
      }
      if (!subsMap.has(player.id)) {
        subsMap.set(player.id, 0);
      }
      if (!knownIds.has(player.id)) {
        knownIds.add(player.id);
        updatedRoster.push(player);
      }
    });

    for (const id of Array.from(secondsMap.keys())) {
      if (!roster.find((p) => p.id === id)) {
        secondsMap.delete(id);
      }
    }

    initialRosterRef.current = updatedRoster;
  }, [starters, bench]);

  // ----------------------
  // GAME LOOP TICK
  // ----------------------
  useEffect(() => {
    if (isPaused) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      lastTickTimestampRef.current = Date.now();
      return;
    }

    if (tickRef.current) return;

    lastTickTimestampRef.current = Date.now();
    tickRef.current = setInterval(() => {
      flushElapsedTime();
    }, 500);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [flushElapsedTime, isPaused]);

  useEffect(() => {
    if (gameClock <= 0) {
      if (!isPaused) {
        setIsPaused(true);
        const halfLabel = `Half ${halfCounterRef.current}`;
        setLastHalfLabel(halfLabel);
        const isFinalHalf = halfCounterRef.current >= 2;

        setPendingIn(null);
        setPendingOut(null);
        setSubCountdownActive(false);
        setManualSwapDraft(null);
        setManualPrompt(null);
        setQuarterPauseTriggered(false);
        setBreakOverlayDismissed(false);

        if (isFinalHalf) {
          quarterCounterRef.current = 1;
          finalizeGame();
        } else {
          setPauseReason("half");
          setSubWindowClock(subIntervalSeconds);
          subWindowClockRef.current = subIntervalSeconds;
          quarterCounterRef.current = 1;
          const plan = pickPendingSwap(starters, bench);
          if (plan.incoming || plan.outgoing) {
            setPendingIn(plan.incoming ?? null);
            setPendingOut(plan.outgoing ?? null);
          }
        }

        halfCounterRef.current += 1;
      }
    }
  }, [gameClock, isPaused, subIntervalSeconds, finalizeGame, pickPendingSwap, starters, bench]);

  useEffect(() => {
    if (isPaused || quarterBreakSeconds === 0 || quarterPauseTriggered || gameClock <= 0) {
      return;
    }
    if (gameClock <= quarterBreakSeconds) {
      setIsPaused(true);
      const quarterLabel = `Quarter ${quarterCounterRef.current}`;
      setLastQuarterLabel(quarterLabel);
      quarterCounterRef.current += 1;
      setPauseReason("quarter");
      setQuarterPauseTriggered(true);
      setSubWindowClock(subIntervalSeconds);
      subWindowClockRef.current = subIntervalSeconds;
      setPendingIn(null);
      setPendingOut(null);
      setSubCountdownActive(false);
      setManualSwapDraft(null);
      setManualPrompt(null);
      setBreakOverlayDismissed(false);
      const plan = pickPendingSwap(starters, bench);
      if (plan.incoming || plan.outgoing) {
        setPendingIn(plan.incoming ?? null);
        setPendingOut(plan.outgoing ?? null);
      }
    }
  }, [
    gameClock,
    isPaused,
    quarterBreakSeconds,
    quarterPauseTriggered,
    subIntervalSeconds,
    pickPendingSwap,
    starters,
    bench,
  ]);

  // ----------------------
  // SUB LOGIC
  // ----------------------

  useEffect(() => {
    if (isPaused) return;

    if (subWindowClock <= subWarningSeconds && subWindowClock > 0) {
      const plan = pickPendingSwap(starters, bench);
      setPendingIn(plan.incoming ?? null);
      setPendingOut(plan.outgoing ?? null);
      setSubCountdownActive(true);
    } else {
      setSubCountdownActive(false);
    }

    if (subWindowClock === 0) {
      const plan = pickPendingSwap(starters, bench);
      if (plan.incoming && plan.outgoing) {
        performSub(plan);
      }
      setManualSwapDraft(null);
      setManualPrompt(null);
      setSubWindowClock(subIntervalSeconds);
      subWindowClockRef.current = subIntervalSeconds;
      setPendingIn(null);
      setPendingOut(null);
      setSubCountdownActive(false);
    }
  }, [
    subWindowClock,
    subWarningSeconds,
    subIntervalSeconds,
    starters,
    bench,
    isPaused,
    pickPendingSwap,
    performSub,
  ]);

  // manual sub workflow helpers
  function cancelManualSwap() {
    setManualSwapDraft(null);
    setPendingIn(null);
    setPendingOut(null);
    setSubCountdownActive(false);
    setManualPrompt(null);
  }

  function promptStarterManualOptions(player: Player) {
    setManualPrompt({ type: "starterReason", player });
  }

  function promptBenchManualOptions(player: Player) {
    setManualPrompt({ type: "benchReason", player });
  }

  function startManualSwapFromStarter(player: Player, reason: string) {
    setManualSwapDraft({ reason, outgoing: player });
    setPendingIn(null);
    setPendingOut(null);
    setSubCountdownActive(false);
    setManualPrompt(null);
  }

  function startManualSwapFromBench(player: Player, reason: string) {
    setManualSwapDraft({ reason, incoming: player });
    setPendingIn(null);
    setPendingOut(null);
    setSubCountdownActive(false);
    setManualPrompt(null);
  }

  function confirmManualSwap(incoming: Player, outgoing: Player, reason: string) {
    setManualPrompt({ type: "confirm", incoming, outgoing, reason });
  }

  function handleStarterTap(player: Player) {
    if (waitingForOutgoing && manualSwapDraft?.incoming) {
      confirmManualSwap(manualSwapDraft.incoming, player, manualSwapDraft.reason);
      return;
    }

    if (waitingForIncoming) {
      setManualSwapDraft((prev) => (prev ? { ...prev, outgoing: player } : prev));
      return;
    }

    promptStarterManualOptions(player);
  }

  function handleBenchTap(player: Player) {
    if (waitingForIncoming && manualSwapDraft?.outgoing) {
      confirmManualSwap(player, manualSwapDraft.outgoing, manualSwapDraft.reason);
      return;
    }

    if (waitingForOutgoing) {
      setManualSwapDraft((prev) => (prev ? { ...prev, incoming: player } : prev));
      return;
    }

    promptBenchManualOptions(player);
  }

  // ----------------------
  // TOP BAR ACTIONS
  // ----------------------

  function togglePause() {
    if (pauseReason === "end") {
      return;
    }
    flushElapsedTime();
    if (isPaused) {
      if (gameClock === 0) {
        setGameClock(halfLengthSeconds);
        setSubWindowClock(subIntervalSeconds);
        gameClockRef.current = halfLengthSeconds;
        subWindowClockRef.current = subIntervalSeconds;
        setQuarterPauseTriggered(false);
      }
      setPauseReason(null);
      setLastQuarterLabel(null);
      setLastHalfLabel(null);
      setManualPrompt(null);
      setBreakOverlayDismissed(false);
      setPendingIn(null);
      setPendingOut(null);
      setSubCountdownActive(false);
      setIsPaused(false);
      lastTickTimestampRef.current = Date.now();
    } else {
      setPauseReason(null);
      setIsPaused(true);
      lastTickTimestampRef.current = Date.now();
    }
  }

  function endGame() {
    if (gameEndedRef.current) {
      setBreakOverlayDismissed(false);
      return;
    }

    Alert.alert("End game?", "Are you sure you want to wrap up this session?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes",
        style: "destructive",
        onPress: () => {
          finalizeGame();
        },
      },
    ]);
  }

  const overlayScale = overlayAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  let pauseOverlayTitle: string | null = null;
  let pauseOverlaySubtitle = "";
  let pauseOverlayIcon: keyof typeof Ionicons.glyphMap = "time-outline";
  let pauseOverlayPrimaryLabel = "";
  let pauseOverlayPrimaryAction: (() => void) | null = null;
  let pauseOverlaySecondaryLabel: string | null = null;
  let pauseOverlaySecondaryAction: (() => void) | null = null;

  if (showPauseOverlay) {
    if (pauseReason === "quarter") {
      pauseOverlayIcon = "flag-outline";
      pauseOverlayTitle = lastQuarterLabel
        ? `${lastQuarterLabel} complete`
        : "Quarter break";
      pauseOverlaySubtitle = "Great job. Rotate players and tap resume when you're ready.";
      pauseOverlayPrimaryLabel = "Resume play";
      pauseOverlayPrimaryAction = () => {
        if (isPaused) {
          togglePause();
        }
      };
      pauseOverlaySecondaryLabel = "Adjust lineup";
      pauseOverlaySecondaryAction = () => {
        setBreakOverlayDismissed(true);
      };
    } else if (pauseReason === "half") {
      pauseOverlayIcon = "time-outline";
      pauseOverlayTitle = lastHalfLabel ? `${lastHalfLabel} ended` : "Halftime break";
      pauseOverlaySubtitle = "Make adjustments, grab water, then start the next half.";
      pauseOverlayPrimaryLabel = "Start next half";
      pauseOverlayPrimaryAction = () => {
        if (isPaused) {
          togglePause();
        }
      };
      pauseOverlaySecondaryLabel = "Adjust lineup";
      pauseOverlaySecondaryAction = () => {
        setBreakOverlayDismissed(true);
      };
    } else if (pauseReason === "end") {
      pauseOverlayIcon = "trophy";
      pauseOverlayTitle = "Game finished!";
      pauseOverlaySubtitle =
        "Great effort from the squad. Review the numbers or head back home.";
      pauseOverlayPrimaryLabel = "View game stats";
      pauseOverlayPrimaryAction = () => {
        const savedId = latestSavedGameIdRef.current;
        if (savedId) {
          router.push({ pathname: "/game-stat", params: { gameId: savedId } });
        } else {
          router.push("/game-stat");
        }
      };
      pauseOverlaySecondaryLabel = "Back to home";
      pauseOverlaySecondaryAction = () => {
        router.push("/home");
      };
    }

    if (!pauseOverlayTitle) {
      pauseOverlayTitle = "Break time";
    }
  }

  const isEndOverlay = pauseReason === "end";
  const overlayReopenAvailable =
    breakOverlayDismissed && isPaused && pauseReason !== null && pauseReason !== "end";
  const overlayPlanText = useMemo(() => {
    if (!pauseReason || pauseReason === "end") return null;
    if (pauseReason === "quarter" || pauseReason === "half") {
      if (pendingIn?.name && pendingOut?.name) {
        return `${pendingIn.name} ↔ ${pendingOut.name}`;
      }
      if (pendingIn?.name) {
        return `${pendingIn.name} ready to enter`;
      }
      if (pendingOut?.name) {
        return `${pendingOut.name} ready for rest`;
      }
    }
    return null;
  }, [pauseReason, pendingIn, pendingOut]);

  // ----------------------
  // RENDER HELPERS
  // ----------------------

  const renderStarterOnCourt = () => {
    return starters.slice(0, 5).map((player, i) => {
      const pos = starterPositions[i] || starterPositions[0];
      const isOutSoon = pendingOut && pendingOut.id === player.id;
      const isManualOutgoing = manualSwapDraft?.outgoing?.id === player.id;
      const showManualHighlight = waitingForOutgoing || isManualOutgoing;

      const absStyle: any = {
        position: "absolute",
        top: pos.top,
      };
      if (typeof pos.left === "string") {
        absStyle.left = "50%";
        absStyle.transform = [{ translateX: -UI.avatar / 2 }];
      } else {
        absStyle.left = pos.left;
      }
      if (pos.right !== undefined) {
        absStyle.right = pos.right;
      }

      return (
        <Pressable
          key={player.id}
          style={[styles.courtPlayerWrap, absStyle]}
          onPress={() => handleStarterTap(player)}
          hitSlop={12}
        >
          <View
            style={[
              styles.avatarCourt,
              isOutSoon && styles.avatarCourtOutgoing,
              showManualHighlight && styles.avatarCourtManualCandidate,
              isManualOutgoing && styles.avatarCourtManualTarget,
            ]}
          >
            <Ionicons name="person" size={moderateScale(20)} color={COLORS.text} />
          </View>

          <Text style={styles.playerName} numberOfLines={1}>
            {player.name}
          </Text>

          {isOutSoon ? (
            <View style={styles.arrowDownWrap}>
              <Ionicons
                name="arrow-down"
                size={moderateScale(16)}
                color={COLORS.danger}
                style={{ marginTop: 2 }}
              />
            </View>
          ) : null}
        </Pressable>
      );
    });
  };

  function renderBenchItem(p: Player) {
    const isInSoon = pendingIn && pendingIn.id === p.id;
    const isManualIncoming = manualSwapDraft?.incoming?.id === p.id;
    const highlightAsCandidate = waitingForIncoming || waitingForOutgoing;
    const highlightAsSelected = waitingForOutgoing && isManualIncoming;

    return (
      <Pressable key={p.id} style={styles.benchItem} onPress={() => handleBenchTap(p)}>
        <View style={styles.benchArrowSlot}>
          {isInSoon ? (
            <Ionicons
              name="arrow-up"
              size={moderateScale(16)}
              color={COLORS.success}
              style={{ marginBottom: 2 }}
            />
          ) : null}
        </View>

        <View
          style={[
            styles.avatarBench,
            isInSoon && styles.avatarBenchIncoming,
            highlightAsCandidate && styles.avatarBenchManualCandidate,
            highlightAsSelected && styles.avatarBenchManualMode,
          ]}
        >
          <Ionicons name="person" size={moderateScale(20)} color={COLORS.text} />
        </View>

        <Text style={styles.benchName} numberOfLines={1}>
          {p.name}
        </Text>
      </Pressable>
    );
  }

  function renderManualPrompt() {
    if (!manualPrompt) return null;

    const closePrompt = () => setManualPrompt(null);
    const promptType = manualPrompt.type;
    const isConfirmPrompt = promptType === "confirm";

    type PromptOption = {
      label: string;
      tone?: "accent" | "danger";
      action: () => void;
    };

    let title = "";
    let subtitle: string | null = null;
    const options: PromptOption[] = [];

    if (promptType === "starterReason") {
      const player = manualPrompt.player;
      title = player.name;
      subtitle = "Why are you taking this player off?";
      options.push(
        {
          label: "Manual sub",
          tone: "accent",
          action: () => startManualSwapFromStarter(player, "Manual sub"),
        },
        {
          label: "Injury / penalty",
          tone: "accent",
          action: () => startManualSwapFromStarter(player, "Injury / penalty"),
        }
      );
    } else if (promptType === "benchReason") {
      const player = manualPrompt.player;
      title = player.name;
      subtitle = "Why are you bringing this player in?";
      options.push(
        {
          label: "Manual sub",
          tone: "accent",
          action: () => startManualSwapFromBench(player, "Manual sub"),
        },
        {
          label: "Injury / penalty cover",
          tone: "accent",
          action: () => startManualSwapFromBench(player, "Injury / penalty"),
        }
      );
    } else {
      const { incoming, outgoing, reason } = manualPrompt;
      title = "Confirm manual sub";
      subtitle = `${incoming.name} in for ${outgoing.name}\nReason: ${reason}`;
      options.push({
        label: "Confirm swap",
        tone: "accent",
        action: () => {
          performSub({ incoming, outgoing });
          cancelManualSwap();
        },
      });
    }

    return (
      <Modal visible transparent animationType="fade" onRequestClose={closePrompt}>
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (isConfirmPrompt) {
                cancelManualSwap();
              } else {
                closePrompt();
              }
            }}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{title}</Text>
            {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}

            <View style={styles.modalOptions}>
              {options.map((option, index) => {
                let optionStyle: StyleProp<ViewStyle> = styles.modalOption;
                if (option.tone === "accent") {
                  optionStyle = StyleSheet.compose(optionStyle, styles.modalOptionAccent);
                }
                if (option.tone === "danger") {
                  optionStyle = StyleSheet.compose(optionStyle, styles.modalOptionDanger);
                }
                return (
                  <View
                    key={option.label}
                    style={
                      index !== options.length - 1 ? styles.modalOptionSpacer : undefined
                    }
                  >
                    <Pressable
                      style={optionStyle}
                      onPress={() => {
                        option.action();
                        if (!isConfirmPrompt) {
                          closePrompt();
                        }
                      }}
                    >
                      <Text style={styles.modalOptionText}>{option.label}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <Pressable
              style={styles.modalCancelButton}
              onPress={() => {
                if (isConfirmPrompt) {
                  cancelManualSwap();
                } else {
                  closePrompt();
                }
              }}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  const subCountdownLabel = useMemo(() => {
    if (!subCountdownActive) return null;
    const outName = pendingOut?.name ?? "—";
    const inName = pendingIn?.name ?? "—";
    return `Sub in ${formatClock(subWindowClock)}  (${inName} ↔ ${outName})`;
  }, [subCountdownActive, subWindowClock, pendingOut, pendingIn]);

  const helperText = useMemo(() => {
    if (pauseReason === "quarter") {
      return "Quarter break - tap Resume when you are ready.";
    }
    if (pauseReason === "half") {
      return "Halftime - tap Resume to start the next half.";
    }
    if (pauseReason === "end") {
      return "Game finished - review stats when you're ready.";
    }
    return "Stay ready - you'll be prompted when it's sub time.";
  }, [pauseReason]);

  const clockIsCritical = useMemo(() => {
    if (gameClock <= 0) return true;
    const finalMinute = gameClock <= 60;
    const quarterWarning =
      !quarterPauseTriggered &&
      quarterBreakSeconds > 0 &&
      gameClock <= quarterBreakSeconds + 60 &&
      gameClock > quarterBreakSeconds;
    const quarterReached = quarterBreakSeconds > 0 && gameClock <= quarterBreakSeconds;
    return finalMinute || quarterWarning || quarterReached;
  }, [gameClock, quarterBreakSeconds, quarterPauseTriggered]);

  const subIntervalLabel = useMemo(() => {
    const minutes = subIntervalSeconds / 60;
    return Number.isInteger(minutes) ? `${minutes}` : minutes.toFixed(1);
  }, [subIntervalSeconds]);

  const manualSwapMessage = useMemo(() => {
    if (!manualSwapActive) return null;
    if (waitingForIncoming && manualSwapOutgoingName) {
      return `Pick a bench replacement for ${manualSwapOutgoingName} (${
        manualSwapReason ?? "Manual"
      })`;
    }
    if (waitingForOutgoing && manualSwapIncomingName) {
      return `Choose who leaves for ${manualSwapIncomingName} (${manualSwapReason ?? "Manual"})`;
    }
    return null;
  }, [
    manualSwapActive,
    waitingForIncoming,
    waitingForOutgoing,
    manualSwapReason,
    manualSwapIncomingName,
    manualSwapOutgoingName,
  ]);

  const benchHelperMessage =
    manualSwapMessage ??
    (pauseReason && pauseReason !== "end" && pendingIn?.name && pendingOut?.name
      ? `Auto plan: ${pendingIn.name} ↔ ${pendingOut.name}`
      : "Tap a player to manage manual subs.");

  // ----------------------
  // RENDER
  // ----------------------

  return (
    <>
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.wrapper}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              style={styles.iconButton}
            >
              <Ionicons name="chevron-back" size={moderateScale(20)} color={COLORS.text} />
            </Pressable>

            <Text style={styles.headerTitle}>Game Court</Text>

            <View style={styles.headerActions}>
              <Pressable onPress={openStatsScreen} style={styles.headerStatAction} hitSlop={12}>
                <Ionicons name="stats-chart" size={moderateScale(16)} color={COLORS.accent} />
                {!isTinyDevice && <Text style={styles.headerStatText}>Stats</Text>}
              </Pressable>

              <Pressable onPress={endGame} style={styles.headerAction} hitSlop={12}>
                <Ionicons name="stop" size={moderateScale(16)} color={COLORS.danger} />
                {!isTinyDevice && <Text style={styles.headerActionText}>End</Text>}
              </Pressable>
            </View>
          </View>

          {overlayReopenAvailable ? (
            <Pressable
              style={styles.overlayChip}
              onPress={() => setBreakOverlayDismissed(false)}
              hitSlop={12}
            >
              <Ionicons
                name="information-circle-outline"
                size={moderateScale(16)}
                color={COLORS.accent}
              />
              <Text style={styles.overlayChipText}>Show break summary</Text>
            </Pressable>
          ) : null}

          <View style={styles.gameMetaCard}>
            <View style={styles.gameMetaLeft}>
              <Text style={styles.clockLabel}>Game clock</Text>
              <View style={styles.clockReadoutRow}>
                <Text
                  style={[
                    styles.clockValue,
                    clockIsCritical && styles.clockValueCritical,
                  ]}
                >
                  {formatClock(gameClock)}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    isPaused ? styles.statusPaused : styles.statusLive,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      isPaused ? styles.statusDotPaused : styles.statusDotLive,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      isPaused ? styles.statusTextPaused : styles.statusTextLive,
                    ]}
                  >
                    {isPaused ? "Paused" : "Live"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.gameMetaRight}>
              <Pressable
                onPress={togglePause}
                style={[
                  styles.pauseButton,
                  isPaused && styles.pauseButtonActive,
                  pauseReason === "end" && styles.pauseButtonDisabled,
                ]}
                hitSlop={12}
                disabled={pauseReason === "end"}
              >
                <Ionicons
                  name={isPaused ? "play" : "pause"}
                  size={moderateScale(16)}
                  color={
                    pauseReason === "end"
                      ? COLORS.textMuted
                      : isPaused
                      ? COLORS.success
                      : COLORS.accent
                  }
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.pauseButtonText,
                    isPaused && styles.pauseButtonTextActive,
                    pauseReason === "end" && styles.pauseButtonTextDisabled,
                  ]}
                >
                  {pauseReason === "end" ? "Ended" : isPaused ? "Resume" : "Pause"}
                </Text>
              </Pressable>

              <View style={styles.metaHintRow}>
                <Ionicons
                  name="sync"
                  size={moderateScale(14)}
                  color={COLORS.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.metaHint}>Subs every {subIntervalLabel} min</Text>
              </View>
            </View>
          </View>

          <View style={styles.subMessageSlot}>
            {subCountdownLabel ? (
              <View style={styles.subCountdownBar}>
                <Ionicons
                  name="time"
                  size={moderateScale(16)}
                  color={COLORS.warn}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.subCountdownText}>{subCountdownLabel}</Text>
              </View>
            ) : (
              <Text style={styles.clockHelper}>{helperText}</Text>
            )}
          </View>

          <View style={styles.courtCard}>
            <Image
              source={require("../../assets/images/empty-court-image.png")}
              style={styles.courtImage}
              resizeMode="contain"
            />
            {renderStarterOnCourt()}
          </View>

          <View style={styles.benchSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Bench</Text>
              <View style={styles.manualHintWrap}>
                <Text style={styles.manualHint}>{benchHelperMessage}</Text>
                {manualSwapActive ? (
                  <Pressable onPress={cancelManualSwap} hitSlop={12}>
                    <Text style={styles.manualCancel}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ScrollView
              style={styles.benchScroll}
              contentContainerStyle={styles.benchRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {bench.length === 0 ? (
                <View style={styles.benchEmpty}>
                  <Ionicons
                    name="people-circle-outline"
                    size={moderateScale(24)}
                    color={COLORS.textMuted}
                    style={{ marginBottom: 6 }}
                  />
                  <Text style={styles.benchEmptyText}>
                    No bench players available. Add more in lineup.
                  </Text>
                </View>
              ) : (
                bench.map((p) => renderBenchItem(p))
              )}
            </ScrollView>
          </View>
        </View>

        <View style={[styles.bottomPanel, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <Pressable
            style={styles.secondaryDockButton}
            onPress={() => router.push("/game-settings/lineup")}
            hitSlop={12}
          >
            <Ionicons name="people" size={moderateScale(18)} color={COLORS.accent} />
            <Text style={styles.secondaryDockText}>Edit lineup</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryDockButton}
            onPress={() => router.push("/game-settings")}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={moderateScale(18)} color={COLORS.accent} />
            <Text style={styles.secondaryDockText}>Game settings</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      {showPauseOverlay ? (
        <View style={styles.pauseOverlay} pointerEvents="auto">
          <Animated.View
            style={[
              styles.pauseOverlayCard,
              {
                opacity: overlayAnim,
                transform: [{ scale: overlayScale }],
              },
            ]}
          >
            <View
              style={[
                styles.pauseOverlayIconWrap,
                isEndOverlay && styles.pauseOverlayIconWrapSuccess,
              ]}
            >
              <Ionicons
                name={pauseOverlayIcon}
                size={moderateScale(28)}
                color={isEndOverlay ? COLORS.success : COLORS.accent}
              />
            </View>
            <Text style={styles.pauseOverlayTitle}>{pauseOverlayTitle}</Text>
            {pauseOverlaySubtitle ? (
              <Text style={styles.pauseOverlaySubtitle}>{pauseOverlaySubtitle}</Text>
            ) : null}

            {overlayPlanText ? (
              <View style={styles.pauseOverlayPlan}>
                <Ionicons
                  name="swap-horizontal"
                  size={moderateScale(18)}
                  color={COLORS.accent}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.pauseOverlayPlanText}>{overlayPlanText}</Text>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.pauseOverlayPrimary,
                isEndOverlay && styles.pauseOverlayPrimaryEnd,
              ]}
              onPress={pauseOverlayPrimaryAction ?? (() => {})}
              disabled={!pauseOverlayPrimaryAction}
            >
              <Text style={styles.pauseOverlayPrimaryText}>
                {pauseOverlayPrimaryLabel || "Continue"}
              </Text>
            </Pressable>

            {pauseOverlaySecondaryLabel && pauseOverlaySecondaryAction ? (
              <Pressable
                style={styles.pauseOverlaySecondary}
                onPress={pauseOverlaySecondaryAction}
              >
                <Text style={styles.pauseOverlaySecondaryText}>
                  {pauseOverlaySecondaryLabel}
                </Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      ) : null}

      {renderManualPrompt()}
    </>
  );
}

// ----------------------
// STYLES
// ----------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: UI.pad,
    paddingTop: isTablet ? 8 : 4,
    paddingBottom: 12,
    maxWidth: isLargeTablet ? 1200 : isTablet ? 900 : undefined,
    alignSelf: "center",
    width: "100%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: isTablet ? 16 : 12,
  },
  iconButton: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: moderateScale(24),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: COLORS.text,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerStatAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: UI.chipRadius,
    backgroundColor: COLORS.accentSoft,
    gap: 6,
  },
  headerStatText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: moderateScale(13),
  },
  headerAction: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(8),
    borderRadius: UI.chipRadius,
    backgroundColor: COLORS.dangerBg,
    gap: 6,
  },
  headerActionText: {
    color: COLORS.danger,
    fontWeight: "600",
    fontSize: moderateScale(13),
  },
  overlayChip: {
    marginTop: 12,
    marginBottom: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(8),
    borderRadius: UI.chipRadius,
    backgroundColor: COLORS.accentSoft,
    gap: 6,
  },
  overlayChipText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
    color: COLORS.accent,
  },
  gameMetaCard: {
    marginTop: isTablet ? 8 : 4,
    borderRadius: UI.cardRadius,
    backgroundColor: COLORS.card,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  gameMetaLeft: {
    flex: 1,
    marginRight: 12,
  },
  clockReadoutRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 12,
  },
  clockLabel: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  gameMetaRight: {
    alignItems: "flex-end",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: UI.chipRadius,
  },
  statusLive: {
    backgroundColor: COLORS.successBg,
  },
  statusPaused: {
    backgroundColor: COLORS.dangerBg,
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: moderateScale(3),
    marginRight: 6,
  },
  statusDotLive: {
    backgroundColor: COLORS.success,
  },
  statusDotPaused: {
    backgroundColor: COLORS.danger,
  },
  statusText: {
    fontSize: moderateScale(12),
    fontWeight: "600",
  },
  statusTextLive: {
    color: COLORS.success,
  },
  statusTextPaused: {
    color: COLORS.danger,
  },
  pauseButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI.chipRadius,
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
  },
  pauseButtonActive: {
    backgroundColor: COLORS.successBg,
  },
  pauseButtonText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: COLORS.accent,
  },
  pauseButtonTextActive: {
    color: COLORS.success,
  },
  pauseButtonDisabled: {
    opacity: 0.5,
  },
  pauseButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  clockValue: {
    fontSize: moderateScale(36),
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -1,
  },
  clockValueCritical: {
    color: COLORS.danger,
  },
  metaHintRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  metaHint: {
    fontSize: moderateScale(13),
    color: COLORS.textMuted,
    fontWeight: "500",
  },
  subMessageSlot: {
    marginTop: isTablet ? 14 : 10,
    minHeight: moderateScale(44),
    justifyContent: "center",
    alignItems: "center",
  },
  clockHelper: {
    fontSize: moderateScale(12),
    color: COLORS.textMuted,
    textAlign: "center",
  },
  subCountdownBar: {
    backgroundColor: COLORS.warnBg,
    borderRadius: UI.chipRadius,
    paddingHorizontal: moderateScale(14),
    paddingVertical: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.2)",
  },
  subCountdownText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: COLORS.text,
    flexShrink: 1,
  },
  courtCard: {
    marginTop: isTablet ? 20 : 16,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: moderateScale(260),
    width: "100%",
    maxWidth: isTablet ? 480 : 380,
    alignSelf: "center",
    backgroundColor: COLORS.courtBg,
    borderRadius: UI.cardRadius,
    paddingVertical: moderateScale(20),
  },
  courtImage: {
    ...StyleSheet.absoluteFillObject,
    width: undefined,
    height: undefined,
    transform: [{ scale: 1.08 }],
  },
  courtPlayerWrap: {
    alignItems: "center",
  },
  avatarCourt: {
    width: UI.avatar,
    height: UI.avatar,
    borderRadius: UI.avatar / 2,
    backgroundColor: COLORS.avatar,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
  avatarCourtOutgoing: {
    borderColor: COLORS.danger,
    borderWidth: 3,
  },
  avatarCourtManualCandidate: {
    borderColor: COLORS.accentStrong,
  },
  avatarCourtManualTarget: {
    borderColor: COLORS.success,
    borderWidth: 3,
  },
  playerName: {
    marginTop: 4,
    fontSize: moderateScale(12),
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: moderateScale(80),
  },
  arrowDownWrap: {
    marginTop: 8,
    alignItems: "center",
  },
  benchSection: {
    flex: 1,
    marginTop: isTablet ? 22 : 18,
    minHeight: isShortDevice ? 120 : 140,
  },
  benchScroll: {
    maxHeight: isTablet ? 180 : 150,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    borderRadius: UI.cardRadius,
    paddingHorizontal: moderateScale(12),
    paddingVertical: moderateScale(16),
    backgroundColor: COLORS.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: moderateScale(18),
    color: COLORS.text,
    fontWeight: "700",
  },
  manualHint: {
    fontSize: moderateScale(12),
    color: COLORS.textMuted,
    fontWeight: "600",
    maxWidth: isTablet ? 300 : 200,
    textAlign: "right",
  },
  manualHintWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  manualCancel: {
    fontSize: moderateScale(12),
    color: COLORS.danger,
    fontWeight: "700",
  },
  benchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    paddingRight: 12,
  },
  benchEmpty: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: moderateScale(24),
    borderRadius: UI.cardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  benchEmptyText: {
    fontSize: moderateScale(13),
    color: COLORS.textMuted,
    textAlign: "center",
  },
  benchItem: {
    alignItems: "center",
    marginRight: moderateScale(16),
    position: "relative",
    paddingVertical: 4,
  },
  benchArrowSlot: {
    height: moderateScale(24),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  avatarBench: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: moderateScale(22),
    backgroundColor: COLORS.avatar,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarBenchIncoming: {
    borderColor: COLORS.success,
  },
  avatarBenchManualCandidate: {
    borderColor: COLORS.accentStrong,
    borderWidth: 2,
  },
  avatarBenchManualMode: {
    borderColor: COLORS.accentStrong,
    borderWidth: 3,
  },
  benchName: {
    fontSize: moderateScale(12),
    color: COLORS.text,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: moderateScale(70),
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: moderateScale(24),
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: "100%",
    maxWidth: moderateScale(320),
    borderRadius: moderateScale(20),
    backgroundColor: COLORS.card,
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(22),
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  modalTitle: {
    fontSize: moderateScale(18),
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: 8,
    fontSize: moderateScale(13),
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: moderateScale(18),
  },
  modalOptions: {
    marginTop: 18,
  },
  modalOption: {
    borderRadius: UI.chipRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(16),
  },
  modalOptionAccent: {
    backgroundColor: COLORS.accentSoft,
    borderColor: "rgba(37,99,235,0.24)",
  },
  modalOptionDanger: {
    backgroundColor: COLORS.dangerBg,
    borderColor: "rgba(239,68,68,0.24)",
  },
  modalOptionText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
  },
  modalOptionSpacer: {
    marginBottom: 12,
  },
  modalCancelButton: {
    marginTop: 16,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: moderateScale(13),
    fontWeight: "700",
    color: COLORS.danger,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: moderateScale(24),
  },
  pauseOverlayCard: {
    width: "100%",
    maxWidth: moderateScale(340),
    borderRadius: moderateScale(28),
    backgroundColor: COLORS.card,
    paddingHorizontal: moderateScale(28),
    paddingVertical: moderateScale(32),
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  pauseOverlayIconWrap: {
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  pauseOverlayIconWrapSuccess: {
    backgroundColor: COLORS.successBg,
  },
  pauseOverlayTitle: {
    fontSize: moderateScale(20),
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  pauseOverlaySubtitle: {
    marginTop: 10,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    color: COLORS.textMuted,
    textAlign: "center",
  },
  pauseOverlayPlan: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accentSoft,
    borderRadius: UI.chipRadius,
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(10),
  },
  pauseOverlayPlanText: {
    fontSize: moderateScale(13),
    fontWeight: "600",
    color: COLORS.accent,
  },
  pauseOverlayPrimary: {
    marginTop: 24,
    backgroundColor: COLORS.accent,
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(24),
    borderRadius: UI.chipRadius,
    width: "100%",
    alignItems: "center",
  },
  pauseOverlayPrimaryEnd: {
    backgroundColor: COLORS.success,
  },
  pauseOverlayPrimaryText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: moderateScale(15),
  },
  pauseOverlaySecondary: {
    marginTop: 14,
    paddingVertical: moderateScale(10),
    paddingHorizontal: moderateScale(16),
    borderRadius: UI.chipRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    width: "100%",
    alignItems: "center",
  },
  pauseOverlaySecondaryText: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: COLORS.text,
  },
  bottomPanel: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  secondaryDockButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: UI.chipRadius,
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(12),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 6,
    gap: 8,
  },
  secondaryDockText: {
    color: COLORS.accent,
    fontWeight: "600",
    fontSize: moderateScale(14),
  },
});
