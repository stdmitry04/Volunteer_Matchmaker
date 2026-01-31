'use client';

import Header from './Header';
import Navigation from './Navigation';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="flex">
        <Navigation />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
