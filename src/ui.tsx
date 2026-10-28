// Small building blocks shared by the screens.

import type { ReactNode } from "react";
import { IconBack } from "./icons";
import { useStore } from "./store";

export function BackBar({ to, label, right }: { to: string; label: string; right?: ReactNode }) {
  return (
    <div className="topbar">
      <a className="back" href={to}>
        <IconBack />
        {label}
      </a>
      {right}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T | undefined) => void;
  label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(value === o.value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="toggle-row">
      <label htmlFor={id} style={{ fontSize: 15, fontWeight: 600 }}>
        {label}
      </label>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span />
      </span>
    </div>
  );
}

export function ToastBar() {
  const { toast, undo, dismissToast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.undo ? (
        <button type="button" onClick={undo}>
          Undo
        </button>
      ) : (
        <button type="button" onClick={dismissToast} aria-label="Dismiss">
          OK
        </button>
      )}
    </div>
  );
}

export function NotFound({ what }: { what: string }) {
  return (
    <>
      <BackBar to="#/" label="Home" />
      <p className="empty">That {what} isn't here any more. It may have been removed.</p>
    </>
  );
}
