"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

declare global {
  interface Window {
    cv?: any;
    jscanify?: any;
  }
}

type Props = {
  onCapture: (file: File) => void;
  disabled?: boolean;
};

function loadScript(
  src: string,
  id: string,
  timeoutMs = 20000
): Promise<void> {

  return new Promise((resolve, reject) => {

    const existing =
      document.getElementById(id) as
      HTMLScriptElement | null;

    if (existing) {

      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      const started = Date.now();

      const wait = () => {
        if (
          existing.dataset.loaded === "true"
        ) {
          resolve();
          return;
        }

        if (
          Date.now() - started >
          timeoutMs
        ) {
          reject(
            new Error(
              `Timeout chargement ${src}`
            )
          );
          return;
        }

        setTimeout(wait, 100);
      };

      wait();
      return;
    }

    const script =
      document.createElement("script");

    script.id = id;
    script.src = src;
    script.async = true;

    const timer =
      window.setTimeout(() => {
        reject(
          new Error(
            `Timeout chargement ${src}`
          )
        );
      }, timeoutMs);

    script.onload = () => {
      window.clearTimeout(timer);
      script.dataset.loaded = "true";
      resolve();
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      reject(
        new Error(
          `Impossible de charger ${src}`
        )
      );
    };

    document.head.appendChild(script);
  });
}

async function waitForOpenCv(
  timeoutMs = 30000
) {

  const started = Date.now();

  while (
    Date.now() - started <
    timeoutMs
  ) {

    const cv = window.cv;

    /*
     * OpenCV.js peut exposer window.cv
     * avant que le runtime WASM soit prêt.
     */
    if (
      cv &&
      typeof cv.Mat === "function" &&
      typeof cv.imread === "function" &&
      typeof cv.imshow === "function"
    ) {
      return cv;
    }

    await new Promise(
      r => setTimeout(r, 100)
    );
  }

  throw new Error(
    "OpenCV ne s'est pas initialisé."
  );
}

