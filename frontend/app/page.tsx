'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/viewmodels/auth.viewmodel';
import {
  Navbar,
  HeroSection,
  HowItWorks,
  InteractiveHeatmap,
  Footer,
} from '@/components/landing';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();

  const handleSignIn = () => {
    if (isAuthenticated) {
      logout();
    }
    router.push('/auth?mode=signin');
  };

  const handleSignUp = () => {
    if (isAuthenticated) {
      logout();
    }
    router.push('/auth?mode=signup');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onSignIn={handleSignIn} onSignUp={handleSignUp} />

      <main className="flex-1">
        <HeroSection onGetStarted={handleSignUp} />
        <HowItWorks />
        <InteractiveHeatmap />
      </main>

      <Footer />
    </div>
  );
}
