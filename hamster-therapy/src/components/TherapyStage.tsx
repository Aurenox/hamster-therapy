import { useEffect, useRef, useState } from "react";
import { createFaceLandmarker } from "../face/faceLandmarker";

type Landmark = {
  x: number;
  y: number;
  z?: number;
};

type Stage = 1 | 2 | 3 | 4;

type Mode =
  | "therapy"
  | "countdown"
  | "deepSleep"
  | "shockCheck"
  | "notSleeping"
  | "reveal";

type FrameNumber = 1 | 2 | 3 | 4 | 5;

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

const trollingMessages: Record<number, string> = {
  1: "കുട്ടാ 😭 കൊട്ടുവാ എടുക്കാൻ പറഞ്ഞതാ… ഹാംസ്റ്ററിനെ ഭയപ്പെടുത്താൻ വായ തുറക്കാൻ പറഞ്ഞതല്ല! 🐹💀",

  2: "കണ്ണടച്ചിട്ട് ഉറങ്ങാൻ നോക്കുന്നു… പക്ഷേ ആ മുഖം കണ്ടിട്ട് ഹാംസ്റ്ററിന്റെ ഉറക്കം പോയി! 😂🐹",

  3: "Zen pout ആണത്രേ! 😭 ഹാംസ്റ്റർക്ക് Zen കിട്ടിയില്ല… ജീവിതത്തെക്കുറിച്ച് തന്നെ സംശയം വന്നു! 🐹💀😂",

  4: "COMA ആണെന്ന് പറഞ്ഞപ്പോൾ ഹാംസ്റ്റർ ഉറങ്ങാൻ പോയി… തിരിച്ചു വന്നപ്പോൾ നീ ഇപ്പോഴും acting! 😭🐹😂",

  5: "പിടിക്കപ്പെട്ടു! 😱😂 ഈ പേടിച്ച മുഖം കണ്ടിട്ട് ഹാംസ്റ്റർ പറഞ്ഞു: ‘ഇവന് therapy വേണ്ട… ഒരു hug മതി!’ 🐹🔥",
};

const FRAME_DURATION = 2000;

const stageInfo = {
  1: {
    emoji: "🥱",
    title: "The Yawn",
    subtitle: "Release facial tension",
    technique: "Vagus Nerve Decompression",
    description:
      "Open your jaw slowly and comfortably. Let the tension melt away.",
    malayalam: "ഒരു വലിയ കൊട്ടുവാ എടുത്താലോ? 🥱🐹",
    instruction:
      "വായ നന്നായി തുറക്കൂ കുട്ടാ... എലി കുട്ടന് ഉറങ്ങണ്ടേ? 🐹💤",
    calibrationLabel: "Mouth Calibration",
    target: "Target: > 0.050",
  },

  2: {
    emoji: "😴",
    title: "Droopy Daze",
    subtitle: "Let your eyes get heavy",
    technique: "Orbicularis Oculi Relaxation",
    description:
      "Slowly relax your eyes and allow them to become heavy and sleepy.",
    malayalam: "എലി കുട്ടന് ഉറക്കം പിടിച്ചു തുടങ്ങി! 🐹💤",
    instruction:
      "കണ്ണുകൾ പതുക്കെ അടയ്ക്കൂ… എലി കുട്ടന് ഉറക്കം കൂടുതൽ പിടിക്കട്ടെ! 😴💤",
    calibrationLabel: "Eye Calibration",
    target: "Target: < 0.022",
  },

  3: {
    emoji: "😗",
    title: "Zen Pout",
    subtitle: "Relax your facial muscles",
    technique: "Facial Relaxation",
    description:
      "Bring your lips gently together into a tiny relaxed pout.",
    malayalam: "എലി കുട്ടൻ ഇപ്പോൾ കിടക്കാൻ തയ്യാറാണ്! 🐹💤",
    instruction:
      "ചുണ്ട് പതുക്കെ മുന്നോട്ട് തള്ളൂ… എലി കുട്ടന് ഇനി കിടന്ന് വിശ്രമിക്കാം! 😗🐹",
    calibrationLabel: "Pout Calibration",
    target: "Target: < 0.320",
  },

  4: {
    emoji: "🫠",
    title: "Coma",
    subtitle: "Enter maximum relaxation",
    technique: "Deep Facial Relaxation",
    description:
      "Close your eyes completely while keeping your mouth relaxed and open.",
    malayalam: "എലി കുട്ടൻ ഇപ്പോൾ ആഴത്തിൽ ഉറങ്ങുകയാണ്… 💤🐹",
    instruction:
      "കണ്ണുകൾ പൂർണ്ണമായി അടയ്ക്കൂ, വായ ശാന്തമായി തുറന്നുവെക്കൂ… എലി കുട്ടൻ ആഴത്തിൽ ഉറങ്ങട്ടെ! 😴🐹",
    calibrationLabel: "Coma Calibration",
    target: "Eyes < 0.012 • Mouth > 0.070",
  },
} as const;

