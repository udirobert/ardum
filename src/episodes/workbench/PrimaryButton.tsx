import type { ReactNode } from "react";

export default function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-6 py-3 rounded-sm bg-foreground text-background disabled:opacity-40"
    >
      {children}
    </button>
  );
}
