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
  1: "ഇതാണോ നിന്റെ കൊട്ടാവാ? 😭 ഇത്രയും വലിയ വായ തുറന്നിട്ട് ഹാംസ്റ്ററിനെ പേടിപ്പിക്കാനാണോ നോക്കുന്നത് ഷാജീ?",
  2: "കണ്ണടച്ചാൽ ഉറക്കം വരുമെന്ന് കരുതിയോ? 😂 മുഖം കണ്ടിട്ട് ഹാംസ്റ്ററിനാണ് ഉറക്കം വന്നത്!",
  3: "ഈ Zen pout ആണോ? 😭 ചുണ്ട് കണ്ടിട്ട് ഹാംസ്റ്റർ പോലും ‘എന്താടാ ഇത്?’ എന്ന് ചോദിക്കും!",
  4: "COMA ആണെന്ന് പറഞ്ഞിട്ട് ഇങ്ങനെ കിടന്നോ? 😂 ഹാംസ്റ്ററിന് പോലും നിന്നേക്കാൾ നല്ല acting ഉണ്ട്!",
  5: "അയ്യോ ഷാജീ! 😱 പേടിച്ച മുഖം ക്യാമറയിൽ പിടിച്ചു! ഇതാണ് യഥാർത്ഥ therapy result 😂",
};

