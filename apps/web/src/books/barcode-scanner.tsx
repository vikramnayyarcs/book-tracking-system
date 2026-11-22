import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button.tsx";
import { scannedIsbn } from "./add-book-logic.ts";

function cameraMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError") {
    return "Camera access was refused. Allow the camera in your browser settings, or type the ISBN instead.";
  }
  if (name === "NotFoundError") {
    return "No camera was found. Type the ISBN instead.";
  }
  return "The camera did not start. Type the ISBN instead.";
}

export function BarcodeScanner({ onIsbn }: { onIsbn: (isbn: string) => void }) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | null = null;
    const stop = () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          stop();
          return;
        }
        const [{ BarcodeDetector, prepareZXingModule }, wasm] =
          await Promise.all([
            import("barcode-detector/ponyfill"),
            import("zxing-wasm/reader/zxing_reader.wasm?url"),
          ]);
        await prepareZXingModule({
          overrides: { locateFile: () => wasm.default },
          fireImmediately: true,
        });
        const detector = new BarcodeDetector({
          formats: ["ean_13", "ean_8", "upc_a"],
        });
        const element = video.current;
        if (!element || stopped) return;
        element.srcObject = stream;
        await element.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const isbn = scannedIsbn(await detector.detect(element));
            if (isbn) {
              stop();
              setActive(false);
              onIsbnRef.current(isbn);
              return;
            }
          } catch {
            frame = 0;
          }
          frame = requestAnimationFrame(() => void tick());
        };
        frame = requestAnimationFrame(() => void tick());
      } catch (caught) {
        stop();
        setActive(false);
        setError(cameraMessage(caught));
      }
    })();
    return stop;
  }, [active]);

  return (
    <div className="flex flex-col items-start gap-sm">
      {active ? (
        <>
          <video
            ref={video}
            muted
            playsInline
            aria-label="Camera view. Point it at the barcode on the back of the book."
            className="aspect-4/3 w-full rounded-md border border-border bg-surface-sunken object-cover"
          />
          <Button onPress={() => setActive(false)}>Stop camera</Button>
        </>
      ) : (
        <Button
          variant="primary"
          onPress={() => {
            setError(null);
            setActive(true);
          }}
        >
          Scan barcode
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-base text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
