// src/camera.ts
var CameraManager = class {
  constructor(config = {}) {
    this.stream = null;
    this.facingMode = config.preferredCamera ?? "environment";
    this.resolution = config.cameraResolution;
  }
  async start(video) {
    if (this.stream) {
      return this.stream;
    }
    this.stream = await this.acquireStream();
    await this.ensureBestCamera();
    video.srcObject = this.stream;
    video.setAttribute("playsinline", "true");
    await video.play();
    return this.stream;
  }
  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
  }
  async setCamera(facingModeOrDeviceId, video) {
    this.stop();
    this.facingMode = facingModeOrDeviceId;
    await this.start(video);
  }
  getStream() {
    return this.stream;
  }
  async hasFlash() {
    const track = this.getVideoTrack();
    if (!track) return false;
    try {
      const capabilities = track.getCapabilities();
      return capabilities.torch === true;
    } catch {
      return false;
    }
  }
  isFlashOn() {
    const track = this.getVideoTrack();
    if (!track) return false;
    const settings = track.getSettings();
    return settings.torch === true;
  }
  async toggleFlash() {
    if (this.isFlashOn()) {
      await this.turnFlashOff();
    } else {
      await this.turnFlashOn();
    }
  }
  async turnFlashOn() {
    await this.setTorch(true);
  }
  async turnFlashOff() {
    await this.setTorch(false);
  }
  async setTorch(on) {
    const track = this.getVideoTrack();
    if (!track) {
      throw new Error("No active camera stream");
    }
    try {
      await track.applyConstraints({
        advanced: [{ torch: on }]
      });
    } catch {
      throw new Error("Flash/torch is not supported on this device");
    }
  }
  /**
   * If the current camera lacks continuous autofocus (e.g. an ultrawide sensor
   * picked by facingMode: 'environment'), find a better camera with the same
   * facing mode and replace this.stream. Called before assigning to the video
   * element so the user never sees the wrong camera.
   */
  async ensureBestCamera() {
    if (this.facingMode !== "environment" && this.facingMode !== "user") {
      return;
    }
    const track = this.getVideoTrack();
    if (!track) return;
    try {
      const capabilities = track.getCapabilities();
      if (capabilities.focusMode?.includes("continuous")) {
        return;
      }
    } catch {
      return;
    }
    const currentDeviceId = track.getSettings().deviceId;
    let devices;
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch {
      return;
    }
    if (!Array.isArray(devices)) return;
    const candidates = devices.filter(
      (d) => d.kind === "videoinput" && d.deviceId !== currentDeviceId
    );
    if (candidates.length === 0) return;
    this.stop();
    for (const candidate of candidates) {
      let candidateStream;
      try {
        candidateStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: candidate.deviceId },
            width: this.resolution?.width ?? { ideal: 1920 },
            height: this.resolution?.height ?? { ideal: 1080 }
          },
          audio: false
        });
      } catch {
        continue;
      }
      const candidateTrack = candidateStream.getVideoTracks()[0];
      if (!candidateTrack) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }
      const candidateSettings = candidateTrack.getSettings();
      if (candidateSettings.facingMode && candidateSettings.facingMode !== this.facingMode) {
        for (const t of candidateStream.getTracks()) t.stop();
        continue;
      }
      try {
        const candidateCaps = candidateTrack.getCapabilities();
        if (candidateCaps.focusMode?.includes("continuous")) {
          this.stream = candidateStream;
          return;
        }
      } catch {
      }
      for (const t of candidateStream.getTracks()) t.stop();
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: currentDeviceId ? { exact: currentDeviceId } : void 0,
          width: this.resolution?.width ?? { ideal: 1920 },
          height: this.resolution?.height ?? { ideal: 1080 }
        },
        audio: false
      });
    } catch {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(
          this.buildConstraints()
        );
      } catch {
      }
    }
  }
  getVideoTrack() {
    if (!this.stream) return null;
    const tracks = this.stream.getVideoTracks();
    return tracks[0] ?? null;
  }
  /**
   * Try getUserMedia with progressively simpler constraints.
   *
   * Some browsers (e.g. Brave on Samsung Galaxy S24) throw NotReadableError
   * when facingMode and resolution constraints are combined. Falling back to
   * fewer constraints lets us still open the camera on those browsers.
   */
  async acquireStream() {
    const attempts = [
      // 1. Full constraints (facingMode/deviceId + resolution)
      this.buildConstraints(),
      // 2. facingMode/deviceId only, no resolution
      this.buildConstraints(false),
      // 3. Bare minimum
      { video: true, audio: false }
    ];
    let lastError;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        if (err instanceof DOMException) {
          if (err.name === "NotAllowedError") {
            throw new Error(
              "Camera access denied. Please grant camera permission and try again."
            );
          }
          if (err.name === "NotFoundError") {
            throw new Error(
              "No camera found. Please connect a camera and try again."
            );
          }
          lastError = err;
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
  buildConstraints(includeResolution = true) {
    const video = {};
    if (includeResolution) {
      video.width = this.resolution?.width ?? { ideal: 1920 };
      video.height = this.resolution?.height ?? { ideal: 1080 };
    }
    if (this.facingMode === "environment" || this.facingMode === "user") {
      video.facingMode = this.facingMode;
    } else {
      video.deviceId = { exact: this.facingMode };
    }
    return { video, audio: false };
  }
  static async hasCamera() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === "videoinput");
    } catch {
      return false;
    }
  }
  static async listCameras(requestLabels = false) {
    if (requestLabels) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true
        });
        for (const track of stream.getTracks()) {
          track.stop();
        }
      } catch {
      }
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === "videoinput").map((d) => ({
      id: d.deviceId,
      label: d.label || `Camera ${d.deviceId.slice(0, 8)}`
    }));
  }
};

