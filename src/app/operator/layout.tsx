import OperatorProviders from "@/booking/OperatorProviders";

export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OperatorProviders>{children}</OperatorProviders>;
}
