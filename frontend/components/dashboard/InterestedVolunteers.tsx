'use client';

import { useState, useEffect } from 'react';
import { jobService, InterestedUser } from '@/lib/services/job.service';
import Button from '@/components/ui/Button';

interface InterestedVolunteersProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function InterestedVolunteers({ jobId, isOpen, onClose }: InterestedVolunteersProps) {
  const [volunteers, setVolunteers] = useState<InterestedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [accepting, setAccepting] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const data = await jobService.getInterestedUsers(jobId);
        setVolunteers(data);
      } catch (error) {
        console.error('Failed to load interested users:', error);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isOpen, jobId]);

  const handleAccept = async (userId: number) => {
    setAccepting(userId);
    try {
      await jobService.acceptVolunteer(jobId, userId);
      setVolunteers((prev) => prev.filter((v) => v.user_id !== userId));
    } catch (error: unknown) {
      console.error('Failed to accept volunteer:', error);
      // Extract error message from response
      let message = 'Failed to accept volunteer. Please try again.';
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        if (axiosError.response?.data?.error) {
          message = axiosError.response.data.error;
        }
      }
      alert(message);
    } finally {
      setAccepting(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Interested Volunteers</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 p-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-1" />
                  <div className="h-3 bg-gray-200 rounded w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : volunteers.length === 0 ? (
          <p className="text-gray-500 text-center py-6">No volunteers have expressed interest yet.</p>
        ) : (
          <div className="space-y-2">
            {volunteers.map((v) => (
              <div key={v.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                    {v.first_name?.[0]}{v.last_name?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{v.first_name} {v.last_name}</p>
                    <p className="text-sm text-gray-500">@{v.username}</p>
                  </div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => handleAccept(v.user_id)}
                  disabled={accepting === v.user_id}
                >
                  {accepting === v.user_id ? 'Accepting...' : 'Accept'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
