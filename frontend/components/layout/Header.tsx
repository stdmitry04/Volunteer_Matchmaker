'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/viewmodels/auth.viewmodel';

export default function Header() {
  const { user, isAuthenticated, _hasHydrated } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Don't render auth-dependent content until hydration is complete
  const showAuthContent = hasMounted && _hasHydrated;

  return (
    <header className="h-16 border-b border-gray-200 flex items-center justify-between px-6 bg-white">
      <Link href={showAuthContent && isAuthenticated ? '/dashboard' : '/'} className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </div>
        <span className="text-lg font-bold text-gray-900">Volunteer Matchmaker</span>
      </Link>

      {showAuthContent && isAuthenticated && user && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.first_name} {user.last_name}</span>
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={`${user.first_name} ${user.last_name}`}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
              {user.first_name?.[0]}{user.last_name?.[0]}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
