import clsx from "clsx";
import { Volume2 } from "lucide-react";

import type { AvatarSpec } from "@/lib/zymix/data";

type AvatarProps = {
  spec: AvatarSpec;
  size?: number;
  className?: string;
};

export function Avatar({ spec, size = 48, className }: AvatarProps) {
  const base = "shrink-0 overflow-hidden";
  const style = { width: size, height: size };

  if (spec.kind === "checker") {
    return <span aria-hidden className={clsx(base, "zx-checker rounded-full", className)} style={style} />;
  }

  if (spec.kind === "speaker") {
    return (
      <span
        aria-hidden
        className={clsx(base, "flex items-center justify-center rounded-full", className)}
        style={{ ...style, background: "var(--zx-brand-soft)" }}
      >
        <Volume2 size={Math.round(size * 0.44)} strokeWidth={2.4} className="text-[var(--zx-brand-deep)]" />
      </span>
    );
  }

  if (spec.kind === "tile") {
    return (
      <span
        aria-hidden
        className={clsx(
          base,
          "flex items-center justify-center",
          spec.rounded === "full" ? "rounded-full" : "rounded-[28%]",
          className
        )}
        style={{ ...style, background: spec.bg }}
      >
        <span style={{ fontSize: Math.round(size * 0.5), lineHeight: 1 }}>{spec.emoji}</span>
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={clsx(base, "flex items-center justify-center rounded-full font-semibold", className)}
      style={{ ...style, background: spec.bg, color: spec.fg ?? "#ffffff", fontSize: Math.round(size * 0.4) }}
    >
      {spec.initials}
    </span>
  );
}
