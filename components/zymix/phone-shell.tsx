import type { ReactNode } from "react";
import { BatteryMedium, SignalHigh, Wifi } from "lucide-react";

function StatusBar() {
  return (
    <div className="relative flex h-12 shrink-0 items-center justify-between px-7 text-[var(--zx-ink)]">
      <span className="text-[15px] font-semibold tabular-nums tracking-tight">9:41</span>
      <span aria-hidden className="absolute left-1/2 top-2.5 h-7 w-[88px] -translate-x-1/2 rounded-full bg-black" />
      <span className="flex items-center gap-1.5">
        <SignalHigh size={18} />
        <Wifi size={18} />
        <BatteryMedium size={24} />
      </span>
    </div>
  );
}

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-[#e6e7ea] sm:items-center sm:py-6">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white sm:h-[904px] sm:max-h-[94dvh] sm:rounded-[48px] sm:border sm:border-black/10 sm:shadow-[0_40px_120px_rgba(0,0,0,0.30)]">
        <StatusBar />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
