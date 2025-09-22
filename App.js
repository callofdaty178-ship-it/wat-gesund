import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Image, Platform } from "react-native";
import { Accelerometer } from "expo-sensors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

// ---- Einstellungen ----
const DEFAULT_SECONDS = 30;
const COOLDOWN_MS = 700;

export default function App() {
  const [mode, setMode] = useState("Jump"); // "Jump" | "Shake" | "Freeze"
  const [seconds, setSeconds] = useState(DEFAULT_SECONDS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_SECONDS);
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [stars, setStars] = useState(0); // Belohnungssterne
  const [avatarIndex, setAvatarIndex] = useState(0); // ausgewählter Avatar
  const [level, setLevel] = useState(1); // 1, 2, 3
  const [sub, setSub] = useState(null);

  const lastHitRef = useRef(0);
  const tickRef = useRef(null);

  // Sounds
  const bgMusic = useRef(null);
  const cheerSound = useRef(null);
  const countdownSound = useRef(null);

  // Avatare (einfach drei Beispielbilder)
  const avatars = [
    require("./assets/avatar1.png"),
    require("./assets/avatar2.png"),
    require("./assets/avatar3.png"),
  ];

  // Highscore laden
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(`HIGH_SCORE_${mode}_${level}`);
      if (saved) setHighScore(Number(saved));

      const savedStars = await AsyncStorage.getItem("STARS");
      if (savedStars) setStars(Number(savedStars));
    })();
  }, [mode, level]);

  // Timer
  useEffect(() => {
    if (!isPlaying) return;
    tickRef.current = setInterval(() => setTimeLeft(t => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(tickRef.current);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && timeLeft === 0) stopRound();
  }, [timeLeft]);

  // Musik laden
  useEffect(() => {
    (async () => {
      const { sound: music } = await Audio.Sound.createAsync(require("./assets/music.mp3"));
      bgMusic.current = music;
      await music.setIsLoopingAsync(true);
      await music.playAsync();

      const { sound: cheer } = await Audio.Sound.createAsync(require("./assets/cheer.mp3"));
      cheerSound.current = cheer;

      const { sound: count } = await Audio.Sound.createAsync(require("./assets/countdown.mp3"));
      countdownSound.current = count;
    })();
    return () => {
      bgMusic.current && bgMusic.current.unloadAsync();
      cheerSound.current && cheerSound.current.unloadAsync();
      countdownSound.current && countdownSound.current.unloadAsync();
    };
  }, []);

  const getThreshold = () => {
    if (mode === "Freeze") return 0.15;
    if (level === 1) return 1.3;
    if (level === 2) return 1.7;
    if (level === 3) return 2.0;
    return 1.6;
  };

  const startSensors = () => {
    Accelerometer.setUpdateInterval(50);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (mode === "Freeze") {
        if (magnitude < 1 + getThreshold() && now - lastHitRef.current > 800) {
          lastHitRef.current = now;
          setScore(s => s + 1);
        }
        return;
      }

      if (magnitude > getThreshold() && now - lastHitRef.current > COOLDOWN_MS) {
        lastHitRef.current = now;
        setScore(s => s + 1);
      }
    });
    setSub(subscription);
  };

  const stopSensors = () => {
    sub && sub.remove();
    setSub(null);
  };

  const startRound = async () => {
    setScore(0);
    setTimeLeft(seconds);
    setIsPlaying(true);
    lastHitRef.current = 0;

    // Countdown-Sound abspielen
    if (countdownSound.current) {
      await countdownSound.current.replayAsync();
    }

    startSensors();
  };

  const stopRound = async () => {
    setIsPlaying(false);
    stopSensors();
    clearInterval(tickRef.current);

    if (score > highScore) {
      setHighScore(score);
      await AsyncStorage.setItem(`HIGH_SCORE_${mode}_${level}`, String(score));
      // Jubel-Sound
      if (cheerSound.current) {
        await cheerSound.current.replayAsync();
      }
    }

    // Belohnung: Stern ab 20 Punkten
    if (score >= 20) {
      const newStars = stars + 1;
      setStars(newStars);
      await AsyncStorage.setItem("STARS", String(newStars));
      // Avatar wechseln
      setAvatarIndex((avatarIndex + 1) % avatars.length);
    }
  };

  // Kleine Buttons
  const Chip = ({ label, active, onPress }) => (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
      disabled={isPlaying}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Image source={require("./assets/logo.jpg")} style={styles.logo} />
      <Text style={styles.title}>JumpStars</Text>

      <Image source={avatars[avatarIndex]} style={styles.avatar} />
      <Text style={styles.stars}>⭐ {stars}</Text>

      <View style={styles.row}>
        <Chip label="Jump" active={mode === "Jump"} onPress={() => setMode("Jump")} />
        <Chip label="Shake" active={mode === "Shake"} onPress={() => setMode("Shake")} />
        <Chip label="Freeze" active={mode === "Freeze"} onPress={() => setMode("Freeze")} />
      </View>

      <View style={styles.row}>
        {[1, 2, 3].map(lvl => (
          <Chip key={lvl} label={`Level ${lvl}`} active={level === lvl} onPress={() => setLevel(lvl)} />
        ))}
      </View>

      <View style={styles.row}>
        {[15, 30, 60].map(val => (
          <Chip key={val} label={`${val}s`} active={seconds === val} onPress={() => setSeconds(val)} />
        ))}
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Zeit</Text>
          <Text style={styles.badgeValue}>{timeLeft}s</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Punkte</Text>
          <Text style={styles.badgeValue}>{score}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Best</Text>
          <Text style={styles.badgeValue}>{highScore}</Text>
        </View>
      </View>

      {!isPlaying ? (
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={startRound}>
          <Text style={styles.btnText}>Start</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.btn, styles.btnStop]} onPress={stopRound}>
          <Text style={styles.btnText}>Stopp</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.hint}>
        Tipp: Handy gut festhalten. Im Browser sind Bewegungssensoren eingeschränkt.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  logo: { width: 200, height: 80, resizeMode: "contain", marginBottom: 8 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
  avatar: { width: 80, height: 80, resizeMode: "contain", marginVertical: 8 },
  stars: { fontSize: 18, marginBottom: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: "#ccc", margin: 2 },
  chipActive: { backgroundColor: "#e53935", borderColor: "#e53935" },
  chipText: { fontSize: 14 },
  chipTextActive: { color: "white", fontWeight: "700" },
  scoreRow: { flexDirection: "row", gap: 12, marginVertical: 12 },
  badge: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#EFEFEF" },
  badgeLabel: { fontSize: 12, opacity: 0.7 },
  badgeValue: { fontSize: 20, fontWeight: "700" },
  btn: { paddingVertical: 14, paddingHorizontal: 28, borderRadius: 16, minWidth: 200, alignItems: "center", marginTop: 4 },
  btnPrimary: { backgroundColor: "#43A047" },
  btnStop: { backgroundColor: "#D32F2F" },
  btnText: { color: "white", fontSize: 18, fontWeight: "700" },
  hint: { marginTop: 12, textAlign: "center", fontSize: 12, opacity: 0.6 },
});
