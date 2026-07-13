"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ImpulseKind =
  | "lean"
  | "commit"
  | "reject"
  | "resonate"
  | "skip";

const STRENGTH: Record<ImpulseKind, number> = {
  lean: 0.35,
  commit: 1,
  reject: 0.55,
  resonate: 0.85,
  skip: 0.4,
};

type MiraImpulseContextValue = {
  impulse: number;
  fire: (kind: ImpulseKind) => void;
};

const MiraImpulseContext = createContext<MiraImpulseContextValue>({
  impulse: 0,
  fire: () => {},
});

export function MiraImpulseProvider({ children }: { children: ReactNode }) {
  const [impulse, setImpulse] = useState(0);
  const raf = useRef(0);
  const decaying = useRef(false);
  const decayStep = useRef(() => {
    setImpulse((v) => {
      const next = v * 0.92;
      if (next < 0.02) {
        decaying.current = false;
        return 0;
      }
      raf.current = requestAnimationFrame(() => decayStep.current());
      return next;
    });
  });

  const fire = useCallback((kind: ImpulseKind) => {
    setImpulse((v) => Math.min(1, Math.max(v, STRENGTH[kind])));
    if (!decaying.current) {
      decaying.current = true;
      raf.current = requestAnimationFrame(() => decayStep.current());
    }
  }, []);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    },
    [],
  );

  return (
    <MiraImpulseContext.Provider value={{ impulse, fire }}>
      {children}
    </MiraImpulseContext.Provider>
  );
}

export function useMiraImpulse() {
  return useContext(MiraImpulseContext);
}