export default function CameraReceiptCapture({
  onCapture,
  disabled = false
}: Props) {

  const videoRef =
    useRef<HTMLVideoElement | null>(
      null
    );

  const rawCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const previewCanvasRef =
    useRef<HTMLCanvasElement | null>(
      null
    );

  const streamRef =
    useRef<MediaStream | null>(
      null
    );

  const scannerRef =
    useRef<any>(null);

  const animationRef =
    useRef<number | null>(null);

  const [open,setOpen] =
    useState(false);

  const [cameraReady,setCameraReady] =
    useState(false);

  const [scannerReady,setScannerReady] =
    useState(false);

  const [loadingScanner,setLoadingScanner] =
    useState(false);

  const [scannerError,setScannerError] =
    useState("");

  const [cameraError,setCameraError] =
    useState("");

  const stopCamera = () => {

    if (
      animationRef.current != null
    ) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current = null;
    }

    streamRef.current
      ?.getTracks()
      .forEach(
        t => t.stop()
      );

    streamRef.current = null;

    setCameraReady(false);
  };


  const initializeScanner =
    async () => {

      setLoadingScanner(true);
      setScannerReady(false);
      setScannerError("");

      try {

        await loadScript(
          "/vendor/opencv.js",
          "triangle-opencv"
        );

        await waitForOpenCv();

        await loadScript(
          "/vendor/jscanify.min.js",
          "triangle-jscanify"
        );

        if (
          typeof window.jscanify !==
          "function"
        ) {
          throw new Error(
            "JScanify n'est pas disponible."
          );
        }

        scannerRef.current =
          new window.jscanify();

        if (
          typeof scannerRef.current
            ?.highlightPaper
            !== "function" ||
          typeof scannerRef.current
            ?.extractPaper
            !== "function"
        ) {
          throw new Error(
            "Le moteur de détection n'est pas complet."
          );
        }

        setScannerReady(true);

      } catch(error:any) {

        console.error(
          "DOCUMENT_SCANNER_INIT_ERROR:",
          error
        );

        setScannerError(
          error?.message ||
          "Impossible de charger le scanner."
        );

      } finally {

        setLoadingScanner(false);

      }
    };


  const startCamera =
    async () => {

      setCameraError("");

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices
          .getUserMedia
      ) {
        setCameraError(
          "Caméra non disponible dans ce navigateur."
        );
        return;
      }

      try {

        stopCamera();

        const stream =
          await navigator.mediaDevices
            .getUserMedia({
              video:{
                facingMode:{
                  ideal:"environment"
                },
                width:{
                  ideal:1920
                },
                height:{
                  ideal:1080
                }
              },
              audio:false
            });

        streamRef.current =
          stream;

        const video =
          videoRef.current;

        if (!video) return;

        video.srcObject =
          stream;

        await video.play();

        setCameraReady(true);

      } catch(error:any) {

        console.error(
          "CAMERA_OPEN_ERROR:",
          error
        );

        setCameraError(
          error?.message ||
          "Impossible d'ouvrir la caméra."
        );
      }
    };


  const openScanner =
    async () => {

      if (disabled) return;

      setOpen(true);

      /*
       * On lance caméra et scanner
       * indépendamment.
       * La caméra ne doit pas être bloquée
       * par OpenCV.
       */

      setTimeout(
        () => {
          startCamera();
          initializeScanner();
        },
        50
      );
    };


  const closeScanner =
    () => {

      stopCamera();

      setOpen(false);
      setScannerError("");
      setCameraError("");
    };


  const drawDetection =
    () => {

      const video =
        videoRef.current;

      const preview =
        previewCanvasRef.current;

      if (
        !video ||
        !preview ||
        !cameraReady
      ) {
        return;
      }

      const width =
        video.videoWidth || 1280;

      const height =
        video.videoHeight || 720;

      preview.width = width;
      preview.height = height;

      const ctx =
        preview.getContext("2d");

      if (!ctx) return;

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      if (
        scannerReady &&
        scannerRef.current
      ) {

        try {

          const highlighted =
            scannerRef.current
              .highlightPaper(
                video
              );

          if (highlighted) {
            ctx.drawImage(
              highlighted,
              0,
              0,
              width,
              height
            );
          }

        } catch(error) {

          /*
           * Une frame peut échouer pendant
           * que la caméra se stabilise.
           * On ne désactive pas le scanner
           * pour une seule frame.
           */

          ctx.drawImage(
            video,
            0,
            0,
            width,
            height
          );
        }

      } else {

        ctx.drawImage(
          video,
          0,
          0,
          width,
          height
        );
      }

      animationRef.current =
        requestAnimationFrame(
          drawDetection
        );
    };


  useEffect(() => {

    if (
      open &&
      cameraReady
    ) {

      animationRef.current =
        requestAnimationFrame(
          drawDetection
        );
    }

    return () => {

      if (
        animationRef.current != null
      ) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

    };

  },[
    open,
    cameraReady,
    scannerReady
  ]);


  const normalPhoto =
    async () => {

      const video =
        videoRef.current;

      const canvas =
        rawCanvasRef.current;

      if (
        !video ||
        !canvas
      ) return;

      const width =
        video.videoWidth || 1280;

      const height =
        video.videoHeight || 720;

      canvas.width = width;
      canvas.height = height;

      const ctx =
        canvas.getContext("2d");

      if (!ctx) return;

      ctx.drawImage(
        video,
        0,
        0,
        width,
        height
      );

      canvas.toBlob(
        blob => {

          if (!blob) return;

          const file =
            new File(
              [blob],
              `document-photo-${Date.now()}.jpg`,
              {
                type:"image/jpeg"
              }
            );

          onCapture(file);
          closeScanner();

        },
        "image/jpeg",
        0.92
      );
    };


  const scanDocument =
    async () => {

      if (
        !scannerReady ||
        !scannerRef.current
      ) {

        setScannerError(
          "Le scanner n'est pas encore prêt."
        );

        return;
      }

      const video =
        videoRef.current;

      const rawCanvas =
        rawCanvasRef.current;

      if (
        !video ||
        !rawCanvas
      ) return;

      try {

        setScannerError("");

        const width =
          video.videoWidth || 1280;

        const height =
          video.videoHeight || 720;

        rawCanvas.width = width;
        rawCanvas.height = height;

        const ctx =
          rawCanvas.getContext("2d");

        if (!ctx) {
          throw new Error(
            "Canvas indisponible."
          );
        }

        ctx.drawImage(
          video,
          0,
          0,
          width,
          height
        );

        /*
         * extractPaper attend une image/canvas.
         * Ici on lui donne la frame capturée.
         */
        const scanned =
          scannerRef.current
            .extractPaper(
              rawCanvas,
              1240,
              1754
            );

        if (!scanned) {
          throw new Error(
            "Document non détecté. Fais apparaître les quatre coins."
          );
        }

        /*
         * JScanify retourne normalement
         * un canvas.
         */
        const resultCanvas =
          scanned instanceof
          HTMLCanvasElement
            ? scanned
            : null;

        if (!resultCanvas) {
          throw new Error(
            "Format du document scanné invalide."
          );
        }

        resultCanvas.toBlob(
          blob => {

            if (!blob) {
              setScannerError(
                "Impossible de créer l'image scannée."
              );
              return;
            }

            const file =
              new File(
                [blob],
                `document-scan-${Date.now()}.jpg`,
                {
                  type:"image/jpeg"
                }
              );

            onCapture(file);
            closeScanner();

          },
          "image/jpeg",
          0.94
        );

      } catch(error:any) {

        console.error(
          "DOCUMENT_SCAN_ERROR:",
          error
        );

        setScannerError(
          error?.message ||
          "Impossible de scanner ce document."
        );
      }
    };


  useEffect(() => {

    return () => {
      stopCamera();
    };

  },[]);


  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openScanner}
        className="
          rounded-xl
          border
          border-slate-300
          bg-white
          px-4
          py-3
          text-sm
          font-black
          text-slate-900
          hover:bg-slate-50
          disabled:opacity-50
        "
      >
        📄 Scanner le document
      </button>


      {open && (
        <div
          className="
            fixed inset-0 z-[100]
            overflow-y-auto
            bg-black/70
            p-4
          "
        >
          <div
            className="
              mx-auto
              mt-4
              max-w-6xl
              rounded-3xl
              bg-white
              p-5
              shadow-2xl
            "
          >

            <div
              className="
                flex
                items-start
                justify-between
                gap-4
              "
            >
              <div>
                <h2
                  className="
                    text-2xl
                    font-black
                    text-slate-900
                  "
                >
                  Scanner un document
                </h2>

                <p
                  className="
                    text-slate-500
                  "
                >
                  Pose la facture ou le reçu à plat.
                  Fais apparaître les quatre coins du document.
                </p>
              </div>

              <button
                type="button"
                onClick={closeScanner}
                className="
                  text-3xl
                  font-black
                  text-slate-500
                "
              >
                ×
              </button>
            </div>


            <div className="mt-4">

              {loadingScanner && (
                <div
                  className="
                    rounded-xl
                    bg-blue-50
                    p-4
                    font-bold
                    text-blue-800
                  "
                >
                  Chargement du scanner de documents…
                </div>
              )}

              {scannerReady && (
                <div
                  className="
                    rounded-xl
                    bg-emerald-50
                    p-4
                    font-bold
                    text-emerald-800
                  "
                >
                  ✅ Scanner prêt — document détectable.
                </div>
              )}

              {scannerError && (
                <div
                  className="
                    rounded-xl
                    bg-red-50
                    p-4
                    font-bold
                    text-red-700
                  "
                >
                  ❌ {scannerError}

                  <button
                    type="button"
                    onClick={initializeScanner}
                    className="
                      ml-3
                      underline
                    "
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {cameraError && (
                <div
                  className="
                    mt-2
                    rounded-xl
                    bg-red-50
                    p-4
                    font-bold
                    text-red-700
                  "
                >
                  ❌ {cameraError}
                </div>
              )}

            </div>


            <div
              className="
                mt-5
                grid
                gap-5
                lg:grid-cols-2
              "
            >

              <div>
                <p
                  className="
                    mb-2
                    font-black
                    text-slate-800
                  "
                >
                  Caméra
                </p>

                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="
                    w-full
                    rounded-2xl
                    bg-black
                  "
                />
              </div>


              <div>
                <p
                  className="
                    mb-2
                    font-black
                    text-slate-800
                  "
                >
                  Détection du document
                </p>

                <div
                  className="
                    relative
                    min-h-[320px]
                    overflow-hidden
                    rounded-2xl
                    bg-slate-950
                  "
                >

                  <canvas
                    ref={previewCanvasRef}
                    className="
                      h-full
                      w-full
                      object-contain
                    "
                  />

                  {!cameraReady && (
                    <div
                      className="
                        absolute
                        inset-0
                        flex
                        items-center
                        justify-center
                        font-black
                        text-white
                      "
                    >
                      Ouverture de la caméra…
                    </div>
                  )}

                  {cameraReady &&
                   !scannerReady &&
                   !scannerError && (
                    <div
                      className="
                        absolute
                        inset-0
                        flex
                        items-center
                        justify-center
                        font-black
                        text-white
                      "
                    >
                      Initialisation du scanner…
                    </div>
                  )}

                </div>
              </div>

            </div>


            <canvas
              ref={rawCanvasRef}
              className="hidden"
            />


            <div
              className="
                mt-5
                flex
                flex-wrap
                justify-end
                gap-3
              "
            >

              <button
                type="button"
                onClick={closeScanner}
                className="
                  rounded-xl
                  border
                  border-slate-400
                  px-5
                  py-3
                  font-black
                  text-slate-700
                "
              >
                Annuler
              </button>


              <button
                type="button"
                disabled={!cameraReady}
                onClick={normalPhoto}
                className="
                  rounded-xl
                  bg-slate-700
                  px-5
                  py-3
                  font-black
                  text-white
                  disabled:opacity-50
                "
              >
                📷 Photo normale
              </button>


              <button
                type="button"
                disabled={
                  !cameraReady ||
                  !scannerReady
                }
                onClick={scanDocument}
                className="
                  rounded-xl
                  bg-emerald-600
                  px-5
                  py-3
                  font-black
                  text-white
                  disabled:opacity-50
                "
              >
                📄 Scanner le document
              </button>

            </div>

          </div>
        </div>
      )}

    </>
  );
}
