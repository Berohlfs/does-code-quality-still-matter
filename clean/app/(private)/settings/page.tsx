import { ApiTokensSection } from "./_components/api-tokens-section";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Settings</h1>
      <ApiTokensSection />
    </main>
  );
}
