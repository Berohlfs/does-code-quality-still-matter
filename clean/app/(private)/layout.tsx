import { PrivateShell } from "./_components/private-shell";

export default function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivateShell>{children}</PrivateShell>;
}