const FRAME_DURATION = 2000;

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

  // ============================================================
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

    console.log(
      "🐹 HAMSTER GOING TO SLEEP",
    );

    let current = 5;

    countdownTimerRef.current =
      window.setInterval(() => {
        current -= 1;

        if (current > 0) {
          setCountdown(current);

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

    // No beep yet.

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
      const canvas = document.createElement(
        "canvas",
      );

      canvas.width = 1280;
      canvas.height = 720;

      const ctx = canvas.getContext("2d");

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
          MediaRecorder.isTypeSupported(type),
        ) || "";

      if (!mimeType) {
        stream
          .getTracks()
          .forEach((track) => track.stop());

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

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const stopped = new Promise<void>(
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
          canvas.width / image.naturalWidth,
          canvas.height / image.naturalHeight,
        );

        const width =
          image.naturalWidth * scale;

        const height =
          image.naturalHeight * scale;

        const x =
          (canvas.width - width) / 2;

        const y =
          (canvas.height - height) / 2;

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
            image.onload = () => resolve();

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
          performance.now() - startTime <
          FRAME_DURATION
        ) {
          drawFrame(image);

          await new Promise<void>(
            (resolve) => {
              requestAnimationFrame(() =>
                resolve(),
              );
            },
          );
        }
      }

      recorder.stop();

      await stopped;

      stream
        .getTracks()
        .forEach((track) => track.stop());

      const blob = new Blob(chunks, {
        type: mimeType,
      });

      const url =
        URL.createObjectURL(blob);

      setVideoUrl(url);

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

  // ============================================================
  // IMAGE SIZE
  // ============================================================

  const imageClass =
    imageSize === "small"
      ? "max-h-56"
      : imageSize === "large"
        ? "max-h-[600px]"
        : "max-h-[400px]";

  // ============================================================
  // STAGE SCREEN
  // ============================================================

  function renderTherapy() {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl text-center">

          <div className="text-7xl mb-6">
            🐹
          </div>

          <p className="text-emerald-400 text-sm uppercase tracking-[0.3em]">
            Stage {stage} / 4
          </p>

          {stage === 1 && (
            <>
              <h1 className="text-5xl font-bold mt-4">
                🥱 The Yawn
              </h1>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-emerald-300 text-lg">
                  Vagus Nerve Decompression
                </p>

                <p className="text-slate-400 mt-3">
                  Expand your jaw vertically
                  to release facial tension.
                </p>
              </div>

              <div className="mt-8">
                <p className="text-xl">
                  ഇതൊരു കൊട്ടാവയാണോ?
                </p>

                <p className="text-slate-400 mt-2">
                  താടി തറയിൽ മുട്ടുന്നതുപോലെ
                  താഴോട്ട് വിടൂ ഷാജീ!
                </p>
              </div>

              <Calibration
                label="Mouth Calibration"
                value={calibration.toFixed(3)}
                target="Target: > 0.050"
                captured={frame1Captured}
                frame={1}
              />
            </>
          )}

          {stage === 2 && (
            <>
              <h1 className="text-5xl font-bold mt-4">
                😴 Droopy Daze
              </h1>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-emerald-300 text-lg">
                  Orbicularis Oculi Relaxation
                </p>

                <p className="text-slate-400 mt-3">
                  Slowly let your eyes become
                  heavy and sleepy.
                </p>
              </div>

              <div className="mt-8">
                <p className="text-xl">
                  കണ്ണുകൾക്ക് ഉറക്കം വരുന്നുണ്ടോ?
                </p>

                <p className="text-slate-400 mt-2">
                  പതുക്കെ കണ്ണുകൾ അടച്ച്
                  ക്ഷീണിച്ച പോലെ ഇരിക്കൂ ഷാജീ!
                </p>
              </div>

              <Calibration
                label="Eye Calibration"
                value={calibration.toFixed(3)}
                target="Target: < 0.022"
                captured={frame2Captured}
                frame={2}
              />
            </>
          )}

          {stage === 3 && (
            <>
              <h1 className="text-5xl font-bold mt-4">
                😗 Zen Pout
              </h1>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-emerald-300 text-lg">
                  Facial Relaxation
                </p>

                <p className="text-slate-400 mt-3">
                  Bring your lips together
                  into a tiny relaxed pout.
                </p>
              </div>

              <div className="mt-8">
                <p className="text-xl">
                  ഒരു ചെറിയ Zen pout ചെയ്യൂ 😗
                </p>

                <p className="text-slate-400 mt-2">
                  ചുണ്ട് ചെറുതായി മുന്നോട്ട്
                  തള്ളിക്കൊണ്ട് ഇരിക്കൂ ഷാജീ!
                </p>
              </div>

              <Calibration
                label="Pout Calibration"
                value={calibration.toFixed(3)}
                target="Target: < 0.320"
                captured={frame3Captured}
                frame={3}
              />
            </>
          )}

          {stage === 4 && (
            <>
              <h1 className="text-5xl font-bold mt-4">
                🫠 Coma
              </h1>

              <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <p className="text-emerald-300 text-lg">
                  Deep Facial Relaxation
                </p>

                <p className="text-slate-400 mt-3">
                  Close your eyes completely
                  while keeping your mouth open.
                </p>
              </div>

              <div className="mt-8">
                <p className="text-xl">
                  ഉറങ്ങിപ്പോയ പോലെ ഇരിക്കൂ... 😴
                </p>

                <p className="text-slate-400 mt-2">
                  കണ്ണുകൾ അടയ്ക്കൂ,
                  വായ തുറന്നുതന്നെ വെക്കൂ ഷാജീ!
                </p>
              </div>

              <Calibration
                label="Coma Calibration"
                value={`${(
                  calibration * 100
                ).toFixed(0)}%`}
                target="Eyes < 0.012 • Mouth > 0.070"
                captured={frame4Captured}
                frame={4}
              />
            </>
          )}

          <div className="mt-10">
            <p>
              <span
                className={`inline-block w-3 h-3 rounded-full mr-2 ${
                  cameraReady
                    ? "bg-emerald-400"
                    : "bg-red-500"
                }`}
              />

              {cameraReady
                ? "Camera active • Preview hidden"
                : "Camera inactive"}
            </p>

            <p className="text-slate-500 mt-3">
              {status}
            </p>
          </div>

          <div className="mt-6">
            <p
              className={
                faceDetected
                  ? "text-emerald-400"
                  : "text-slate-500"
              }
            >
              {faceDetected
                ? "🟢 Face detected"
                : "⚪ Looking for your face..."}
            </p>
          </div>

          {error && (
            <div className="mt-8 rounded-xl bg-red-950 border border-red-800 p-4 text-red-300">
              <p className="font-semibold">
                Camera / Face Detection Error
              </p>

              <p className="mt-2 text-sm">
                {error}
              </p>
            </div>
          )}

          <p className="mt-10 text-xs text-slate-600">
            Camera processing happens locally
            in your browser.
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // COUNTDOWN SCREEN
  // ============================================================

  function renderCountdown() {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">

          <div className="text-8xl mb-8">
            🐹💤
          </div>

          <p className="text-slate-500 uppercase tracking-[0.5em] text-sm">
            Hamster Going To Sleep
          </p>

          <div className="text-[12rem] md:text-[16rem] leading-none font-black mt-6">
            {countdown}
          </div>

          <p className="text-slate-500 text-xl mt-8">
            Good night...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // DEEP SLEEP SCREEN
  // ============================================================

  function renderDeepSleep() {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">

          <div className="text-[10rem] animate-pulse">
            🐹💤
          </div>

          <p className="text-emerald-400 uppercase tracking-[0.4em] text-sm mt-8">
            Sleep Mode
          </p>

          <h1 className="text-5xl md:text-7xl font-black mt-5">
            😴 Deep Sleeping...
          </h1>

          <p className="text-slate-500 text-lg mt-6">
            Everything is peaceful...
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // SHOCK SCREEN
  // ============================================================

  function renderShockCheck() {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center px-6">

          <div className="text-8xl animate-pulse">
            🐹
          </div>

          <p className="text-red-500 uppercase tracking-[0.4em] text-sm mt-8">
            ⚡ Shock Detection Starts
          </p>

          <div className="text-[10rem] font-black leading-none mt-5">
            {shockTimeLeft}
          </div>

          <p className="text-xl text-slate-400 mt-5">
            Stay still...
          </p>

          <div className="mt-8 h-2 w-64 mx-auto rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-red-500 transition-all duration-1000"
              style={{
                width: `${
                  (shockTimeLeft / 3) *
                  100
                }%`,
              }}
            />
          </div>

          <p className="text-slate-600 text-sm mt-6">
            Looking for shocked expression 👀
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // NO SHOCK
  // ============================================================

  function renderNotSleeping() {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center px-6">

          <div className="text-[9rem]">
            🐹
          </div>

          <h1 className="text-5xl md:text-7xl font-black mt-8">
            ഞാൻ ഉറങ്ങിയിട്ടില്ലെടാ!
          </h1>

          <p className="text-xl text-slate-400 mt-6">
            Nice try. 😏
          </p>

          <p className="text-slate-600 mt-3">
            No shocked expression detected.
          </p>
        </div>
      </main>
    );
  }

  // ============================================================
  // GALLERY
  // ============================================================

  function renderGallery() {
    return (
      <main className="min-h-screen bg-[#f5f0e6] text-slate-900 px-6 py-12">

        <div className="max-w-6xl mx-auto">

          <div className="text-center">

            <div className="text-7xl">
              🐹
            </div>

            <p className="uppercase tracking-[0.4em] text-sm text-slate-500 mt-6">
              Hamster Therapy
            </p>

            <h1 className="text-5xl md:text-7xl font-black mt-4">
              Gallery
            </h1>

            <p className="text-xl text-slate-500 mt-5">
              Your therapy session memories.
            </p>
          </div>

          {/* IMAGE SIZE CONTROLS */}

          <div className="flex justify-center flex-wrap gap-3 mt-10">

            <button
              onClick={() =>
                setImageSize("small")
              }
              className={`px-6 py-3 rounded-full font-semibold transition ${
                imageSize === "small"
                  ? "bg-black text-white"
                  : "bg-white"
              }`}
            >
              Small
            </button>

            <button
              onClick={() =>
                setImageSize("medium")
              }
              className={`px-6 py-3 rounded-full font-semibold transition ${
                imageSize === "medium"
                  ? "bg-black text-white"
                  : "bg-white"
              }`}
            >
              Medium
            </button>

            <button
              onClick={() =>
                setImageSize("large")
              }
              className={`px-6 py-3 rounded-full font-semibold transition ${
                imageSize === "large"
                  ? "bg-black text-white"
                  : "bg-white"
              }`}
            >
              Large
            </button>
          </div>

          {/* GALLERY */}

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">

            <GalleryCard
              frame={1}
              emoji="🥱"
              title="The Yawn"
              trollMessage={trollingMessages[1]}
              image={getFrame(1)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={2}
              emoji="😴"
              title="Droopy Daze"
              trollMessage={trollingMessages[2]}
              image={getFrame(2)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={3}
              emoji="😗"
              title="Zen Pout"
              trollMessage={trollingMessages[3]}
              image={getFrame(3)}
              imageClass={imageClass}
            />

            <GalleryCard
              frame={4}
              emoji="🫠"
              title="Coma"
              trollMessage={trollingMessages[4]}
              image={getFrame(4)}
              imageClass={imageClass}
            />

            {frame5Captured &&
              getFrame(5) && (
                <div className="md:col-span-2">
                  <GalleryCard
                    frame={5}
                    emoji="😱"
                    title="SHOCK REACTION"
                    trollMessage={trollingMessages[5]}
                    image={getFrame(5)}
                    imageClass={imageClass}
                    shocked
                  />
                </div>
              )}
          </div>

          {/* FINAL RESULT */}

          <div
            className={`mt-12 rounded-3xl p-8 md:p-12 text-white shadow-xl ${
              frame5Captured
                ? "bg-red-600"
                : "bg-slate-950"
            }`}
          >
            <p className="uppercase tracking-[0.3em] text-sm opacity-70">
              Final Result
            </p>

            {frame5Captured ? (
              <>
                <h2 className="text-4xl md:text-6xl font-black mt-4">
                  😂 GOTCHA!
                </h2>

                <p className="text-lg mt-5 opacity-80">
                  We caught your shocked reaction.
                </p>

                <p className="text-2xl font-bold mt-5">
                  Frame 5 successfully captured 😱
                </p>
              </>
            ) : (
              <>
                <h2 className="text-4xl md:text-6xl font-black mt-4">
                  😏 NICE TRY!
                </h2>

                <p className="text-lg mt-5 text-slate-400">
                  You stayed calm during the
                  entire 3-second shock check.
                </p>

                <p className="text-2xl font-bold mt-5">
                  No shock image captured.
                </p>
              </>
            )}
          </div>

          {/* ============================================================
              SESSION VIDEO
          ============================================================ */}

          <div className="mt-12 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">

            <div className="text-center">

              <h2 className="text-2xl font-black">
                🎬 Session Video
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                {getCapturedFrames().length * 2} seconds
                {" "}
                • 2 seconds per captured frame
              </p>

            </div>

            {/* CREATE BUTTON — ONLY BEFORE VIDEO EXISTS */}

            {!videoUrl && !videoGenerating && (
              <div className="mt-6 text-center">

                <button
                  type="button"
                  onClick={generateVideo}
                  className="rounded-2xl bg-black px-6 py-3 font-black text-white transition hover:scale-105"
                >
                  🎬 Create Session Video
                </button>

              </div>
            )}

            {/* GENERATING STATE */}

            {videoGenerating && (
              <div className="mt-8 text-center">

                <div className="text-5xl animate-pulse">
                  🎥
                </div>

                <p className="mt-4 text-lg font-black">
                  Creating your session video...
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Please wait. Your frames are being
                  converted into a video.
                </p>

                <div className="mx-auto mt-5 h-2 w-64 overflow-hidden rounded-full bg-slate-200">

                  <div className="h-full w-1/2 animate-pulse rounded-full bg-black" />

                </div>

                {/* NO DOWNLOAD BUTTON WHILE GENERATING */}

              </div>
            )}

            {/* ERROR */}

            {videoError && !videoGenerating && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600">
                {videoError}
              </div>
            )}

            {/* VIDEO + DOWNLOAD — ONLY AFTER COMPLETE */}

            {videoUrl && !videoGenerating && (
              <div className="mt-8">

                <p className="mb-4 text-center font-bold text-emerald-600">
                  ✅ Video completely generated!
                </p>

                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-200 bg-black shadow-xl"
                />

                <div className="mt-5 flex justify-center">

                  <a
                    href={videoUrl}
                    download="hamster-therapy-session.webm"
                    className="rounded-2xl bg-black px-6 py-3 font-black text-white transition hover:scale-105"
                  >
                    ⬇️ Download Video
                  </a>

                </div>

              </div>
            )}

          </div>

          {/* FRAME SUMMARY */}

          <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">

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
              title="Shock Frame"
              active={frame5Captured}
            />

          </div>

          {/* RESTART */}

          <div className="text-center mt-12">

            <button
              onClick={restart}
              className="px-8 py-4 rounded-full bg-slate-950 text-white font-bold hover:scale-105 transition-transform"
            >
              🐹 Try Again
            </button>

            <p className="text-xs text-slate-400 mt-5">
              Images are kept in this browser
              session only.
            </p>

          </div>

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
    <div className="mt-8 rounded-xl bg-slate-900 border border-slate-800 p-6">

      <p className="text-xs uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="text-4xl font-mono text-emerald-300 mt-3">
        {value}
      </p>

      <p className="text-xs text-slate-500 mt-3">
        {target}
      </p>

      {captured && (
        <p className="text-emerald-400 mt-4 font-semibold">
          📸 Frame {frame} captured!
        </p>
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
      <div className="rounded-3xl bg-slate-100 p-8 text-center">

        <div className="text-5xl">
          {emoji}
        </div>

        <h2 className="font-bold text-xl mt-4">
          Frame {frame}
        </h2>

        <p className="text-slate-400 mt-2">
          No image captured.
        </p>

      </div>
    );
  }

  return (
    <div
      className={`rounded-3xl overflow-hidden bg-white shadow-xl ${
        shocked
          ? "border-4 border-red-500"
          : "border border-black/5"
      }`}
    >

      <div className="p-5">

        {/* TROLLING MESSAGE FIRST */}

        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">

          <p className="text-xs font-black uppercase tracking-widest text-amber-700">
            🐹 ഹാംസ്റ്ററിന്റെ അഭിപ്രായം
          </p>

          <p className="mt-2 text-base font-bold leading-7 text-slate-800">
            {trollMessage}
          </p>

        </div>

        {/* FRAME TITLE */}

        <div className="flex items-center justify-between mb-4">

          <div>

            <p className="text-xs uppercase tracking-widest text-slate-400">
              Frame {frame}
            </p>

            <h2 className="font-black text-xl mt-1">
              {emoji} {title}
            </h2>

          </div>

          {shocked && (
            <span className="text-red-500 font-black">
              SHOCKED
            </span>
          )}

        </div>

        {/* IMAGE */}

        <div className="w-full flex justify-center bg-slate-100 rounded-2xl overflow-hidden">

          <img
            src={image}
            alt={`Hamster Therapy ${title}`}
            className={`${imageClass} w-auto max-w-full object-contain`}
          />

        </div>

        {/* DOWNLOAD IMAGE */}

        <a
          href={image}
          download={`hamster-therapy-frame-${frame}.jpg`}
          className="inline-block mt-4 px-5 py-2 rounded-full bg-slate-950 text-white text-sm font-semibold hover:opacity-80"
        >
          Download Frame {frame}
        </a>

      </div>

    </div>
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
      className={`rounded-2xl p-5 text-center shadow ${
        active
          ? "bg-white"
          : "bg-slate-100 opacity-50"
      }`}
    >

      <p className="text-3xl">
        {emoji}
      </p>

      <p className="font-bold mt-2">
        {title}
      </p>

      <p className="text-xs text-slate-400 mt-1">
        {active
          ? "Captured"
          : "Not captured"}
      </p>

    </div>
  );
}