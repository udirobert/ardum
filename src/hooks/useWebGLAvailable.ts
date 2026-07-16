"use client";

function probeWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Whether a WebGL context can be created. false during SSR. */
export function useWebGLAvailable(): boolean {
  return typeof window !== "undefined" ? probeWebGL() : false;
}
