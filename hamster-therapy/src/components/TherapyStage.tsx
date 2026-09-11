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

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export default function TherapyStage() {
  // ==================================================
  // REFS
  // ==================================================

  const videoRef =
    useRef<HTMLVideoElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const landmarkerRef =
    useRef<any>(null);

  const animationRef =
    useRef<number | null>(null);

  const countdownTimerRef =
    useRef<number | null>(null);

  const deepSleepTimerRef =
    useRef<number | null>(null);

  const shockTimerRef =
    useRef<number | null>(null);

  const notSleepingTimerRef =
    useRef<number | null>(null);

  const mountedRef =
    useRef(true);

  const stageRef =
    useRef<Stage>(1);

  const modeRef =
    useRef<Mode>("therapy");

  const completingRef =
    useRef(false);

  const countdownStartedRef =
    useRef(false);

  const shockCheckingRef =
    useRef(false);

  const shockDetectedRef =
    useRef(false);

  const shockCapturedRef =
    useRef(false);

  // ==================================================
  // STATE
  // ==================================================

  const [stage, setStage] =
    useState<Stage>(1);

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
    useState(
      "Starting face detection..."
    );

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

  // ==================================================
  // MODE
  // ==================================================

  function setMode(next: Mode) {
    modeRef.current = next;
    setModeState(next);
  }

  // ==================================================
  // STOP DETECTION
  // ==================================================

  function stopDetection() {
    if (
      animationRef.current !== null
    ) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current = null;
    }
  }

  // ==================================================
  // STOP CAMERA
  // ==================================================

  function stopCamera() {
    console.log(
      "🛑 CAMERA STOPPED"
    );

    stopDetection();

    if (
      streamRef.current
    ) {
      streamRef.current
        .getTracks()
        .forEach((track) => {
          track.stop();
        });

      streamRef.current = null;
    }

    if (
      videoRef.current
    ) {
      videoRef.current.pause();
      videoRef.current.srcObject =
        null;
    }

    setCameraReady(false);
  }

  // ==================================================
  // START CAMERA
  // ==================================================

  useEffect(() => {
    mountedRef.current = true;

    async function start() {
      try {
        setStatus(
          "Requesting camera..."
        );

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera access is not supported by this browser."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
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
            }
          );

        if (
          !mountedRef.current
        ) {
          stream
            .getTracks()
            .forEach((track) =>
              track.stop()
            );

          return;
        }

        streamRef.current =
          stream;

        const video =
          videoRef.current;

        if (!video) {
          throw new Error(
            "Video element unavailable."
          );
        }

        video.srcObject =
          stream;

        await new Promise<void>(
          (resolve) => {
            if (
              video.readyState >=
              HTMLMediaElement.HAVE_METADATA
            ) {
              resolve();
              return;
            }

            video.onloadedmetadata =
              () => resolve();
          }
        );

        await video.play();

        if (
          !mountedRef.current
        ) {
          return;
        }

        setCameraReady(true);

        setStatus(
          "Camera ready. Loading MediaPipe..."
        );

        const landmarker =
          await createFaceLandmarker();

        if (
          !mountedRef.current
        ) {
          return;
        }

        landmarkerRef.current =
          landmarker;

        setStatus(
          "Stage 1 ready."
        );

        console.log(
          "✅ MediaPipe ready"
        );

        animationRef.current =
          requestAnimationFrame(
            detectFace
          );
      } catch (err) {
        console.error(
          "START ERROR:",
          err
        );

        if (
          err instanceof Error
        ) {
          setError(
            err.message
          );
        } else {
          setError(
            "Could not start camera."
          );
        }

        setStatus(
          "Face detection failed."
        );
      }
    }

    start();

    return () => {
      mountedRef.current =
        false;

      stopDetection();

      if (
        countdownTimerRef.current !==
        null
      ) {
        window.clearInterval(
          countdownTimerRef.current
        );
      }

      if (
        deepSleepTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          deepSleepTimerRef.current
        );
      }

      if (
        shockTimerRef.current !==
        null
      ) {
        window.clearInterval(
          shockTimerRef.current
        );
      }

      if (
        notSleepingTimerRef.current !==
        null
      ) {
        window.clearTimeout(
          notSleepingTimerRef.current
        );
      }

      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach((track) =>
            track.stop()
          );
      }

      streamRef.current = null;

      if (
        videoRef.current
      ) {
        videoRef.current.pause();
        videoRef.current.srcObject =
          null;
      }
    };
  }, []);

  // ==================================================
  // CAPTURE IMAGE
  // ==================================================

  function captureFrame(
    frameNumber: 1 | 2 | 3 | 4 | 5
  ) {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas
    ) {
      console.error(
        "❌ Cannot capture image."
      );

      return false;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      console.error(
        "❌ Video has no dimensions."
      );

      return false;
    }

    canvas.width =
      video.videoWidth;

    canvas.height =
      video.videoHeight;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) {
      console.error(
        "❌ Canvas context unavailable."
      );

      return false;
    }

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const image =
      canvas.toDataURL(
        "image/jpeg",
        0.9
      );

    sessionStorage.setItem(
      `hamster_frame_${frameNumber}`,
      image
    );

    console.log(
      `📸 FRAME ${frameNumber} CAPTURED`
    );

    if (
      frameNumber === 1
    ) {
      setFrame1Captured(true);
    }

    if (
      frameNumber === 2
    ) {
      setFrame2Captured(true);
    }

    if (
      frameNumber === 3
    ) {
      setFrame3Captured(true);
    }

    if (
      frameNumber === 4
    ) {
      setFrame4Captured(true);
    }

    if (
      frameNumber === 5
    ) {
      setFrame5Captured(true);
    }

    return true;
  }

  // ==================================================
  // STAGE 1
  // ==================================================

  function completeStage1() {
    if (
      completingRef.current ||
      stageRef.current !== 1 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current =
      true;

    stageRef.current =
      2;

    setStatus(
      "Yawn detected! Capturing Frame 1..."
    );

    captureFrame(1);

    setCalibration(0);
    setFaceDetected(false);

    console.log(
      "🛑 STAGE 1 STOPPED"
    );

    window.setTimeout(() => {
      if (
        !mountedRef.current
      ) {
        return;
      }

      setStage(2);

      setStatus(
        "Stage 2 ready. Relax your eyes..."
      );

      completingRef.current =
        false;

      console.log(
        "▶️ STAGE 2 STARTED"
      );
    }, 1000);
  }

  // ==================================================
  // STAGE 2
  // ==================================================

  function completeStage2() {
    if (
      completingRef.current ||
      stageRef.current !== 2 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current =
      true;

    stageRef.current =
      3;

    setStatus(
      "Droopy eyes detected! Capturing Frame 2..."
    );

    captureFrame(2);

    setCalibration(0);
    setFaceDetected(false);

    console.log(
      "🛑 STAGE 2 STOPPED"
    );

    window.setTimeout(() => {
      if (
        !mountedRef.current
      ) {
        return;
      }

      setStage(3);

      setStatus(
        "Stage 3 ready. Prepare your Zen pout..."
      );

      completingRef.current =
        false;

      console.log(
        "▶️ STAGE 3 STARTED"
      );
    }, 1000);
  }

  // ==================================================
  // STAGE 3
  // ==================================================

  function completeStage3() {
    if (
      completingRef.current ||
      stageRef.current !== 3 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current =
      true;

    stageRef.current =
      4;

    setStatus(
      "Zen pout detected! Capturing Frame 3..."
    );

    captureFrame(3);

    setCalibration(0);
    setFaceDetected(false);

    console.log(
      "🛑 STAGE 3 STOPPED"
    );

    window.setTimeout(() => {
      if (
        !mountedRef.current
      ) {
        return;
      }

      setStage(4);

      setStatus(
        "Stage 4 ready. Enter deep sleep..."
      );

      completingRef.current =
        false;

      console.log(
        "▶️ STAGE 4 STARTED"
      );
    }, 1000);
  }

  // ==================================================
  // STAGE 4 — COMA
  // ==================================================

  function completeStage4() {
    if (
      completingRef.current ||
      stageRef.current !== 4 ||
      modeRef.current !== "therapy"
    ) {
      return;
    }

    completingRef.current =
      true;

    setStatus(
      "Coma detected! Capturing Frame 4..."
    );

    captureFrame(4);

    setCalibration(1);
    setFaceDetected(false);

    console.log(
      "🫠 COMA DETECTED"
    );

    console.log(
      "🛑 STAGE 4 STOPPED"
    );

    /*
     * Wait one second after Frame 4.
     */

    window.setTimeout(() => {
      if (
        !mountedRef.current
      ) {
        return;
      }

      completingRef.current =
        false;

      startSleepCountdown();
    }, 1000);
  }

  // ==================================================
  // SLEEP COUNTDOWN
  // ==================================================

  function startSleepCountdown() {
    if (
      countdownStartedRef.current
    ) {
      return;
    }

    countdownStartedRef.current =
      true;

    stopDetection();

    setMode("countdown");

    setCountdown(5);

    setStatus(
      "Hamster is going to sleep..."
    );

    console.log(
      "🐹 HAMSTER GOING TO SLEEP"
    );

    let current =
      5;

    countdownTimerRef.current =
      window.setInterval(() => {
        current -= 1;

        if (
          current > 0
        ) {
          setCountdown(
            current
          );

          console.log(
            `😴 COUNTDOWN: ${current}`
          );

          return;
        }

        if (
          countdownTimerRef.current !==
          null
        ) {
          window.clearInterval(
            countdownTimerRef.current
          );

          countdownTimerRef.current =
            null;
        }

        console.log(
          "😴 5 → 1 COMPLETE"
        );

        startDeepSleep();
      }, 1000);
  }

  // ==================================================
  // DEEP SLEEP
  // ==================================================

  function startDeepSleep() {
    setMode("deepSleep");

    setStatus(
      "Deep Sleeping..."
    );

    console.log(
      "😴 DEEP SLEEPING"
    );

    /*
     * Deep Sleeping is shown for 2 seconds.
     *
     * Later:
     * BEEP WILL BE ADDED HERE.
     */

    deepSleepTimerRef.current =
      window.setTimeout(() => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        startShockDetection();
      }, 2000);
  }

  // ==================================================
  // SHOCK DETECTION START
  // ==================================================

  function startShockDetection() {
    if (
      shockCheckingRef.current
    ) {
      return;
    }

    shockCheckingRef.current =
      true;

    shockDetectedRef.current =
      false;

    shockCapturedRef.current =
      false;

    setShockTimeLeft(3);

    setMode("shockCheck");

    setStatus(
      "Shock detection starts!"
    );

    console.log(
      "⚡ SHOCK DETECTION STARTS"
    );

    /*
     * Start MediaPipe again.
     */

    animationRef.current =
      requestAnimationFrame(
        detectFace
      );

    /*
     * Three-second window.
     */

    let remaining =
      3;

    shockTimerRef.current =
      window.setInterval(() => {
        remaining -= 1;

        if (
          remaining > 0
        ) {
          setShockTimeLeft(
            remaining
          );

          return;
        }

        if (
          shockTimerRef.current !==
          null
        ) {
          window.clearInterval(
            shockTimerRef.current
          );

          shockTimerRef.current =
            null;
        }

        finishShockDetection();
      }, 1000);
  }

  // ==================================================
  // FINISH SHOCK CHECK
  // ==================================================

  function finishShockDetection() {
    if (
      !shockCheckingRef.current
    ) {
      return;
    }

    shockCheckingRef.current =
      false;

    stopDetection();

    console.log(
      "⏱️ 3 SECOND SHOCK CHECK FINISHED"
    );

    /*
     * ----------------------------------------------
     * SHOCK FOUND
     * ----------------------------------------------
     */

    if (
      shockDetectedRef.current
    ) {
      console.log(
        "😱 SHOCK REACTION FOUND"
      );

      setStatus(
        "😱 Shock reaction captured!"
      );

      /*
       * Frame 5 was already captured
       * at the exact moment of detection.
       */

      window.setTimeout(() => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setMode("reveal");

        stopCamera();

        console.log(
          "🖼️ GALLERY — 5 IMAGES"
        );
      }, 700);

      return;
    }

    /*
     * ----------------------------------------------
     * NO SHOCK
     * ----------------------------------------------
     */

    console.log(
      "😴 NO SHOCK DETECTED"
    );

    setMode(
      "notSleeping"
    );

    setStatus(
      "ഞാൻ ഉറങ്ങിയിട്ടില്ലെടാ!"
    );

    /*
     * Do NOT capture Frame 5.
     *
     * Gallery will contain only:
     *
     * Frame 1
     * Frame 2
     * Frame 3
     * Frame 4
     */

    notSleepingTimerRef.current =
      window.setTimeout(() => {
        if (
          !mountedRef.current
        ) {
          return;
        }

        setMode("reveal");

        stopCamera();

        console.log(
          "🖼️ GALLERY — 4 IMAGES"
        );
      }, 1800);
  }

  // ==================================================
  // SHOCK EXPRESSION CHECK
  // ==================================================

  function checkForShock(
    face: Landmark[]
  ) {
    const faceHeight =
      distance(
        face[10],
        face[152]
      );

    if (
      faceHeight <= 0
    ) {
      return false;
    }

    /*
     * LEFT EYE
     */

    const leftEyeGap =
      distance(
        face[159],
        face[145]
      );

    /*
     * RIGHT EYE
     */

    const rightEyeGap =
      distance(
        face[386],
        face[374]
      );

    /*
     * MOUTH
     */

    const mouthGap =
      distance(
        face[13],
        face[14]
      );

    /*
     * NORMALIZED VALUES
     */

    const leftEyeRatio =
      leftEyeGap /
      faceHeight;

    const rightEyeRatio =
      rightEyeGap /
      faceHeight;

    const mouthRatio =
      mouthGap /
      faceHeight;

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
      }
    );

    /*
     * SHOCK CONDITION
     *
     * Eyes wide
     * AND
     * Mouth open
     *
     * These values can be tuned later.
     */

    const eyesWide =
      averageEyeRatio >
      0.030;

    const mouthOpen =
      mouthRatio >
      0.070;

    return (
      eyesWide &&
      mouthOpen
    );
  }

  // ==================================================
  // FACE DETECTION
  // ==================================================

  function detectFace() {
    const currentMode =
      modeRef.current;

    /*
     * Detection is allowed during:
     *
     * 1. Normal therapy
     * 2. Shock detection
     */

    if (
      currentMode !== "therapy" &&
      currentMode !== "shockCheck"
    ) {
      animationRef.current =
        null;

      return;
    }

    const video =
      videoRef.current;

    const landmarker =
      landmarkerRef.current;

    if (
      !video ||
      !landmarker
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace
        );

      return;
    }

    if (
      video.readyState <
      HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace
        );

      return;
    }

    if (
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace
        );

      return;
    }

    try {
      const result =
        landmarker.detectForVideo(
          video,
          performance.now()
        );

      if (
        result.faceLandmarks.length >
        0
      ) {
        const face = result.faceLandmarks[0] as Landmark[];

        setFaceDetected(true);

        /*
         * ==========================================
         * SHOCK DETECTION MODE
         * ==========================================
         */

        if (
          currentMode ===
          "shockCheck"
        ) {
          if (
            !shockDetectedRef.current
          ) {
            const shocked =
              checkForShock(
                face
              );

            if (
              shocked
            ) {
              shockDetectedRef.current =
                true;

              console.log(
                "😱 SHOCKED EXPRESSION DETECTED!"
              );

              /*
               * Capture ONLY once.
               */

              if (
                !shockCapturedRef.current
              ) {
                shockCapturedRef.current =
                  true;

                const captured =
                  captureFrame(5);

                if (
                  captured
                ) {
                  console.log(
                    "📸 SHOCK IMAGE / FRAME 5 SAVED"
                  );
                }
              }

              setStatus(
                "😱 Shock detected!"
              );

              /*
               * Stop checking immediately.
               */

              stopDetection();

              shockCheckingRef.current =
                false;

              if (
                shockTimerRef.current !==
                null
              ) {
                window.clearInterval(
                  shockTimerRef.current
                );

                shockTimerRef.current =
                  null;
              }

              /*
               * Go to gallery after
               * a tiny reaction delay.
               */

              window.setTimeout(() => {
                if (
                  !mountedRef.current
                ) {
                  return;
                }

                setMode("reveal");

                stopCamera();

                console.log(
                  "🖼️ GALLERY OPENED"
                );
              }, 700);

              return;
            }
          }

          /*
           * VERY IMPORTANT:
           *
           * Continue checking every frame
           * during the 3-second window.
           */

          animationRef.current =
            requestAnimationFrame(
              detectFace
            );

          return;
        }

        /*
         * ==========================================
         * NORMAL THERAPY MODE
         * ==========================================
         */

        const currentStage =
          stageRef.current;

        const faceHeight =
          distance(
            face[10],
            face[152]
          );

        if (
          faceHeight > 0 &&
          !completingRef.current
        ) {
          /*
           * ========================================
           * STAGE 1 — YAWN
           * ========================================
           */

          if (
            currentStage === 1
          ) {
            const mouthGap =
              distance(
                face[13],
                face[14]
              );

            const mouthRatio =
              mouthGap /
              faceHeight;

            setCalibration(
              mouthRatio
            );

            console.log(
              "STAGE 1:",
              mouthRatio
            );

            if (
              mouthRatio >
              0.05
            ) {
              completeStage1();
            }
          }

          /*
           * ========================================
           * STAGE 2 — DROOPY DAZE
           * ========================================
           */

          else if (
            currentStage === 2
          ) {
            const eyeGap =
              distance(
                face[159],
                face[145]
              );

            const eyeRatio =
              eyeGap /
              faceHeight;

            setCalibration(
              eyeRatio
            );

            console.log(
              "STAGE 2:",
              eyeRatio
            );

            if (
              eyeRatio <
              0.022
            ) {
              completeStage2();
            }
          }

          /*
           * ========================================
           * STAGE 3 — ZEN POUT
           * ========================================
           */

          else if (
            currentStage === 3
          ) {
            const mouthWidth =
              distance(
                face[61],
                face[291]
              );

            const cheekWidth =
              distance(
                face[234],
                face[454]
              );

            if (
              cheekWidth > 0
            ) {
              const mouthWidthRatio =
                mouthWidth /
                cheekWidth;

              setCalibration(
                mouthWidthRatio
              );

              console.log(
                "STAGE 3:",
                mouthWidthRatio
              );

              if (
                mouthWidthRatio <
                0.32
              ) {
                completeStage3();
              }
            }
          }

          /*
           * ========================================
           * STAGE 4 — COMA
           * ========================================
           */

          else if (
            currentStage === 4
          ) {
            const eyeGap =
              distance(
                face[159],
                face[145]
              );

            const mouthGap =
              distance(
                face[13],
                face[14]
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
              }
            );

            /*
             * COMA:
             *
             * Eyes < 0.012
             * Mouth > 0.070
             */

            if (
              eyeRatio <
                0.012 &&
              mouthRatio >
                0.07
            ) {
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
                      0.022
                  )
                );

              const mouthProgress =
                Math.min(
                  1,
                  mouthRatio /
                    0.07
                );

              const comaProgress =
                Math.min(
                  eyeProgress,
                  mouthProgress
                );

              setCalibration(
                comaProgress
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
        err
      );
    }

    /*
     * Continue detection.
     */

    if (
      modeRef.current ===
        "therapy" ||
      modeRef.current ===
        "shockCheck"
    ) {
      animationRef.current =
        requestAnimationFrame(
          detectFace
        );
    }
  }

  // ==================================================
  // RESTART
  // ==================================================

  function restart() {
    sessionStorage.clear();

    window.location.reload();
  }

  // ==================================================
  // GET STORED IMAGE
  // ==================================================

  function getFrame(
    number: number
  ) {
    return sessionStorage.getItem(
      `hamster_frame_${number}`
    );
  }

  // ==================================================
  // HIDDEN CAMERA
  //
  // IMPORTANT:
  // It is rendered ONCE for every mode.
  // ==================================================

  const hiddenCamera = (
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
    </>
  );

  // ==================================================
  // THERAPY
  // ==================================================

  if (
    mode === "therapy"
  ) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-6 py-10">

        {hiddenCamera}

        <div className="w-full max-w-2xl text-center">

          <div className="text-7xl mb-6">
            🐹
          </div>

          <p className="text-emerald-400 text-sm uppercase tracking-[0.3em]">
            Stage {stage} / 4
          </p>

          {/* ========================================
              STAGE 1
              ======================================== */}

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
                captured={
                  frame1Captured
                }
                frame={1}
              />
            </>
          )}

          {/* ========================================
              STAGE 2
              ======================================== */}

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
                captured={
                  frame2Captured
                }
                frame={2}
              />
            </>
          )}

          {/* ========================================
              STAGE 3
              ======================================== */}

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
                captured={
                  frame3Captured
                }
                frame={3}
              />
            </>
          )}

          {/* ========================================
              STAGE 4
              ======================================== */}

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
                captured={
                  frame4Captured
                }
                frame={4}
              />
            </>
          )}

          {/* STATUS */}

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

  // ==================================================
  // COUNTDOWN
  // ==================================================

  if (
    mode === "countdown"
  ) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        {hiddenCamera}

        <div className="text-center">

          <div className="text-8xl mb-8">
            🐹💤
          </div>

          <p className="text-slate-500 uppercase tracking-[0.5em] text-sm">
            Hamster Going To Sleep
          </p>

          <div className="text-[12rem] md:text-[16rem] leading-none font-black mt-6 animate-pulse">
            {countdown}
          </div>

          <p className="text-slate-500 text-xl mt-8">
            Good night...
          </p>

        </div>
      </main>
    );
  }

  // ==================================================
  // DEEP SLEEP
  // ==================================================

  if (
    mode === "deepSleep"
  ) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        {hiddenCamera}

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

  // ==================================================
  // SHOCK CHECK
  // ==================================================

  if (
    mode === "shockCheck"
  ) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">

        {hiddenCamera}

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

  // ==================================================
  // NO SHOCK
  // ==================================================

  if (
    mode === "notSleeping"
  ) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">

        {hiddenCamera}

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

  // ==================================================
  // GALLERY
  // ==================================================

  return (
    <main className="min-h-screen bg-[#f5f0e6] text-slate-900 px-6 py-12">

      {hiddenCamera}

      <div className="max-w-6xl mx-auto">

        {/* ============================================
            HEADER
            ============================================ */}

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

        {/* ============================================
            GALLERY
            ============================================ */}

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">

          <GalleryCard
            frame={1}
            emoji="🥱"
            title="The Yawn"
            image={getFrame(1)}
          />

          <GalleryCard
            frame={2}
            emoji="😴"
            title="Droopy Daze"
            image={getFrame(2)}
          />

          <GalleryCard
            frame={3}
            emoji="😗"
            title="Zen Pout"
            image={getFrame(3)}
          />

          <GalleryCard
            frame={4}
            emoji="🫠"
            title="Coma"
            image={getFrame(4)}
          />

          {/* ==========================================
              FRAME 5 ONLY IF SHOCKED
              ========================================== */}

          {frame5Captured &&
            getFrame(5) && (
              <div className="md:col-span-2">

                <GalleryCard
                  frame={5}
                  emoji="😱"
                  title="SHOCK REACTION"
                  image={getFrame(5)}
                  shocked
                />

              </div>
            )}

        </div>

        {/* ============================================
            FINAL RESULT
            ============================================ */}

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

        {/* ============================================
            FRAME SUMMARY
            ============================================ */}

        <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-4">

          <Summary
            emoji="🥱"
            title="Frame 1"
            active={
              frame1Captured
            }
          />

          <Summary
            emoji="😴"
            title="Frame 2"
            active={
              frame2Captured
            }
          />

          <Summary
            emoji="😗"
            title="Frame 3"
            active={
              frame3Captured
            }
          />

          <Summary
            emoji="🫠"
            title="Frame 4"
            active={
              frame4Captured
            }
          />

          <Summary
            emoji="😱"
            title="Shock Frame"
            active={
              frame5Captured
            }
          />

        </div>

        {/* ============================================
            RESTART
            ============================================ */}

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

// ==================================================
// CALIBRATION
// ==================================================

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

// ==================================================
// GALLERY CARD
// ==================================================

function GalleryCard({
  frame,
  emoji,
  title,
  image,
  shocked = false,
}: {
  frame: number;
  emoji: string;
  title: string;
  image: string | null;
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

        <img
          src={image}
          alt={`Hamster Therapy ${title}`}
          className="w-full rounded-2xl"
        />

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

// ==================================================
// SUMMARY
// ==================================================

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