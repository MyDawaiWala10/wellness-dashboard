import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wellness Dashboard MDW",
  description: "View all metrics and manage your wellness dashboard with ease.",
};

export default async function DistributorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 return <>{children}</>
}
