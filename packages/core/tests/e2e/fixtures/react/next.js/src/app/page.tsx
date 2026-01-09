import { Header } from '../components/Header';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Header title="Welcome to Riflebird Next.js Fixture" />
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex">
        <p>This is a Next.js App Router component.</p>
      </div>
    </main>
  );
}
