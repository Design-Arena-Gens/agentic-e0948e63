import { CommandAgent } from "@/components/CommandAgent";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 font-sans text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 lg:px-12">
      <main className="mx-auto flex max-w-6xl flex-col gap-12">
        <CommandAgent />
      </main>
    </div>
  );
}
