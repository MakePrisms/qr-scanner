import type { ScanRegion } from './types.js';

/**
 * Calculate the default scan region: a centered square covering
 * 2/3 of the smaller video dimension.
 */
export function calculateDefaultScanRegion(video: HTMLVideoElement): ScanRegion {
  const videoWidth = video.videoWidth || video.width;
  const videoHeight = video.videoHeight || video.height;

  const smallerDimension = Math.min(videoWidth, videoHeight);
  const size = Math.round((smallerDimension * 2) / 3);

  return {
    x: Math.round((videoWidth - size) / 2),
    y: Math.round((videoHeight - size) / 2),
    width: size,
    height: size,
  };
}
