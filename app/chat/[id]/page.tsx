import { GroupChat } from "@/components/zymix/group-chat";
import { PhoneShell } from "@/components/zymix/phone-shell";
import { getThread } from "@/lib/zymix/data";

export default async function ChatThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thread = getThread(id);

  return (
    <PhoneShell>
      <GroupChat thread={thread} />
    </PhoneShell>
  );
}
