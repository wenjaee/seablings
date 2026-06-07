import { Suspense } from "react";

import { BucketListScreen } from "@/components/zymix/bucket-list-screen";

export const metadata = {
  title: "Bucket list · ZYMIX"
};

export default function BucketListPage() {
  return (
    <Suspense fallback={null}>
      <BucketListScreen />
    </Suspense>
  );
}
