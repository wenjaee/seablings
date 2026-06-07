import type { ReactNode } from "react";

export function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full justify-center bg-[#e6e7ea] sm:items-center sm:py-6">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white sm:h-[904px] sm:max-h-[94dvh] sm:rounded-[48px] sm:border sm:border-black/10 sm:shadow-[0_40px_120px_rgba(0,0,0,0.30)]">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