export default function TherapyStage() {
  // ============================================================
  // REFS
  // ============================================================

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<any>(null);

  const animationRef = useRef<number | null>(null);

  const countdownTimerRef = useRef<number | null>(null);
  const deepSleepTimerRef = useRef<number | null>(null);
  const shockTimerRef = useRef<number | null>(null);
  const notSleepingTimerRef = useRef<number | null>(null);

  const mountedRef = useRef(true);

  const stageRef = useRef<Stage>(1);
  const modeRef = useRef<Mode>("therapy");

  const completingRef = useRef(false);
  const countdownStartedRef = useRef(false);
  const shockCheckingRef = useRef(false);

  const shockDetectedRef = useRef(false);
  const shockCapturedRef = useRef(false);

  // ============================================================
  // STATE
  // ============================================================

  const [stage, setStage] = useState<Stage>(1);

  const [mode, setModeState] =
    useState<Mode>("therapy");

  const [cameraReady, setCameraReady] =
    useState(false);

  const [faceDetected, setFaceDetected] =
    useState(false);

  const [calibration, setCalibration] =
    useState(0);

  const [countdown, setCountdown] =
    useState(5);

  const [shockTimeLeft, setShockTimeLeft] =
    useState(3);

  const [status, setStatus] =
    useState("Starting face detection...");

  const [error, setError] =
    useState("");

  const [frame1Captured, setFrame1Captured] =
    useState(false);

  const [frame2Captured, setFrame2Captured] =
    useState(false);

  const [frame3Captured, setFrame3Captured] =
    useState(false);

  const [frame4Captured, setFrame4Captured] =
    useState(false);

  const [frame5Captured, setFrame5Captured] =
    useState(false);

  const [imageSize, setImageSize] =
    useState<"small" | "medium" | "large">("medium");

  const [videoGenerating, setVideoGenerating] =
    useState(false);

  const [videoUrl, setVideoUrl] =
    useState<string | null>(null);

  const [videoError, setVideoError] =
    useState("");
  const audioContextRef = useRef<AudioContext | null>(null);

  function getAudioContext() {
    if (audioContextRef.current) return audioContextRef.current;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("Web Audio API is not supported.");
      return null;
    }

    const ctx = new AudioContextClass();
    audioContextRef.current = ctx;
    return ctx;
  }

  async function ensureAudioRunning() {
    const ctx = getAudioContext();
    if (!ctx) return null;

    if (ctx.state !== "running") {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn("Audio resume blocked by browser:", err);
        return null;
      }
    }

    return ctx.state === "running" ? ctx : null;
  }

  async function unlockAudio() {
    const ctx = await ensureAudioRunning();
    return ctx;
  }


  async function playBeep(
    frequency = 700,
    duration = 0.12,
    volume = 0.08,
    type: OscillatorType = "sine",
  ) {
    const ctx = await ensureAudioRunning();
    if (!ctx) return;

    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function playStageBeep() {
    void playBeep(740, 0.16, 0.09, "sine");
  }

  function playCountdownBeep() {
    void playBeep(560, 0.13, 0.075, "sine");
  }

  function playSuccessBeep() {
    void playBeep(880, 0.14, 0.09, "sine");
    window.setTimeout(() => {
      void playBeep(1175, 0.20, 0.09, "sine");
    }, 110);
  }

  async function playShockBeep() {
    const ctx = await ensureAudioRunning();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep impact / alarm layer
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "sawtooth";
    o1.frequency.setValueAtTime(320, now);
    o1.frequency.exponentialRampToValueAtTime(45, now + 0.55);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.38, now + 0.012);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
    o1.connect(g1);
    g1.connect(ctx.destination);
    o1.start(now);
    o1.stop(now + 0.6);

    // High-pitched jump-scare layer
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "square";
    o2.frequency.setValueAtTime(1200, now);
    o2.frequency.exponentialRampToValueAtTime(180, now + 0.28);
    g2.gain.setValueAtTime(0.0001, now);
    g2.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    o2.connect(g2);
    g2.connect(ctx.destination);
    o2.start(now);
    o2.stop(now + 0.34);

    // Short noise burst for a much more audible shock hit
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.32, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const envelope = Math.exp(-i / (ctx.sampleRate * 0.07));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.32, now + 0.006);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  }

  useEffect(() => {
    const unlock = () => {
      void unlockAudio();
    };

    // The browser requires a real user gesture before allowing audible Web Audio.
    // We use the user's first natural interaction anywhere on the page; no sound button is needed.
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("click", unlock);

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("click", unlock);
    };
  }, []);

  // MODE
  // ============================================================

  function setMode(next: Mode) {
    modeRef.current = next;
    setModeState(next);
  }

  // ============================================================
  // STOP DETECTION
  // ============================================================

  function stopDetection() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }

  // ============================================================
  // STOP CAMERA
  // ============================================================

  function stopCamera() {
    console.log("🛑 CAMERA STOPPED");

    stopDetection();

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    setCameraReady(false);
  }

  // ============================================================
  // START CAMERA + MEDIAPIPE
  // ============================================================

  useEffect(() => {
    mountedRef.current = true;

    async function start() {
      try {
        setStatus("Requesting camera...");

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera access is not supported by this browser.",
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: {
                ideal: 640,
              },
              height: {
                ideal: 480,
              },
            },
            audio: false,
          });

        if (!mountedRef.current) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        streamRef.current = stream;

        const video = videoRef.current;

        if (!video) {
          throw new Error(
            "Video element unavailable.",
          );
        }

        video.srcObject = stream;

        await new Promise<void>((resolve) => {
          if (
            video.readyState >=
            HTMLMediaElement.HAVE_METADATA
          ) {
            resolve();
            return;
          }

          video.onloadedmetadata = () => resolve();
        });

        await video.play();

        if (!mountedRef.current) {
          return;
        }

        setCameraReady(true);

        setStatus(
          "Camera ready. Loading MediaPipe...",
        );

        const landmarker =
          await createFaceLandmarker();

        if (!mountedRef.current) {
          return;
        }

        landmarkerRef.current = landmarker;

        setStatus("Stage 1 ready.");

        console.log("✅ MediaPipe ready");

        animationRef.current =
          requestAnimationFrame(
            detectFace,
          );
      } catch (err) {
        console.error(
          "START ERROR:",
          err,
        );

        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(
            "Could not start camera.",
          );
        }

        setStatus(
          "Face detection failed.",
        );
      }
    }

    start();

    return () => {
      mountedRef.current = false;

      stopDetection();

      if (
        countdownTimerRef.current !==
        null
      ) {
        window.clearInterval(
          countdownTimerRef.current,
        );
      }

      if (
        deepSleepTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          deepSleepTimerRef.current,
        );
      }

      if (
        shockTimerRef.current !==
        null
      ) {
        window.clearInterval(
          shockTimerRef.current,
        );
      }

      if (
        notSleepingTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          notSleepingTimerRef.current,
        );
      }

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop(),
          );
      }

      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      if (audioContextRef.current) { void audioContextRef.current.close(); audioContextRef.current = null; }
    };
  }, []);

  // ============================================================
  // VIDEO URL CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  // ============================================================
  // CAPTURE IMAGE
  // ============================================================

  function captureFrame(
    frameNumber: FrameNumber,
  ) {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      console.error(
        "❌ Cannot capture image.",
      );

      return false;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.error(
        "❌ Video has no dimensions.",
      );

      return false;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      console.error(
        "❌ Canvas context unavailable.",
      );

      return false;
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    const image =
      canvas.toDataURL(
        "image/jpeg",
        0.9,
      );

    sessionStorage.setItem(
      `hamster_frame_${frameNumber}`,
      image,
    );

    console.log(
      `📸 FRAME ${frameNumber} CAPTURED`,
    );

    if (frameNumber === 1) {
      setFrame1Captured(true);
    }

    if (frameNumber === 2) {
      setFrame2Captured(true);
    }

    if (frameNumber === 3) {
      setFrame3Captured(true);
    }

    if (frameNumber === 4) {
      setFrame4Captured(true);
    }

    if (frameNumber === 5) {
      setFrame5Captured(true);
    }

    return true;
  }

  // ============================================================
  // STAGE 1
  // ============================================================

  function completeStage1() {
    if (
      completingRef.current ||
      stageRef.current !== 1 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current = true;

    stageRef.current = 2;

    setStatus(
      "Yawn detected! Capturing Frame 1...",
    );

    playStageBeep();

    captureFrame(1);

    setCalibration(0);
    setFaceDetected(false);

    console.log("🛑 STAGE 1 STOPPED");

    window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setStage(2);

      setStatus(
        "Stage 2 ready. Relax your eyes...",
      );

      completingRef.current = false;

      console.log("▶️ STAGE 2 STARTED");
    }, 1000);
  }

  // ============================================================
  // STAGE 2
  // ============================================================

  function completeStage2() {
    if (
      completingRef.current ||
      stageRef.current !== 2 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current = true;

    stageRef.current = 3;

    setStatus(
      "Droopy eyes detected! Capturing Frame 2...",
    );

    playStageBeep();

    captureFrame(2);

    setCalibration(0);
    setFaceDetected(false);

    console.log("🛑 STAGE 2 STOPPED");

    window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setStage(3);

      setStatus(
        "Stage 3 ready. Prepare your Zen pout...",
      );

      completingRef.current = false;

      console.log("▶️ STAGE 3 STARTED");
    }, 1000);
  }

  // ============================================================
  // STAGE 3
  // ============================================================

  function completeStage3() {
    if (
      completingRef.current ||
      stageRef.current !== 3 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current = true;

    stageRef.current = 4;

    setStatus(
      "Zen pout detected! Capturing Frame 3...",
    );

    playStageBeep();

    captureFrame(3);

    setCalibration(0);
    setFaceDetected(false);

    console.log("🛑 STAGE 3 STOPPED");

    window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      setStage(4);

      setStatus(
        "Stage 4 ready. Enter deep sleep...",
      );

      completingRef.current = false;

      console.log("▶️ STAGE 4 STARTED");
    }, 1000);
  }

  // ============================================================
  // STAGE 4 — COMA
  // ============================================================

  function completeStage4() {
    if (
      completingRef.current ||
      stageRef.current !== 4 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current = true;

    setStatus(
      "Coma detected! Capturing Frame 4...",
    );

    playStageBeep();

    captureFrame(4);

    setCalibration(1);
    setFaceDetected(false);

    console.log("🫠 COMA DETECTED");
    console.log("🛑 STAGE 4 STOPPED");

    window.setTimeout(() => {
      if (!mountedRef.current) {
        return;
      }

      completingRef.current = false;

      startSleepCountdown();
    }, 1000);
  }

  // ============================================================
  // COUNTDOWN
  // ============================================================

  function startSleepCountdown() {
    if (countdownStartedRef.current) {
      return;
    }

    countdownStartedRef.current = true;

    stopDetection();

    setMode("countdown");

    setCountdown(5);

    setStatus(
      "Hamster is going to sleep...",
    );

    playCountdownBeep();

    console.log(
      "🐹 HAMSTER GOING TO SLEEP",
    );

    let current = 5;

    countdownTimerRef.current =
      window.setInterval(() => {
        current -= 1;

        if (current > 0) {
          setCountdown(current);
          playCountdownBeep();

          console.log(
            `😴 COUNTDOWN: ${current}`,
          );

          return;
        }

        if (
          countdownTimerRef.current !==
          null
        ) {
          window.clearInterval(
            countdownTimerRef.current,
          );

          countdownTimerRef.current =
            null;
        }

        console.log(
          "😴 5 → 1 COMPLETE",
        );

        startDeepSleep();
      }, 1000);
  }

  // ============================================================
  // DEEP SLEEP
  // ============================================================

  function startDeepSleep() {
    setMode("deepSleep");

    setStatus("Deep Sleeping...");

    console.log("😴 DEEP SLEEPING");

    deepSleepTimerRef.current =
      window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        startShockDetection();
      }, 2000);
  }

  // ============================================================
  // SHOCK DETECTION
  // ============================================================

  function startShockDetection() {
    if (shockCheckingRef.current) {
      return;
    }

    shockCheckingRef.current = true;

    shockDetectedRef.current = false;
    shockCapturedRef.current = false;

    setShockTimeLeft(3);

    setMode("shockCheck");

    setStatus(
      "Shock detection starts!",
    );

    console.log(
      "⚡ SHOCK DETECTION STARTS",
    );

    animationRef.current =
      requestAnimationFrame(
        detectFace,
      );

    let remaining = 3;

    shockTimerRef.current =
      window.setInterval(() => {
        remaining -= 1;

        if (remaining > 0) {
          setShockTimeLeft(
            remaining,
          );

          return;
        }

        if (
          shockTimerRef.current !==
          null
        ) {
          window.clearInterval(
            shockTimerRef.current,
          );

          shockTimerRef.current = null;
        }

        finishShockDetection();
      }, 1000);
  }

  // ============================================================
  // FINISH SHOCK CHECK
  // ============================================================

  function finishShockDetection() {
    if (!shockCheckingRef.current) {
      return;
    }

    shockCheckingRef.current = false;

    stopDetection();

    console.log(
      "⏱️ 3 SECOND SHOCK CHECK FINISHED",
    );

    if (shockDetectedRef.current) {
      console.log(
        "😱 SHOCK REACTION FOUND",
      );

      setStatus(
        "😱 Shock reaction captured!",
      );

      window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        setMode("reveal");

        stopCamera();

        console.log(
          "🖼️ GALLERY — 5 IMAGES",
        );
      }, 700);

      return;
    }

    console.log(
      "😴 NO SHOCK DETECTED",
    );

    setMode("notSleeping");

    setStatus(
      "ഞാൻ ഉറങ്ങിയിട്ടില്ലെടാ!",
    );

    notSleepingTimerRef.current =
      window.setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }

        setMode("reveal");

        stopCamera();

        console.log(
          "🖼️ GALLERY — 4 IMAGES",
        );
      }, 1800);
  }

  // ============================================================
  // SHOCK CHECK
  // ============================================================

  function checkForShock(
    face: Landmark[],
  ) {
    const faceHeight = distance(
      face[10],
      face[152],
    );

    if (faceHeight <= 0) {
      return false;
    }

    const leftEyeGap = distance(
      face[159],
      face[145],
    );

    const rightEyeGap = distance(
      face[386],
      face[374],
    );

    const mouthGap = distance(
      face[13],
      face[14],
    );

    const leftEyeRatio =
      leftEyeGap / faceHeight;

    const rightEyeRatio =
      rightEyeGap / faceHeight;

    const mouthRatio =
      mouthGap / faceHeight;

    const averageEyeRatio =
      (leftEyeRatio +
        rightEyeRatio) /
      2;

    console.log(
      "⚡ SHOCK VALUES:",
      {
        eyeRatio:
          averageEyeRatio,
        mouthRatio,
      },
    );

    const eyesWide =
      averageEyeRatio > 0.030;

    const mouthOpen =
      mouthRatio > 0.070;

    return (
      eyesWide &&
      mouthOpen
    );
  }

  // ============================================================
  // FACE DETECTION
  // ============================================================

  function detectFace() {
    const currentMode =
      modeRef.current;

    if (
      currentMode !== "therapy" &&
      currentMode !== "shockCheck"
    ) {
      animationRef.current = null;
      return;
    }

    const video = videoRef.current;
    const landmarker =
      landmarkerRef.current;

    if (!video || !landmarker) {
      animationRef.current =
        requestAnimationFrame(
          detectFace,
        );

      return;
    }

    if (
      video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace,
        );

      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace,
        );

      return;
    }

    try {
      const result =
        landmarker.detectForVideo(
          video,
          performance.now(),
        );

      if (
        result.faceLandmarks.length >
        0
      ) {
        const face =
          result.faceLandmarks[0] as Landmark[];

        setFaceDetected(true);

        // ======================================================
        // SHOCK MODE
        // ======================================================

        if (
          currentMode ===
          "shockCheck"
        ) {
          if (
            !shockDetectedRef.current
          ) {
            const shocked =
              checkForShock(face);

            if (shocked) {
              shockDetectedRef.current =
                true;

              console.log(
                "😱 SHOCKED EXPRESSION DETECTED!",
              );

              void playShockBeep();

              if (
                !shockCapturedRef.current
              ) {
                shockCapturedRef.current =
                  true;

                const captured =
                  captureFrame(5);

                if (captured) {
                  console.log(
                    "📸 SHOCK IMAGE / FRAME 5 SAVED",
                  );
                }
              }

              setStatus(
                "😱 Shock detected!",
              );

              stopDetection();

              shockCheckingRef.current =
                false;

              if (
                shockTimerRef.current !==
                null
              ) {
                window.clearInterval(
                  shockTimerRef.current,
                );

                shockTimerRef.current =
                  null;
              }

              window.setTimeout(() => {
                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setMode("reveal");

                stopCamera();

                console.log(
                  "🖼️ GALLERY OPENED",
                );
              }, 700);

              return;
            }
          }

          animationRef.current =
            requestAnimationFrame(
              detectFace,
            );

          return;
        }

        // ======================================================
        // NORMAL THERAPY
        // ======================================================

        const currentStage =
          stageRef.current;

        const faceHeight =
          distance(
            face[10],
            face[152],
          );

        if (
          faceHeight > 0 &&
          !completingRef.current
        ) {
          // ====================================================
          // STAGE 1
          // ====================================================

          if (
            currentStage === 1
          ) {
            const mouthGap =
              distance(
                face[13],
                face[14],
              );

            const mouthRatio =
              mouthGap /
              faceHeight;

            const progress =
              Math.min(
                mouthRatio / 0.05,
                1,
              );

            setCalibration(
              progress,
            );

            console.log(
              "STAGE 1:",
              mouthRatio,
            );

            if (
              mouthRatio >
              0.05
            ) {
              completeStage1();
            }
          }

          // ====================================================
          // STAGE 2
          // ====================================================

          else if (
            currentStage === 2
          ) {
            const leftEye =
              distance(
                face[159],
                face[145],
              );

            const rightEye =
              distance(
                face[386],
                face[374],
              );

            const eyeRatio =
              ((leftEye +
                rightEye) /
                2) /
              faceHeight;

            const progress =
              Math.min(
                Math.max(
                  (0.022 -
                    eyeRatio) /
                    0.022,
                  0,
                ),
                1,
              );

            setCalibration(
              progress,
            );

            console.log(
              "STAGE 2:",
              eyeRatio,
            );

            if (
              eyeRatio <
              0.022
            ) {
              completeStage2();
            }
          }

          // ====================================================
          // STAGE 3
          // ====================================================

          else if (
            currentStage === 3
          ) {
            const mouthWidth =
              distance(
                face[61],
                face[291],
              );

            const cheekWidth =
              distance(
                face[234],
                face[454],
              );

            if (
              cheekWidth > 0
            ) {
              const mouthWidthRatio =
                mouthWidth /
                cheekWidth;

              const progress =
                Math.min(
                  Math.max(
                    (0.32 -
                      mouthWidthRatio) /
                      0.32,
                    0,
                  ),
                  1,
                );

              setCalibration(
                progress,
              );

              console.log(
                "STAGE 3:",
                mouthWidthRatio,
              );

              if (
                mouthWidthRatio <
                0.32
              ) {
                completeStage3();
              }
            }
          }

          // ====================================================
          // STAGE 4
          // ====================================================

          else if (
            currentStage === 4
          ) {
            const eyeGap =
              distance(
                face[159],
                face[145],
              );

            const mouthGap =
              distance(
                face[13],
                face[14],
              );

            const eyeRatio =
              eyeGap /
              faceHeight;

            const mouthRatio =
              mouthGap /
              faceHeight;

            console.log(
              "STAGE 4:",
              {
                eyeRatio,
                mouthRatio,
              },
            );

            const coma =
              eyeRatio <
                0.012 &&
              mouthRatio >
                0.07;

            if (coma) {
              setCalibration(1);

              completeStage4();
            } else {
              const eyeProgress =
                Math.min(
                  1,
                  Math.max(
                    0,
                    (0.022 -
                      eyeRatio) /
                      0.022,
                  ),
                );

              const mouthProgress =
                Math.min(
                  1,
                  mouthRatio /
                    0.07,
                );

              setCalibration(
                Math.min(
                  eyeProgress,
                  mouthProgress,
                ),
              );
            }
          }
        }
      } else {
        setFaceDetected(false);

        if (
          currentMode ===
            "therapy" &&
          !completingRef.current
        ) {
          setCalibration(0);
        }
      }
    } catch (err) {
      console.error(
        "MediaPipe detection error:",
        err,
      );
    }

    if (
      modeRef.current ===
        "therapy" ||
      modeRef.current ===
        "shockCheck"
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace,
        );
    }
  }

  // ============================================================
  // RESTART
  // ============================================================

  function restart() {
    for (let i = 1; i <= 5; i++) {
      sessionStorage.removeItem(
        `hamster_frame_${i}`,
      );
    }

    window.location.reload();
  }

  // ============================================================
  // GET FRAME
  // ============================================================

  function getFrame(
    number: number,
  ) {
    return sessionStorage.getItem(
      `hamster_frame_${number}`,
    );
  }

  // ============================================================
  // CAPTURED FRAMES FOR VIDEO
  // ============================================================

  function getCapturedFrames() {
    const frames: {
      frame: number;
      image: string;
    }[] = [];

    for (let i = 1; i <= 5; i++) {
      const image = getFrame(i);

      if (image) {
        frames.push({
          frame: i,
          image,
        });
      }
    }

    return frames;
  }

  // ============================================================
  // GENERATE SESSION VIDEO
  // ============================================================

  async function generateVideo() {
    if (videoGenerating) {
      return;
    }

    const frames = getCapturedFrames();

    if (frames.length === 0) {
      setVideoError(
        "No captured frames available.",
      );

      return;
    }

    if (
      typeof MediaRecorder === "undefined" ||
      typeof HTMLCanvasElement.prototype.captureStream !==
        "function"
    ) {
      setVideoError(
        "Video recording is not supported in this browser. Try Chrome or Edge.",
      );

      return;
    }

    setVideoGenerating(true);
    setVideoError("");

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      const canvas =
        document.createElement(
          "canvas",
        );

      canvas.width = 1280;
      canvas.height = 720;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) {
        throw new Error(
          "Could not create video canvas.",
        );
      }

      const stream =
        canvas.captureStream(30);

      const mimeTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];

      const mimeType =
        mimeTypes.find((type) =>
          MediaRecorder.isTypeSupported(
            type,
          ),
        ) || "";

      if (!mimeType) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop(),
          );

        throw new Error(
          "This browser cannot create a WebM video.",
        );
      }

      const recorder =
        new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 4_000_000,
        });

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (
        event,
      ) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopped =
        new Promise<void>(
          (resolve) => {
            recorder.onstop = () => {
              resolve();
            };
          },
        );

      recorder.start(250);

      function drawFrame(
        image: HTMLImageElement,
      ) {
        ctx.fillStyle = "#020617";

        ctx.fillRect(
          0,
          0,
          canvas.width,
          canvas.height,
        );

        const scale = Math.min(
          canvas.width /
            image.naturalWidth,
          canvas.height /
            image.naturalHeight,
        );

        const width =
          image.naturalWidth * scale;

        const height =
          image.naturalHeight * scale;

        const x =
          (canvas.width - width) /
          2;

        const y =
          (canvas.height - height) /
          2;

        ctx.drawImage(
          image,
          x,
          y,
          width,
          height,
        );
      }

      for (const frame of frames) {
        const image = new Image();

        image.src = frame.image;

        await new Promise<void>(
          (resolve, reject) => {
            image.onload = () =>
              resolve();

            image.onerror = () =>
              reject(
                new Error(
                  `Could not load Frame ${frame.frame}.`,
                ),
              );
          },
        );

        const startTime =
          performance.now();

        while (
          performance.now() -
            startTime <
          FRAME_DURATION
        ) {
          drawFrame(image);

          await new Promise<void>(
            (resolve) => {
              requestAnimationFrame(
                () => resolve(),
              );
            },
          );
        }
      }

      recorder.stop();

      await stopped;

      stream
        .getTracks()
        .forEach((track) =>
          track.stop(),
        );

      const blob = new Blob(
        chunks,
        {
          type: mimeType,
        },
      );

      const url =
        URL.createObjectURL(blob);

      setVideoUrl(url);
      playSuccessBeep();

      console.log(
        `🎥 VIDEO CREATED — ${frames.length * 2} SECONDS`,
      );
    } catch (err) {
      console.error(
        "VIDEO GENERATION ERROR:",
        err,
      );

      if (err instanceof Error) {
        setVideoError(err.message);
      } else {
        setVideoError(
          "Could not create session video.",
        );
      }
    } finally {
      setVideoGenerating(false);
    }
  }

  const imageClass =
    imageSize === "small"
      ? "max-h-56"
      : imageSize === "large"
        ? "max-h-[600px]"
        : "max-h-[400px]";
  // ============================================================
  // THERAPY SCREEN
  // ============================================================

  function renderTherapy() {
    const info = stageInfo[stage];

    const capturedForStage =
      stage === 1
        ? frame1Captured
        : stage === 2
          ? frame2Captured
          : stage === 3
            ? frame3Captured
            : frame4Captured;

    const progressPercent =
      Math.max(
        3,
        Math.min(100, calibration * 100),
      );

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#fffaf5] text-slate-900">

        {/* BACKGROUND */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-pink-200/40 blur-3xl" />

          <div className="absolute -right-40 top-10 h-[450px] w-[450px] rounded-full bg-purple-200/40 blur-3xl" />

          <div className="absolute bottom-[-180px] left-[25%] h-[500px] w-[500px] rounded-full bg-orange-200/30 blur-3xl" />

          <div className="absolute left-[8%] top-[28%] text-4xl opacity-20">
            ✨
          </div>

          <div className="absolute right-[8%] top-[42%] text-5xl opacity-15">
            🐹
          </div>

          <div className="absolute bottom-[15%] right-[15%] text-4xl opacity-15">
            ⭐
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

          {/* ==================================================
              HEADER
          ================================================== */}

          <header className="mb-7 flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg ring-1 ring-black/5">
                🐹
              </div>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
                  Hamster Therapy
                </p>

                <p className="mt-0.5 text-sm font-black text-slate-800">
                  Hamster Sleep Journey
                </p>
              </div>

            </div>

            <div className="hidden items-center gap-2 rounded-full border border-white bg-white/80 px-4 py-2.5 text-xs font-bold text-slate-500 shadow-sm backdrop-blur sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Private & Local
            </div>

          </header>

<div className="text-center">
  <h1 className="text-4xl font-extrabold text-pink-500 sm:text-6xl md:text-7xl">
    എലി കുട്ടനെ ഉറങ്ങാൻ സഹായിക്കാമോ?
  </h1>

  <h2 className="mt-4 text-2xl font-bold text-pink-400 sm:text-3xl md:text-4xl">
    നിങ്ങളുടെ മുഖഭാവം കൊണ്ട് എലി കുട്ടനെ ഉറക്കൂ
  </h2>
</div>
<br />
          {/* ==================================================
              PROGRESS CARD
          ================================================== */}

          <section className="mb-6 rounded-[2rem] border border-white bg-white/80 p-5 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-6">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  Your Journey
                </p>

                <p className="mt-1 text-sm font-black text-slate-800">
                  Relaxation Progress
                </p>
              </div>

              <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
                {stage} / 4
              </div>

            </div>

            <div className="flex items-center gap-2 sm:gap-3">

              {[1, 2, 3, 4].map((step) => {

                const completed = step < stage;
                const active = step === stage;

                return (
                  <div
                    key={step}
                    className="flex flex-1 items-center gap-2"
                  >

                    <div
                      className={`
                        relative flex h-10 w-10 shrink-0
                        items-center justify-center rounded-full
                        text-xs font-black transition-all duration-500
                        ${
                          completed
                            ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200"
                            : active
                              ? "scale-110 bg-slate-950 text-white shadow-xl"
                              : "bg-slate-100 text-slate-400"
                        }
                      `}
                    >
                      {completed ? "✓" : step}

                      {active && (
                        <span className="absolute inset-0 animate-ping rounded-full bg-slate-900/20" />
                      )}
                    </div>

                    {step !== 4 && (
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            completed
                              ? "w-full bg-emerald-500"
                              : "w-0"
                          }`}
                        />
                      </div>
                    )}

                  </div>
                );
              })}

            </div>

            <div className="mt-4 grid grid-cols-4 text-center text-[9px] font-black uppercase tracking-wider text-slate-400 sm:text-[10px]">

              <span
                className={
                  stage >= 1
                    ? "text-slate-800"
                    : ""
                }
              >
                Yawn
              </span>

              <span
                className={
                  stage >= 2
                    ? "text-slate-800"
                    : ""
                }
              >
                Daze
              </span>

              <span
                className={
                  stage >= 3
                    ? "text-slate-800"
                    : ""
                }
              >
                Zen
              </span>

              <span
                className={
                  stage >= 4
                    ? "text-slate-800"
                    : ""
                }
              >
                Coma
              </span>

            </div>

          </section>

          {/* ==================================================
              MAIN CARD
          ================================================== */}

          <section className="overflow-hidden rounded-[2.25rem] border border-white bg-white shadow-2xl shadow-slate-300/40">

            {/* GRADIENT TOP */}
            <div className="h-2 w-full bg-gradient-to-r from-pink-400 via-purple-500 to-orange-300" />

            <div className="p-5 sm:p-8 md:p-12">

              {/* TOP STATUS */}

              <div className="flex items-center justify-between gap-3">

                <div className="rounded-full bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Stage {stage}
                </div>

                {faceDetected ? (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    Face detected
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    Finding face
                  </div>
                )}

              </div>

              {/* ==================================================
                  HERO
              ================================================== */}

              <div className="mx-auto mt-9 max-w-3xl text-center">

                <div className="relative mx-auto w-fit">

                  <div className="absolute inset-0 scale-110 rounded-[2rem] bg-gradient-to-br from-pink-200 via-purple-200 to-orange-100 opacity-60 blur-xl" />

                  <div className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border border-white bg-gradient-to-br from-pink-100 via-purple-100 to-orange-100 text-7xl shadow-xl sm:h-36 sm:w-36 sm:text-8xl">
                    {info.emoji}
                  </div>

                </div>

                <p className="mt-7 text-[10px] font-black uppercase tracking-[0.32em] text-purple-500">
                  {info.technique}
                </p>

                <h1 className="mt-3 text-5xl font-black tracking-[-0.04em] text-slate-950 sm:text-6xl md:text-7xl">
                  {info.title}
                </h1>

                <p className="mt-3 text-base font-medium text-slate-400 sm:text-lg">
                  {info.subtitle}
                </p>

              </div>

              {/* ==================================================
                  INSTRUCTION GRID
              ================================================== */}

              <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">

                {/* SCIENCE CARD */}

                <div className="group rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-xl transition-transform duration-300 hover:-translate-y-1">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl">
                      🧠
                    </div>

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Therapy Method
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {info.technique}
                      </p>
                    </div>

                  </div>

                  <p className="mt-5 text-sm leading-7 text-slate-300">
                    {info.description}
                  </p>

                </div>

                {/* HAMSTER CARD */}

                <div className="group rounded-[1.75rem] border border-amber-100 bg-gradient-to-br from-amber-50 via-orange-50 to-pink-50 p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">

                  <div className="flex items-center gap-3">

                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                      🐹
                    </div>

                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-500">
                        Hamster Says
                      </p>

                      <p className="mt-1 text-sm font-black text-slate-800">
                        ഇപ്പോൾ ചെയ്യേണ്ടത്
                      </p>
                    </div>

                  </div>

                  <p className="mt-5 text-lg font-black leading-8 text-slate-900">
                    {info.malayalam}
                  </p>

                  <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
                    {info.instruction}
                  </p>

                </div>

              </div>

              {/* ==================================================
                  CALIBRATION
              ================================================== */}

              <div className="mx-auto mt-5 max-w-4xl rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6 sm:p-7">

                <div className="flex items-start justify-between gap-4">

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                      {info.calibrationLabel}
                    </p>

                    <p className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                      {stage === 4
                        ? `${(
                            calibration * 100
                          ).toFixed(0)}%`
                        : calibration.toFixed(3)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white bg-white px-4 py-3 text-right shadow-sm">

                    <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Target
                    </p>

                    <p className="mt-1 text-xs font-black text-slate-600">
                      {info.target}
                    </p>

                  </div>

                </div>

                <div className="mt-7 h-4 overflow-hidden rounded-full bg-slate-200 p-0.5">

                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-400 via-purple-500 to-indigo-500 transition-all duration-300"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />

                </div>

                <div className="mt-3 flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <span>Start</span>
                  <span>Relax</span>
                  <span>Target</span>
                </div>

                {capturedForStage && (
                  <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-600">
                    <span>✓</span>
                    Frame {stage} captured successfully
                  </div>
                )}

              </div>

              {/* ==================================================
                  SYSTEM STATUS
              ================================================== */}

              <div className="mx-auto mt-5 max-w-4xl rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">

                <div className="flex items-center gap-3">

                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      cameraReady
                        ? "bg-emerald-50 text-emerald-500"
                        : "bg-red-50 text-red-500"
                    }`}
                  >
                    {cameraReady ? "✓" : "!"}
                  </div>

                  {/* <div className="min-w-0 flex-1">

                    <div className="flex items-center justify-between gap-3">

                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                        System Status
                      </p>

                      <span
                        className={`text-[9px] font-black uppercase tracking-wider ${
                          cameraReady
                            ? "text-emerald-500"
                            : "text-red-500"
                        }`}
                      >
                        {cameraReady
                          ? "Online"
                          : "Offline"}
                      </span>

                    </div>

                    <p className="mt-1 truncate text-sm font-bold text-slate-700">
                      {cameraReady
                        ? "Camera active • Preview hidden"
                        : "Camera inactive"}
                    </p>

                  </div> */}

                </div>

                <div className="mt-4 border-t border-slate-100 pt-4">

                  <p className="text-xs leading-6 text-slate-400">
                    {status}
                  </p>

                </div>

              </div>

              {/* ==================================================
                  ERROR
              ================================================== */}

              {error && (
                <div className="mx-auto mt-5 max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">

                  <div className="flex gap-4">

                    <div className="text-2xl">
                      ⚠️
                    </div>

                    <div>
                      <p className="font-black">
                        Camera / Face Detection Error
                      </p>

                      <p className="mt-2 text-sm leading-6">
                        {error}
                      </p>
                    </div>

                  </div>

                </div>
              )}

            </div>
          </section>

          {/* ==================================================
              PRIVACY FOOTER
          ================================================== */}

          <div className="mt-6 flex justify-center">

            <div className="flex items-center gap-2 rounded-full border border-white bg-white/70 px-5 py-3 text-[10px] font-bold text-slate-400 shadow-sm backdrop-blur">
              🔒 Processing happens locally
              <span className="text-slate-300">•</span>
              Camera preview stays hidden
            </div>

          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // COUNTDOWN SCREEN
  // ============================================================

  function renderCountdown() {
    const progress =
      ((5 - countdown) / 4) * 100;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#100d18] text-white">

        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/20 blur-[100px]" />

          <div className="absolute left-10 top-10 text-4xl opacity-20">
            ✨
          </div>

          <div className="absolute right-10 top-24 text-5xl opacity-20">
            🌙
          </div>

          <div className="absolute bottom-16 left-12 text-4xl opacity-20">
            ⭐
          </div>
        </div>

        <div className="relative flex min-h-screen items-center justify-center px-6">

          <div className="w-full max-w-xl text-center">

            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/10 bg-white/5 text-6xl shadow-2xl backdrop-blur-xl">
              🐹
            </div>

            <p className="mt-8 text-[10px] font-black uppercase tracking-[0.45em] text-purple-300">
              Therapy Complete
            </p>

            <h1 className="mt-4 text-3xl font-black sm:text-5xl">
              Hamster is going to sleep
            </h1>

            <p className="mt-3 text-sm text-slate-500">
              Prepare yourself for deep relaxation.
            </p>

            <div className="relative mx-auto mt-10 flex h-64 w-64 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] shadow-2xl">

              <div className="absolute inset-4 rounded-full border border-purple-400/20" />

              <div className="absolute inset-8 rounded-full border border-purple-400/10" />

              <div className="text-[9rem] font-black leading-none tracking-[-0.08em] text-white">
                {countdown}
              </div>

            </div>

            <div className="mx-auto mt-10 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">

              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all duration-700"
                style={{
                  width: `${Math.max(
                    8,
                    progress,
                  )}%`,
                }}
              />

            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
              <span>😴</span>
              <span>Good night...</span>
              <span>💤</span>
            </div>

          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // DEEP SLEEP SCREEN
  // ============================================================

  function renderDeepSleep() {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#090812] text-white">

        <div className="absolute inset-0">

          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[120px]" />

          <div className="absolute left-[12%] top-[18%] text-3xl opacity-20">
            ✦
          </div>

          <div className="absolute right-[15%] top-[28%] text-4xl opacity-20">
            ✧
          </div>

          <div className="absolute bottom-[20%] left-[20%] text-3xl opacity-15">
            ⭐
          </div>

        </div>

        <div className="relative flex min-h-screen items-center justify-center px-6">

          <div className="text-center">

            <div className="relative mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-white/[0.03] shadow-2xl">

              <div className="absolute inset-0 animate-ping rounded-full border border-indigo-400/10" />

              <div className="text-8xl animate-pulse">
                🐹💤
              </div>

            </div>

            <p className="mt-10 text-[10px] font-black uppercase tracking-[0.5em] text-indigo-300">
              Sleep Mode
            </p>

            <h1 className="mt-5 text-5xl font-black tracking-tight sm:text-7xl">
              Deep Sleeping
              <span className="animate-pulse">...</span>
            </h1>

            <p className="mx-auto mt-5 max-w-md text-base leading-7 text-slate-500">
              Everything is peaceful.
              <br />
              Let the hamster sleep.
            </p>

            <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-5 py-3 text-xs font-bold text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
              Relaxation in progress
            </div>

          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // SHOCK SCREEN
  // ============================================================

  function renderShockCheck() {
    const progress =
      ((3 - shockTimeLeft) / 3) * 100;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#090608] text-white">

        <div className="absolute inset-0">

          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-600/10 blur-[120px]" />

          <div className="absolute left-10 top-20 text-4xl opacity-20">
            ⚡
          </div>

          <div className="absolute right-10 top-32 text-4xl opacity-20">
            ⚡
          </div>

        </div>

        <div className="relative flex min-h-screen items-center justify-center px-6">

          <div className="w-full max-w-xl text-center">

            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] border border-red-500/20 bg-red-500/5 text-7xl shadow-2xl">
              🐹
            </div>

            <div className="mt-9">

              <p className="text-[10px] font-black uppercase tracking-[0.45em] text-red-500">
                ⚡ Final Test
              </p>

              <h1 className="mt-4 text-4xl font-black sm:text-6xl">
                Shock Detection
              </h1>

              <p className="mt-3 text-sm text-slate-500">
                Stay still... we're watching 👀
              </p>

            </div>

            <div className="relative mx-auto mt-10 flex h-60 w-60 items-center justify-center rounded-full border border-red-500/10 bg-red-500/[0.03]">

              <div className="absolute inset-4 rounded-full border border-red-500/10" />

              <div className="absolute inset-10 rounded-full border border-red-500/10" />

              <div className="text-[9rem] font-black leading-none text-white">
                {shockTimeLeft}
              </div>

            </div>

            <div className="mx-auto mt-9 h-2 max-w-sm overflow-hidden rounded-full bg-white/10">

              <div
                className="h-full rounded-full bg-red-500 transition-all duration-1000"
                style={{
                  width: `${Math.max(
                    8,
                    progress,
                  )}%`,
                }}
              />

            </div>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-red-500/10 bg-red-500/5 px-5 py-3 text-xs font-bold text-red-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Looking for shocked expression
            </div>

          </div>

        </div>
      </main>
    );
  }

  // ============================================================
  // NOT SLEEPING SCREEN
  // ============================================================

  function renderNotSleeping() {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[#0d0b12] text-white">

        <div className="absolute inset-0">

          <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/10 blur-[110px]" />

        </div>

        <div className="relative flex min-h-screen items-center justify-center px-6">

          <div className="text-center">

            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2.5rem] bg-white/[0.04] text-[7rem] shadow-2xl">
              🐹
            </div>

            <p className="mt-10 text-[10px] font-black uppercase tracking-[0.45em] text-slate-500">
              Shock Test Complete
            </p>

            <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
              ഞാൻ ഉറങ്ങിയിട്ടില്ലെടാ!
            </h1>

            <p className="mt-5 text-xl font-bold text-slate-300">
              Nice try. 😏
            </p>

            <p className="mt-3 text-sm text-slate-600">
              No shocked expression detected.
            </p>

            <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-full border border-white/5 bg-white/[0.03] px-5 py-3 text-xs font-bold text-slate-500">
              ✓ Calm reaction
            </div>

          </div>

        </div>
      </main>
    );
  }
    // ============================================================
  // GALLERY
  // ============================================================

  function renderGallery() {
    const capturedFrames =
      getCapturedFrames();

    const totalSeconds =
      capturedFrames.length * 2;

    return (
      <main className="relative min-h-screen overflow-hidden bg-[#fffaf5] text-slate-900">

        {/* ==================================================
            BACKGROUND
        ================================================== */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">

          <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-pink-200/30 blur-3xl" />

          <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-purple-200/30 blur-3xl" />

          <div className="absolute bottom-[-200px] left-[30%] h-[500px] w-[500px] rounded-full bg-orange-200/30 blur-3xl" />

          <div className="absolute left-10 top-28 text-4xl opacity-20">
            ✨
          </div>

          <div className="absolute right-10 top-44 text-5xl opacity-15">
            🐹
          </div>

          <div className="absolute bottom-20 right-20 text-4xl opacity-15">
            ⭐
          </div>

        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

          {/* ==================================================
              HEADER
          ================================================== */}

          <header className="mx-auto max-w-4xl text-center">

            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white bg-white text-6xl shadow-xl">
              🐹
            </div>

            <p className="mt-7 text-[10px] font-black uppercase tracking-[0.4em] text-purple-500">
              Hamster Therapy
            </p>

            <h1 className="mt-3 text-5xl font-black tracking-[-0.04em] text-slate-950 sm:text-6xl md:text-7xl">
              Your Results
            </h1>

            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-400 sm:text-lg">
              Your facial relaxation journey,
              captured one expression at a time.
            </p>

            {/* SESSION META */}

            <div className="mt-7 flex flex-wrap justify-center gap-3">

              <div className="rounded-full border border-white bg-white px-5 py-2.5 text-xs font-black text-slate-600 shadow-sm">
                📸 {capturedFrames.length} frames
              </div>

              <div className="rounded-full border border-white bg-white px-5 py-2.5 text-xs font-black text-slate-600 shadow-sm">
                🎬 {totalSeconds}s session
              </div>

              <div className="rounded-full border border-emerald-100 bg-emerald-50 px-5 py-2.5 text-xs font-black text-emerald-600 shadow-sm">
                ✓ Session complete
              </div>

            </div>

          </header>

          {/* ==================================================
              IMAGE SIZE CONTROL
          ================================================== */}

          <section className="mx-auto mt-10 flex max-w-4xl flex-col items-center justify-between gap-4 rounded-[1.75rem] border border-white bg-white/80 p-4 shadow-lg shadow-slate-200/40 backdrop-blur sm:flex-row sm:p-5">

            <div className="text-center sm:text-left">

              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
                Gallery View
              </p>

              <p className="mt-1 text-sm font-black text-slate-800">
                Choose your frame size
              </p>

            </div>

            <div className="flex rounded-2xl bg-slate-100 p-1">

              {(
                [
                  ["small", "Small"],
                  ["medium", "Medium"],
                  ["large", "Large"],
                ] as const
              ).map(([size, label]) => (

                <button
                  key={size}
                  type="button"
                  onClick={() =>
                    setImageSize(size)
                  }
                  className={`
                    rounded-xl px-4 py-2.5 text-xs
                    font-black transition-all duration-200
                    ${
                      imageSize === size
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-400 hover:text-slate-700"
                    }
                  `}
                >
                  {label}
                </button>

              ))}

            </div>

          </section>

          {/* ==================================================
              GALLERY GRID
          ================================================== */}

          <section className="mx-auto mt-8 grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">

            <GalleryCard
              frame={1}
              emoji="🥱"
              title="The Yawn"
              trollMessage={
                trollingMessages[1]
              }
              image={getFrame(1)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={2}
              emoji="😴"
              title="Droopy Daze"
              trollMessage={
                trollingMessages[2]
              }
              image={getFrame(2)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={3}
              emoji="😗"
              title="Zen Pout"
              trollMessage={
                trollingMessages[3]
              }
              image={getFrame(3)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={4}
              emoji="🫠"
              title="Coma"
              trollMessage={
                trollingMessages[4]
              }
              image={getFrame(4)}
              imageClass={imageClass}
            />

            {frame5Captured &&
              getFrame(5) && (
                <div className="lg:col-span-2">
                  <GalleryCard
                    frame={5}
                    emoji="😱"
                    title="SHOCK REACTION"
                    trollMessage={
                      trollingMessages[5]
                    }
                    image={getFrame(5)}
                    imageClass={imageClass}
                    shocked
                  />
                </div>
              )}

          </section>

          {/* ==================================================
              FINAL RESULT
          ================================================== */}

          <section
            className={`
              mx-auto mt-8 max-w-6xl overflow-hidden
              rounded-[2rem] p-7 text-white shadow-2xl
              sm:p-10 md:p-12
              ${
                frame5Captured
                  ? "bg-gradient-to-br from-red-600 via-rose-600 to-orange-500"
                  : "bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950"
              }
            `}
          >

            <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">

              <div>

                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] opacity-60">
                  <span>Final Result</span>
                  <span>•</span>
                  <span>Complete</span>
                </div>

                {frame5Captured ? (
                  <>
                    <h2 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
                      😂 GOTCHA!
                    </h2>

                    <p className="mt-4 max-w-xl text-base leading-7 text-white/75">
                      We caught your shocked reaction.
                      The hamster officially has evidence.
                    </p>

                    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black backdrop-blur">
                      😱 Frame 5 successfully captured
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 text-5xl font-black tracking-tight sm:text-6xl">
                      😏 NICE TRY!
                    </h2>

                    <p className="mt-4 max-w-xl text-base leading-7 text-white/60">
                      You stayed calm during the
                      entire 3-second shock check.
                      The hamster couldn't catch you.
                    </p>

                    <div className="mt-6 inline-flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3 text-sm font-black backdrop-blur">
                      🧘 Calm reaction
                    </div>
                  </>
                )}

              </div>

              <div className="hidden shrink-0 text-[8rem] leading-none opacity-90 md:block">
                {frame5Captured
                  ? "😱"
                  : "😎"}
              </div>

            </div>

          </section>

          {/* ==================================================
              SESSION VIDEO
          ================================================== */}

          <section className="mx-auto mt-8 max-w-6xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl shadow-slate-200/50">

            {/* VIDEO HEADER */}

            <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950 px-6 py-8 text-white sm:px-8">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-purple-300">
                    <span>🎬</span>
                    <span>Session Memory</span>
                  </div>

                  <h2 className="mt-2 text-3xl font-black sm:text-4xl">
                    Session Video
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {totalSeconds} seconds
                    {" "}
                    • 2 seconds per captured frame
                  </p>

                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl backdrop-blur">
                  🎞️
                </div>

              </div>

            </div>

            <div className="p-6 sm:p-8">

              {/* ==================================================
                  CREATE BUTTON
              ================================================== */}

              {!videoUrl &&
                !videoGenerating && (
                  <div className="py-8 text-center">

                    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-50 text-4xl">
                      🎥
                    </div>

                    <h3 className="mt-6 text-xl font-black text-slate-900">
                      Turn your memories into a video
                    </h3>

                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                      Each captured expression will stay
                      on screen for 2 seconds.
                    </p>

                    <button
                      type="button"
                      onClick={generateVideo}
                      className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-xl shadow-slate-300 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95"
                    >
                      🎬
                      Create Session Video
                      <span className="text-white/40">
                        →
                      </span>
                    </button>

                  </div>
                )}

              {/* ==================================================
                  GENERATING
              ================================================== */}

              {videoGenerating && (
                <div className="py-10 text-center">

                  <div className="relative mx-auto flex h-24 w-24 items-center justify-center">

                    <div className="absolute inset-0 animate-ping rounded-3xl bg-purple-100" />

                    <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-purple-50 text-4xl">
                      🎥
                    </div>

                  </div>

                  <h3 className="mt-7 text-2xl font-black text-slate-900">
                    Creating your session video...
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                    Please wait while your captured
                    frames are converted into a video.
                  </p>

                  <div className="mx-auto mt-7 max-w-sm">

                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">

                      <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />

                    </div>

                    <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Processing frames
                    </p>

                  </div>

                </div>
              )}

              {/* ==================================================
                  ERROR
              ================================================== */}

              {videoError &&
                !videoGenerating && (
                  <div className="rounded-3xl border border-red-200 bg-red-50 p-6">

                    <div className="flex gap-4">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-xl">
                        ⚠️
                      </div>

                      <div>

                        <p className="font-black text-red-700">
                          Video creation failed
                        </p>

                        <p className="mt-2 text-sm leading-6 text-red-600">
                          {videoError}
                        </p>

                      </div>

                    </div>

                  </div>
                )}

              {/* ==================================================
                  COMPLETED VIDEO
              ================================================== */}

              {videoUrl &&
                !videoGenerating && (
                  <div>

                    <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-2xl bg-emerald-50 px-5 py-4 sm:flex-row">

                      <div className="flex items-center gap-3">

                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                          ✓
                        </div>

                        <div>
                          <p className="text-sm font-black text-emerald-700">
                            Video completely generated!
                          </p>

                          <p className="text-xs text-emerald-600/70">
                            Your {totalSeconds}-second
                            session is ready.
                          </p>
                        </div>

                      </div>

                      <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
                        Ready
                      </span>

                    </div>

                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-black shadow-2xl">

                      <video
                        src={videoUrl}
                        controls
                        playsInline
                        className="mx-auto aspect-video w-full"
                      />

                    </div>

                    <div className="mt-6 flex justify-center">

                      <a
                        href={videoUrl}
                        download="hamster-therapy-session.webm"
                        className="inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-xl shadow-slate-300 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95"
                      >
                        ⬇️
                        Download Video
                      </a>

                    </div>

                  </div>
                )}

            </div>

          </section>

          {/* ==================================================
              FRAME SUMMARY
          ================================================== */}

          <section className="mx-auto mt-8 max-w-6xl">

            <div className="mb-5 text-center">

              <p className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
                Session Overview
              </p>

              <h2 className="mt-2 text-2xl font-black text-slate-900">
                Your therapy journey
              </h2>

            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">

              <Summary
                emoji="🥱"
                title="Frame 1"
                active={frame1Captured}
              />

              <Summary
                emoji="😴"
                title="Frame 2"
                active={frame2Captured}
              />

              <Summary
                emoji="😗"
                title="Frame 3"
                active={frame3Captured}
              />

              <Summary
                emoji="🫠"
                title="Frame 4"
                active={frame4Captured}
              />

              <Summary
                emoji="😱"
                title="Shock"
                active={frame5Captured}
              />

            </div>

          </section>

          {/* ==================================================
              TRY AGAIN
          ================================================== */}

          <section className="mx-auto mt-10 max-w-6xl text-center">

            <button
              type="button"
              onClick={restart}
              className="group inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-7 py-4 text-sm font-black text-white shadow-xl shadow-slate-300 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl active:scale-95"
            >
              <span className="transition-transform duration-300 group-hover:rotate-180">
                🐹
              </span>

              Try Again

              <span className="text-white/40">
                →
              </span>
            </button>

            <p className="mt-5 text-[10px] font-medium text-slate-400">
              Images are kept in this browser session only.
            </p>

          </section>

          {/* ==================================================
              PRIVACY
          ================================================== */}

          <footer className="mt-10 pb-6 text-center">

            <p className="inline-flex items-center gap-2 rounded-full border border-white bg-white/70 px-5 py-3 text-[10px] font-bold text-slate-400 shadow-sm">
              🔒
              Your session stays in this browser
              <span className="text-slate-300">
                •
              </span>
              No cloud upload
            </p>

          </footer>

        </div>
      </main>
    );
  }

  // ============================================================
  // ALWAYS-MOUNTED CAMERA + CANVAS
  // ============================================================

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
        style={{
          position: "fixed",
          left: "-10000px",
          top: "-10000px",
          width: "1px",
          height: "1px",
          opacity: 0,
          visibility: "hidden",
          pointerEvents: "none",
        }}
      />

      <canvas
        ref={canvasRef}
        style={{
          display: "none",
        }}
      />

      {mode === "therapy" &&
        renderTherapy()}

      {mode === "countdown" &&
        renderCountdown()}

      {mode === "deepSleep" &&
        renderDeepSleep()}

      {mode === "shockCheck" &&
        renderShockCheck()}

      {mode === "notSleeping" &&
        renderNotSleeping()}

      {mode === "reveal" &&
        renderGallery()}
    </>
  );
}

// ============================================================
// CALIBRATION
// ============================================================

function Calibration({
  label,
  value,
  target,
  captured,
  frame,
}: {
  label: string;
  value: string;
  target: string;
  captured: boolean;
  frame: number;
}) {
  return (
    <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">

      <div className="flex items-start justify-between gap-4">

        <div>

          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-4xl font-black text-slate-950">
            {value}
          </p>

        </div>

        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">

          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            Target
          </p>

          <p className="mt-1 text-xs font-black text-slate-600">
            {target}
          </p>

        </div>

      </div>

      {captured && (
        <div className="mt-5 rounded-2xl bg-emerald-50 px-4 py-3 text-center text-sm font-black text-emerald-600">
          📸 Frame {frame} captured!
        </div>
      )}

    </div>
  );
}

// ============================================================
// GALLERY CARD
// ============================================================

function GalleryCard({
  frame,
  emoji,
  title,
  trollMessage,
  image,
  imageClass,
  shocked = false,
}: {
  frame: number;
  emoji: string;
  title: string;
  trollMessage: string;
  image: string | null;
  imageClass: string;
  shocked?: boolean;
}) {
  if (!image) {
    return (
      <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-lg">

        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-5xl">
          {emoji}
        </div>

        <p className="mt-5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
          Frame {frame}
        </p>

        <h2 className="mt-2 text-xl font-black text-slate-800">
          No image captured
        </h2>

      </div>
    );
  }

  return (
    <article
      className={`
        group overflow-hidden rounded-[2rem] bg-white
        shadow-xl shadow-slate-200/50 transition-all duration-300
        hover:-translate-y-1 hover:shadow-2xl
        ${
          shocked
            ? "ring-4 ring-red-400/30"
            : "border border-slate-100"
        }
      `}
    >

      {/* ==================================================
          CARD HEADER
      ================================================== */}

      <div
        className={`
          flex items-center justify-between px-6 py-5
          ${
            shocked
              ? "bg-gradient-to-r from-red-600 to-orange-500 text-white"
              : "bg-slate-950 text-white"
          }
        `}
      >

        <div className="flex items-center gap-3">

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl">
            {emoji}
          </div>

          <div>

            <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">
              Frame {frame}
            </p>

            <h2 className="mt-1 text-lg font-black">
              {title}
            </h2>

          </div>

        </div>

        {shocked && (
          <span className="rounded-full bg-white/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider backdrop-blur">
            ⚡ Shock
          </span>
        )}

      </div>

      <div className="p-5 sm:p-6">

        {/* ==================================================
            TROLL MESSAGE FIRST
        ================================================== */}

        <div
          className={`
            relative overflow-hidden rounded-3xl p-5
            ${
              shocked
                ? "border border-red-100 bg-gradient-to-br from-red-50 to-orange-50"
                : "border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50"
            }
          `}
        >

          <div className="absolute -right-5 -top-5 text-6xl opacity-10">
            🐹
          </div>

          <div className="relative">

            <div className="flex items-center gap-2">

              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-sm">
                🐹
              </span>

              <p
                className={`
                  text-[9px] font-black uppercase tracking-[0.2em]
                  ${
                    shocked
                      ? "text-red-500"
                      : "text-amber-600"
                  }
                `}
              >
                Hamster's Opinion
              </p>

            </div>

            <p className="mt-4 text-base font-black leading-7 text-slate-800">
              {trollMessage}
            </p>

          </div>

        </div>

        {/* ==================================================
            IMAGE
        ================================================== */}

        <div className="mt-5 overflow-hidden rounded-3xl bg-slate-100 p-2">

          <div className="flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-200">

            <img
              src={image}
              alt={`Hamster Therapy ${title}`}
              className={`
                ${imageClass}
                w-auto max-w-full object-contain
                transition-transform duration-500
                group-hover:scale-[1.02]
              `}
            />

          </div>

        </div>

        {/* ==================================================
            DOWNLOAD
        ================================================== */}

        <a
          href={image}
          download={`hamster-therapy-frame-${frame}.jpg`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98]"
        >
          ⬇️
          Download Frame {frame}
        </a>

      </div>

    </article>
  );
}

// ============================================================
// SUMMARY
// ============================================================

function Summary({
  emoji,
  title,
  active,
}: {
  emoji: string;
  title: string;
  active: boolean;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-3xl border p-5
        text-center transition-all duration-300
        ${
          active
            ? "border-white bg-white shadow-lg shadow-slate-200/50"
            : "border-slate-200 bg-slate-100/70 opacity-60"
        }
      `}
    >

      {active && (
        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-black text-white">
          ✓
        </div>
      )}

      <div
        className={`
          mx-auto flex h-14 w-14 items-center
          justify-center rounded-2xl text-3xl
          ${
            active
              ? "bg-gradient-to-br from-pink-50 to-purple-50"
              : "bg-slate-200"
          }
        `}
      >
        {emoji}
      </div>

      <p className="mt-3 text-xs font-black text-slate-800">
        {title}
      </p>

      <p
        className={`
          mt-1 text-[9px] font-black uppercase tracking-wider
          ${
            active
              ? "text-emerald-500"
              : "text-slate-400"
          }
        `}
      >
        {active
          ? "Captured"
          : "Not captured"}
      </p>

    </div>
  );
}