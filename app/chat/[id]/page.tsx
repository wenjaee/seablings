import { Suspense } from "react";

import { PlannerProvider } from "@/components/planner/planner-provider";
import { GroupChat } from "@/components/zymix/group-chat";
import { PhoneShell } from "@/components/zymix/phone-shell";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <PhoneShell>
      <Suspense fallback={null}>
        <PlannerProvider groupId={id}>
          <GroupChat key={id} chatId={id} />
        </PlannerProvider>
      </Suspense>
    </PhoneShell>
  );
}
