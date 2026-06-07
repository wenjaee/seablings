import type { Route } from "next";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Bucket list · ZYMIX"
};

export default function BucketListPage() {
  redirect("/me/bucket-list" as Route);
}
