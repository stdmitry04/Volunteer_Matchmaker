'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SwipeCardStack } from '@/components/matching';
import { matchingService } from '@/lib/services/matching.service';
import { Job } from '@/types/matching';

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="w-12 h-12 border-4 border-primary-light border-t-primary rounded-full animate-spin mb-4" />
      <p className="text-gray-600">Finding jobs for you...</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <div className="w-16 h-16 mb-4 text-red-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Failed to load jobs</h2>
      <p className="text-gray-600 mb-6">Something went wrong. Please try again.</p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

export default function MatchingPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await matchingService.getJobs();
      setJobs(data);
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Go back"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Discover Jobs</h1>
        <div className="w-10" />
      </header>

      {/* Instructions banner */}
      {!isLoading && !error && jobs.length > 0 && (
        <div className="bg-primary-light px-4 py-2 text-center">
          <p className="text-sm text-primary-dark">
            <span className="font-medium">Swipe right</span> to express interest,{' '}
            <span className="font-medium">swipe left</span> to skip
          </p>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden pt-4">
        {isLoading && <LoadingState />}
        {error && <ErrorState onRetry={fetchJobs} />}
        {!isLoading && !error && <SwipeCardStack jobs={jobs} />}
      </main>
    </div>
  );
}
