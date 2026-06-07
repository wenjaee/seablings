import { Suspense } from "react";

import { ChatListScreen } from "@/components/zymix/chat-list-screen";

export const metadata = {
  title: "ZYMIX"
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <ChatListScreen />
    </Suspense>
  );
}
