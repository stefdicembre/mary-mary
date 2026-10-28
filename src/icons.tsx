// Simple line icons, drawn in the same style as the wireframes.

import type { AreaKind } from "./lib/types";

type P = { size?: number; color?: string };

const base = (size: number, color: string, w = 1.8) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: color,
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconMenu = ({ size = 24, color = "#27500A" }: P) => (
  <svg {...base(size, color)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconCog = ({ size = 24, color = "#27500A" }: P) => (
  <svg {...base(size, color, 1.6)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
export const IconBack = ({ size = 18, color = "#3B6D11" }: P) => (
  <svg {...base(size, color, 2)}><path d="M15 6l-6 6 6 6" /></svg>
);
export const IconNext = ({ size = 18, color = "#5F5E5A" }: P) => (
  <svg {...base(size, color, 2)} style={{ flex: "none" }}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconPlus = ({ size = 18, color = "#27500A" }: P) => (
  <svg {...base(size, color, 2)}><path d="M12 5v14M5 12h14" /></svg>
);
export const IconClose = ({ size = 22, color = "#27500A" }: P) => (
  <svg {...base(size, color)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconLeaf = ({ size = 28, color = "#3B6D11" }: P) => (
  <svg {...base(size, color, 1.5)}>
    <path d="M12 21V11" />
    <path d="M12 13C12 9 9 7 5 7C5 11 8 13 12 13Z" />
    <path d="M12 11C12 7.5 14.5 5 19 5C19 9 16 11 12 11Z" />
  </svg>
);
export const IconBook = ({ size = 22, color = "#3B6D11" }: P) => (
  <svg {...base(size, color, 1.6)}><path d="M6 4h12v16H8a2 2 0 0 1-2-2z" /><path d="M6 18a2 2 0 0 1 2-2h10" /></svg>
);
export const IconDownload = ({ size = 22, color = "#3B6D11" }: P) => (
  <svg {...base(size, color, 1.6)}><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);

export function AreaIcon({ kind, size = 30 }: { kind: AreaKind; size?: number }) {
  const g = "#3B6D11";
  const a = "#D85A30";
  const s = { ...base(size, g, 1.5) };
  switch (kind) {
    case "border":
      return (
        <svg {...s}>
          <path d="M3 20h18" />
          <path d="M7 20v-7M12 20v-9M17 20v-6" />
          <circle cx="7" cy="11" r="2" stroke={a} />
          <circle cx="12" cy="8.5" r="2.5" stroke="#EF9F27" />
          <circle cx="17" cy="12" r="2" stroke="#D4537E" />
        </svg>
      );
    case "bed":
      return (
        <svg {...s}>
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
          <path d="M8 14v-4M12 14V8M16 14v-4" />
          <path d="M12 8c0-2 1.5-3 3-3 0 2-1.5 3-3 3zM8 10c0-1.6-1.2-2.5-2.5-2.5 0 1.6 1.2 2.5 2.5 2.5z" />
        </svg>
      );
    case "pots":
      return (
        <svg {...s}>
          <path d="M6 13h12l-1.5 7h-9z" stroke="#993C1D" />
          <path d="M12 13V8" />
          <path d="M12 9c0-2.5 2-4 4.5-4 0 2.5-2 4-4.5 4zM12 10c0-2-1.6-3.2-3.6-3.2 0 2 1.6 3.2 3.6 3.2z" />
        </svg>
      );
    case "greenhouse":
      return (
        <svg {...s}>
          <path d="M4 20V10l8-6 8 6v10z" />
          <path d="M4 10h16M12 4v16M8 20v-6h8v6" />
        </svg>
      );
    case "veg":
      return (
        <svg {...s}>
          <path d="M10 9l-5 11 11-5" stroke="#D85A30" />
          <path d="M10 9c1.5-1.5 4-1.5 5 0s1.5 3.5 0 5" stroke="#D85A30" />
          <path d="M15 9l3-3M16 11l4-1M14 8l1-4" />
        </svg>
      );
    case "water":
      return (
        <svg {...s} stroke="#185FA5">
          <path d="M3 10c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
          <path d="M3 15c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" />
        </svg>
      );
    case "lawn":
      return (
        <svg {...s}>
          <path d="M3 20h18" />
          <path d="M5 20l1-6M8 20l-1-7M11 20l1-8M14 20l-1-6M17 20l1-7M20 20l-1-5" />
        </svg>
      );
    default:
      return <IconLeaf size={size} />;
  }
}
