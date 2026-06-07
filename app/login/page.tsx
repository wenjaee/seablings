import { Suspense } from "react";

import { LoginScreen } from "@/components/zymix/login-screen";

export const metadata = {
  title: "Login · ZYMIX"
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginScreen />
    </Suspense>
  );
}
