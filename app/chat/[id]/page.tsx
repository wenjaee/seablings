import { Suspense } from "react";

import { GroupChat } from "@/components/zymix/group-chat";
import { PhoneShell } from "@/components/zymix/phone-shell";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PhoneShell>
      <Suspense fallback={null}>
        <GroupChat key={id} chatId={id} />
      </Suspense>
    </PhoneShell>
  );
}