// src/frame-extractor.ts
var FrameExtractor = class {
  constructor(video, config) {
    this.rafId = null;
    this.running = false;
    this.workerBusy = false;
    this.lastScanTime = -Infinity;
    this.onFrame = null;
    this.tick = () => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(this.tick);
      if (this.workerBusy) return;
      const now = performance.now();
      if (now - this.lastScanTime < this.minInterval) return;
      if (this.video.readyState < 2) return;
      this.lastScanTime = now;
      const region = this.getScanRegion();
      const sx = region.x ?? 0;
      const sy = region.y ?? 0;
      const sw = region.width ?? this.video.videoWidth;
      const sh = region.height ?? this.video.videoHeight;
      if (sw <= 0 || sh <= 0) return;
      this.canvas.width = sw;
      this.canvas.height = sh;
      this.ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, sw, sh);
      const imageData = this.ctx.getImageData(0, 0, sw, sh);
      this.workerBusy = true;
      this.onFrame?.(imageData);
    };
    this.video = video;
    this.minInterval = 1e3 / config.maxScansPerSecond;
    this.getScanRegion = config.getScanRegion;
    if (typeof OffscreenCanvas !== "undefined") {
      this.canvas = new OffscreenCanvas(1, 1);
      this.ctx = this.canvas.getContext("2d");
    } else {
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "none";
      this.ctx = this.canvas.getContext("2d");
    }
  }
  start(onFrame) {
    if (this.running) return;
    this.running = true;
    this.onFrame = onFrame;
    this.rafId = requestAnimationFrame(this.tick);
  }
  stop() {
    this.running = false;
    this.onFrame = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  destroy() {
    this.stop();
    if (this.canvas instanceof HTMLCanvasElement && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
  markWorkerIdle() {
    this.workerBusy = false;
  }
  markWorkerBusy() {
    this.workerBusy = true;
  }
};

// src/overlay.ts
function getRenderedVideoRect(video) {
  const elementWidth = video.clientWidth;
  const elementHeight = video.clientHeight;
  const videoWidth = video.videoWidth || 1;
  const videoHeight = video.videoHeight || 1;
  const objectFit = getComputedStyle(video).objectFit;
  if (objectFit === "cover") {
    const scale = Math.max(
      elementWidth / videoWidth,
      elementHeight / videoHeight
    );
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    return {
      offsetX: (elementWidth - renderedWidth) / 2,
      offsetY: (elementHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight
    };
  }
  if (objectFit === "contain") {
    const scale = Math.min(
      elementWidth / videoWidth,
      elementHeight / videoHeight
    );
    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;
    return {
      offsetX: (elementWidth - renderedWidth) / 2,
      offsetY: (elementHeight - renderedHeight) / 2,
      width: renderedWidth,
      height: renderedHeight
    };
  }
  return { offsetX: 0, offsetY: 0, width: elementWidth, height: elementHeight };
}
var ScanOverlay = class {
  constructor(video, config) {
    this.overlayEl = null;
    this.codeOutlineEl = null;
    this.video = video;
    this.config = config;
    const parent = video.parentElement;
    if (!parent) {
      throw new Error(
        "QrScanner: video element must have a parent element. The parent should have position: relative."
      );
    }
    this.container = parent;
  }
  setup() {
    if (this.config.customOverlay) {
      this.overlayEl = this.config.customOverlay;
      this.positionOverlay();
      return;
    }
    if (this.config.highlightScanRegion) {
      this.createScanRegionOverlay();
    }
    if (this.config.highlightCodeOutline) {
      this.createCodeOutline();
    }
  }
  updateScanRegion(region) {
    if (!this.overlayEl || this.config.customOverlay) return;
    this.positionOverlayToRegion(region);
  }
  updateCodeOutline(cornerPoints, scanRegion) {
    if (!this.codeOutlineEl) return;
    if (!cornerPoints || cornerPoints.length < 4) {
      this.codeOutlineEl.style.display = "none";
      return;
    }
    this.codeOutlineEl.style.display = "block";
    const polygon = this.codeOutlineEl.querySelector("polygon");
    if (!polygon) return;
    const regionX = scanRegion?.x ?? 0;
    const regionY = scanRegion?.y ?? 0;
    const rendered = getRenderedVideoRect(this.video);
    const scaleX = rendered.width / this.video.videoWidth;
    const scaleY = rendered.height / this.video.videoHeight;
    const points = cornerPoints.map(
      (p) => `${(p.x + regionX) * scaleX + rendered.offsetX},${(p.y + regionY) * scaleY + rendered.offsetY}`
    ).join(" ");
    polygon.setAttribute("points", points);
  }
  destroy() {
    if (this.overlayEl && !this.config.customOverlay) {
      this.overlayEl.remove();
    }
    if (this.codeOutlineEl) {
      this.codeOutlineEl.remove();
    }
    this.overlayEl = null;
    this.codeOutlineEl = null;
  }
  createScanRegionOverlay() {
    this.overlayEl = document.createElement("div");
    this.overlayEl.className = "qr-scanner-region";
    Object.assign(this.overlayEl.style, {
      position: "absolute",
      border: "2px solid rgba(255, 255, 255, 0.5)",
      borderRadius: "8px",
      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
      pointerEvents: "none",
      zIndex: "10"
    });
    const corners = ["top-left", "top-right", "bottom-left", "bottom-right"];
    for (const corner of corners) {
      const marker = document.createElement("div");
      marker.className = `qr-scanner-corner qr-scanner-corner-${corner}`;
      const [vertical, horizontal] = corner.split("-");
      Object.assign(marker.style, {
        position: "absolute",
        width: "24px",
        height: "24px",
        [vertical]: "-2px",
        [horizontal]: "-2px",
        [`border-${vertical}`]: "3px solid white",
        [`border-${horizontal}`]: "3px solid white",
        [`border-${vertical}-${horizontal}-radius`]: "8px"
      });
      this.overlayEl.appendChild(marker);
    }
    this.container.appendChild(this.overlayEl);
  }
  createCodeOutline() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "qr-scanner-code-outline");
    Object.assign(svg.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "11",
      display: "none"
    });
    const polygon = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polygon"
    );
    polygon.setAttribute("fill", "none");
    polygon.setAttribute("stroke", "#00ff00");
    polygon.setAttribute("stroke-width", "3");
    polygon.setAttribute("stroke-linejoin", "round");
    const animate = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "animate"
    );
    animate.setAttribute("attributeName", "stroke-opacity");
    animate.setAttribute("values", "1;0.5;1");
    animate.setAttribute("dur", "1.5s");
    animate.setAttribute("repeatCount", "indefinite");
    polygon.appendChild(animate);
    svg.appendChild(polygon);
    this.container.appendChild(svg);
    this.codeOutlineEl = svg;
  }
  positionOverlay() {
    if (!this.overlayEl) return;
    Object.assign(this.overlayEl.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "10"
    });
  }
  positionOverlayToRegion(region) {
    if (!this.overlayEl) return;
    const videoWidth = this.video.videoWidth || 1;
    const videoHeight = this.video.videoHeight || 1;
    const rendered = getRenderedVideoRect(this.video);
    const scaleX = rendered.width / videoWidth;
    const scaleY = rendered.height / videoHeight;
    const x = (region.x ?? 0) * scaleX + rendered.offsetX;
    const y = (region.y ?? 0) * scaleY + rendered.offsetY;
    const w = (region.width ?? videoWidth) * scaleX;
    const h = (region.height ?? videoHeight) * scaleY;
    Object.assign(this.overlayEl.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`
    });
  }
};

// src/scan-region.ts
function calculateDefaultScanRegion(video) {
  const videoWidth = video.videoWidth || video.width;
  const videoHeight = video.videoHeight || video.height;
  const smallerDimension = Math.min(videoWidth, videoHeight);
  const size = Math.round(smallerDimension * 2 / 3);
  return {
    x: Math.round((videoWidth - size) / 2),
    y: Math.round((videoHeight - size) / 2),
    width: size,
    height: size
  };
}

// src/scanner.ts
var customWorkerUrl = null;
function setWorkerUrl(url) {
  customWorkerUrl = url;
}
function resolveWorkerUrl() {
  if (customWorkerUrl) {
    return customWorkerUrl;
  }
  try {
    return new URL("./worker.js", import.meta.url);
  } catch {
    throw new Error(
      '@agicash/qr-scanner: Could not resolve worker URL. Call QrScanner.setWorkerUrl() with the path to the worker script before creating a scanner. Example: QrScanner.setWorkerUrl("/path/to/@agicash/qr-scanner/dist/worker.js")'
    );
  }
}
var Scanner = class {
  constructor(video, onDecode, options = {}) {
    this.frameExtractor = null;
    this.worker = null;
    this.overlay = null;
    this.active = false;
    this.paused = false;
    this.destroyed = false;
    this.video = video;
    this.onDecode = onDecode;
    this.options = options;
    this.camera = new CameraManager({
      preferredCamera: options.preferredCamera,
      cameraResolution: options.cameraResolution
    });
  }
  async start() {
    if (this.destroyed) {
      throw new Error("Scanner has been destroyed");
    }
    if (this.active && !this.paused) {
      return;
    }
    await this.camera.start(this.video);
    if (!this.worker) {
      this.worker = this.createWorker();
    }
    if (!this.frameExtractor) {
      this.frameExtractor = new FrameExtractor(this.video, {
        maxScansPerSecond: this.options.maxScansPerSecond ?? 15,
        getScanRegion: () => this.getCurrentScanRegion()
      });
    }
    if (!this.overlay && (this.options.highlightScanRegion || this.options.highlightCodeOutline || this.options.overlay)) {
      try {
        this.overlay = new ScanOverlay(this.video, {
          highlightScanRegion: this.options.highlightScanRegion ?? false,
          highlightCodeOutline: this.options.highlightCodeOutline ?? false,
          customOverlay: this.options.overlay
        });
        this.overlay.setup();
        this.overlay.updateScanRegion(this.getCurrentScanRegion());
      } catch {
      }
    }
    this.frameExtractor.start((imageData) => {
      this.sendToWorker(imageData);
    });
    this.active = true;
    this.paused = false;
  }
  stop() {
    this.frameExtractor?.stop();
    this.camera.stop();
    this.video.srcObject = null;
    this.active = false;
    this.paused = false;
  }
  destroy() {
    if (this.destroyed) return;
    this.stop();
    this.frameExtractor?.destroy();
    this.frameExtractor = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.worker?.terminate();
    this.worker = null;
    this.destroyed = true;
  }
  async pause(stopStreamImmediately = true) {
    if (!this.active) return false;
    this.frameExtractor?.stop();
    this.paused = true;
    if (stopStreamImmediately) {
      this.camera.stop();
      this.video.srcObject = null;
    }
    return true;
  }
  async setCamera(facingModeOrDeviceId) {
    const wasActive = this.active && !this.paused;
    if (wasActive) {
      this.frameExtractor?.stop();
    }
    await this.camera.setCamera(facingModeOrDeviceId, this.video);
    if (wasActive) {
      this.frameExtractor?.start((imageData) => {
        this.sendToWorker(imageData);
      });
    }
  }
  async hasFlash() {
    return this.camera.hasFlash();
  }
  isFlashOn() {
    return this.camera.isFlashOn();
  }
  async toggleFlash() {
    return this.camera.toggleFlash();
  }
  async turnFlashOn() {
    return this.camera.turnFlashOn();
  }
  async turnFlashOff() {
    return this.camera.turnFlashOff();
  }
  setInversionMode(mode) {
    if (!this.worker) return;
    const options = {};
    switch (mode) {
      case "original":
        options.tryInvert = false;
        break;
      case "invert":
        options.tryInvert = true;
        break;
      case "both":
        options.tryInvert = true;
        break;
    }
    const msg = { type: "configure", options };
    this.worker.postMessage(msg);
  }
  isActive() {
    return this.active;
  }
  isPaused() {
    return this.paused;
  }
  isDestroyed() {
    return this.destroyed;
  }
  getCurrentScanRegion() {
    if (this.options.calculateScanRegion) {
      return this.options.calculateScanRegion(this.video);
    }
    return calculateDefaultScanRegion(this.video);
  }
  createWorker() {
    const workerUrl = resolveWorkerUrl();
    const worker = new Worker(workerUrl, { type: "module" });
    if (this.options.decoderOptions) {
      const msg = {
        type: "configure",
        options: this.options.decoderOptions
      };
      worker.postMessage(msg);
    }
    worker.onmessage = (e) => {
      this.handleWorkerMessage(e.data);
    };
    worker.onerror = (err) => {
      console.error("QR Scanner worker error:", err);
      this.frameExtractor?.markWorkerIdle();
    };
    return worker;
  }
  handleWorkerMessage(response) {
    this.frameExtractor?.markWorkerIdle();
    if (response.type === "ready") {
      return;
    }
    if (response.type === "error") {
      this.options.onDecodeError?.(response.message);
      return;
    }
    if (response.type === "result") {
      if (response.results.length > 0) {
        const result = response.results[0];
        this.onDecode(result);
        if (this.overlay) {
          const region = this.getCurrentScanRegion();
          this.overlay.updateScanRegion(region);
          this.overlay.updateCodeOutline(result.cornerPoints, region);
        }
      } else {
        this.options.onDecodeError?.("No QR code found");
        if (this.overlay) {
          this.overlay.updateCodeOutline(null);
        }
      }
    }
  }
  sendToWorker(imageData) {
    if (!this.worker) return;
    const msg = { type: "decode", imageData };
    this.worker.postMessage(msg, [imageData.data.buffer]);
  }
};

// src/scan-image.ts
import { readBarcodes } from "zxing-wasm/reader";

// src/utils.ts
async function loadImageData(source, scanRegion, canvas) {
  const img = await resolveImageSource(source);
  const sx = scanRegion?.x ?? 0;
  const sy = scanRegion?.y ?? 0;
  const sw = scanRegion?.width ?? img.width - sx;
  const sh = scanRegion?.height ?? img.height - sy;
  let drawCanvas;
  let ctx;
  if (canvas) {
    drawCanvas = canvas;
    canvas.width = sw;
    canvas.height = sh;
    ctx = canvas.getContext("2d");
  } else if (typeof OffscreenCanvas !== "undefined") {
    drawCanvas = new OffscreenCanvas(sw, sh);
    ctx = drawCanvas.getContext("2d");
  } else {
    drawCanvas = document.createElement("canvas");
    drawCanvas.width = sw;
    drawCanvas.height = sh;
    ctx = drawCanvas.getContext("2d");
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return ctx.getImageData(0, 0, sw, sh);
}
async function resolveImageSource(source) {
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement || source instanceof ImageBitmap) {
    return source;
  }
  if (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) {
    return source;
  }
  if (source instanceof File || source instanceof Blob) {
    return createImageBitmapFromBlob(source);
  }
  const url = source instanceof URL ? source.href : source;
  const response = await fetch(url);
  const blob = await response.blob();
  return createImageBitmapFromBlob(blob);
}
async function createImageBitmapFromBlob(blob) {
  if (typeof createImageBitmap !== "undefined") {
    return createImageBitmap(blob);
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// src/scan-image.ts
var defaultReaderOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  tryInvert: true,
  tryRotate: true,
  tryDenoise: false,
  tryDownscale: true,
  maxNumberOfSymbols: 1
};
function mapPosition(position) {
  return [
    position.topLeft,
    position.topRight,
    position.bottomRight,
    position.bottomLeft
  ];
}
function isDirectInput(source) {
  return source instanceof Blob || source instanceof ArrayBuffer || source instanceof Uint8Array || typeof ImageData !== "undefined" && source instanceof ImageData;
}
async function scanImage(source, options) {
  const readerOptions = {
    ...defaultReaderOptions,
    ...options?.decoderOptions,
    formats: ["QRCode"]
  };
  let input;
  if (isDirectInput(source)) {
    input = source;
  } else if (typeof source === "string" || source instanceof URL) {
    const url = source instanceof URL ? source.href : source;
    const response = await fetch(url);
    input = await response.arrayBuffer();
  } else {
    input = await loadImageData(source, options?.scanRegion, options?.canvas);
  }
  const results = await readBarcodes(input, readerOptions);
  const valid = results.filter((r) => r.isValid);
  if (valid.length === 0) {
    throw new Error("No QR code found in the image");
  }
  const first = valid[0];
  return {
    data: first.text,
    cornerPoints: mapPosition(first.position)
  };
}

// src/index.ts
import { setZXingModuleOverrides } from "zxing-wasm/reader";
var QrScanner = class {
  constructor(videoElement, onDecode, options = {}) {
    this.scanner = new Scanner(videoElement, onDecode, options);
  }
  /** Start camera and begin scanning. Resolves when camera is ready. */
  async start() {
    return this.scanner.start();
  }
  /** Stop scanning and release the camera stream. */
  stop() {
    this.scanner.stop();
  }
  /** Stop scanning, release camera, terminate worker, clean up DOM. */
  destroy() {
    this.scanner.destroy();
  }
  /** Pause scanning. If stopStreamImmediately is false, camera stays on. */
  async pause(stopStreamImmediately) {
    return this.scanner.pause(stopStreamImmediately);
  }
  /** Switch to a different camera by facing mode or device ID. */
  async setCamera(facingModeOrDeviceId) {
    return this.scanner.setCamera(facingModeOrDeviceId);
  }
  /** Check if the current camera supports flash/torch. */
  async hasFlash() {
    return this.scanner.hasFlash();
  }
  /** Whether flash is currently on. */
  isFlashOn() {
    return this.scanner.isFlashOn();
  }
  /** Toggle flash on/off. */
  async toggleFlash() {
    return this.scanner.toggleFlash();
  }
  /** Turn flash on. */
  async turnFlashOn() {
    return this.scanner.turnFlashOn();
  }
  /** Turn flash off. */
  async turnFlashOff() {
    return this.scanner.turnFlashOff();
  }
  /** Set the inversion mode for detecting inverted QR codes. */
  setInversionMode(mode) {
    this.scanner.setInversionMode(mode);
  }
  // --- Static methods ---
  /** Check if the device has at least one camera. */
  static hasCamera() {
    return CameraManager.hasCamera();
  }
  /** List available cameras. Pass true to request labels (triggers permission prompt). */
  static listCameras(requestLabels) {
    return CameraManager.listCameras(requestLabels);
  }
  /**
   * Pre-load the WASM binary so it's ready when the scanner starts.
   * Call this early (e.g., on app init) to avoid delay on first scan.
   */
  static async preload() {
    const pixel = new Uint8ClampedArray([255, 255, 255, 255]);
    const img = new ImageData(pixel, 1, 1);
    try {
      await scanImage(img);
    } catch {
    }
  }
  /**
   * Configure WASM loading. Call before creating any scanner instance.
   * @example
   * QrScanner.configureWasm({ locateFile: (filename) => `/wasm/${filename}` });
   */
  static configureWasm(overrides) {
    setZXingModuleOverrides(overrides);
  }
  /**
   * Set a custom URL for the worker script. Call before creating any scanner.
   * Needed for CJS consumers or non-standard bundler setups.
   * By default, the worker URL is resolved via `new URL('./worker.js', import.meta.url)`,
   * which works with Vite, webpack 5, Parcel, and other modern bundlers.
   * @example
   * QrScanner.setWorkerUrl('/assets/qr-scanner-worker.js');
   */
  static setWorkerUrl(url) {
    setWorkerUrl(url);
  }
  /** Scan a single image (not a video stream). */
  static scanImage(source, options) {
    return scanImage(source, options);
  }
};
var index_default = QrScanner;
export {
  index_default as default
};
//# sourceMappingURL=index.js.map