import { Suspense } from "react";

import { ProfileScreen } from "@/components/zymix/profile-screen";

export const metadata = {
  title: "Me · ZYMIX"
};

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}
