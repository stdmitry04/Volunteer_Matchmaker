'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/viewmodels/auth.viewmodel';
import { profileService, ProfileResponse, BadgeResponse } from '@/lib/services/profile.service';
import { UserProfile } from '@/lib/mock/profileData';
import { BadgeData } from '@/lib/mock/badgeData';
import {
  ProfileHeader,
  ViewToggle,
  ProfileView,
  RequesterView,
  HelperView,
  AccessibilityPreferences,
  LocationSettings,
} from '@/components/profile';
import ProfileEditModal from '@/components/profile/ProfileEditModal';

// Adapter: convert backend ProfileResponse to frontend UserProfile shape
function adaptProfile(data: ProfileResponse): UserProfile {
  return {
    id: data.user.id,
    email: data.user.email,
    username: data.user.username,
    firstName: data.user.first_name || '',
    lastName: data.user.last_name || '',
    avatar: data.user.avatar_url || undefined,
    bio: '',
    location: data.profile.display_location || 'Location not set',
    joinedAt: new Date().toISOString(),
    requesterStats: {
      jobsSubmitted: 0,
      jobsFulfilled: 0,
      handshakeSuccessRate: 0,
      activeJobs: 0,
      averageRating: 0,
    },
    helperStats: {
      jobsCompleted: 0,
      hoursContributed: 0,
      currentStreak: 0,
      averageRating: 0,
    },
    badges: [],
    skills: data.profile.skill_tags.map((tag, i) => ({
      id: `skill-${i}`,
      name: tag,
      verified: false,
      endorsements: 0,
    })),
    accessibilityPreferences: {
      screenReaderOptimized: false,
      highContrast: false,
      reducedMotion: false,
      largeText: false,
      colorBlindMode: 'none',
    },
    impactBulletPoints: [],
  };
}

// Adapter: convert backend badges to frontend BadgeData shape
function adaptBadges(badges: BadgeResponse[]): BadgeData {
  const LEVEL_MAP: Record<number, 'bronze' | 'silver' | 'gold'> = { 1: 'bronze', 2: 'silver', 3: 'gold' };

  const trackBadges = badges
    .filter((b) => b.level > 0)
    .map((b) => ({
      id: `badge-${b.track}`,
      track: b.track as 'specialist' | 'firefighter' | 'anchor' | 'inclusionist',
      name: b.track.charAt(0).toUpperCase() + b.track.slice(1),
      level: LEVEL_MAP[b.level] || 'bronze' as const,
      currentPoints: b.progress,
      pointsToNextLevel: b.next_threshold ? b.next_threshold - b.progress : 0,
      maxPoints: 250,
      description: b.description,
      earnedAt: new Date().toISOString(),
    }));

  const hasChampion = badges.some((b) => b.track === 'inclusionist' && b.level >= 3);
  const totalPoints = badges.reduce((sum, b) => sum + b.progress, 0);

  return {
    badges: trackBadges,
    accessibilityChampion: hasChampion,
    totalPoints,
  };
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="bg-white rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-4 bg-gray-200 rounded w-64" />
            <div className="h-16 bg-gray-200 rounded w-full mt-4" />
          </div>
        </div>
      </div>
      <div className="flex justify-center">
        <div className="h-12 bg-gray-200 rounded-lg w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl p-5 h-28">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, user, setUser } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [activeView, setActiveView] = useState<ProfileView>('helper');
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [backendProfile, setBackendProfile] = useState<ProfileResponse | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await profileService.getProfile();
      setBackendProfile(data);
      setProfile(adaptProfile(data));
      setBadgeData(adaptBadges(data.badges));
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth?mode=signin');
      return;
    }
    loadData();
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
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
              <span className="text-xl font-bold text-gray-900">Volunteer Matchmaker</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
                href="/matching"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                Discover
              </Link>
              {profile && (
                <div className="flex items-center gap-2">
                  {backendProfile?.user.avatar_url ? (
                    <img
                      src={backendProfile.user.avatar_url}
                      alt={`${profile.firstName} ${profile.lastName}`}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">
                      {profile.firstName[0]}{profile.lastName[0]}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <LoadingSkeleton />
          ) : profile && badgeData ? (
            <div className="space-y-6">
              {/* Profile Header with Edit Buttons */}
              <div className="relative">
                <ProfileHeader
                  profile={profile}
                  avatarUrl={backendProfile?.user.avatar_url}
                  onAvatarUpload={(newUrl) => {
                    if (backendProfile) {
                      setBackendProfile({
                        ...backendProfile,
                        user: { ...backendProfile.user, avatar_url: newUrl },
                      });
                    }
                    // Update auth store so avatar shows in header across all pages
                    if (user) {
                      setUser({ ...user, avatar_url: newUrl });
                    }
                  }}
                  onAvatarDelete={() => {
                    if (backendProfile) {
                      setBackendProfile({
                        ...backendProfile,
                        user: { ...backendProfile.user, avatar_url: null },
                      });
                    }
                    // Update auth store so avatar is removed from header
                    if (user) {
                      setUser({ ...user, avatar_url: null });
                    }
                  }}
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => setShowLocationModal(true)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Location
                  </button>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>

              {/* Location & Distance Info */}
              {backendProfile && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {backendProfile.profile.display_location}
                        </p>
                        <p className="text-sm text-gray-500">
                          Willing to travel up to {backendProfile.profile.max_distance_miles} miles
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowLocationModal(true)}
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Update
                    </button>
                  </div>
                </div>
              )}

              {/* View Toggle */}
              <ViewToggle activeView={activeView} onViewChange={setActiveView} />

              {/* View Content */}
              {activeView === 'requester' ? (
                <RequesterView stats={profile.requesterStats} />
              ) : (
                <HelperView
                  stats={profile.helperStats}
                  badgeData={badgeData}
                  skills={profile.skills}
                  impactBulletPoints={profile.impactBulletPoints}
                />
              )}

              {/* Shared: Accessibility Preferences - uses global context */}
              <AccessibilityPreferences />
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Failed to load profile. Please try again.</p>
            </div>
          )}
        </div>
      </main>

      {/* Edit Modal */}
      {backendProfile && (
        <ProfileEditModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={loadData}
          currentSkills={backendProfile.profile.skill_tags}
          currentLimitations={backendProfile.profile.limitations}
        />
      )}

      {/* Location Settings Modal */}
      <LocationSettings
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onSave={loadData}
        initialLocation={backendProfile ? {
          location_source: backendProfile.profile.location_source,
          location_label: backendProfile.profile.location_label,
          display_location: backendProfile.profile.display_location,
          max_distance_miles: backendProfile.profile.max_distance_miles,
          has_location: backendProfile.profile.latitude !== null,
          last_updated: null,
        } : undefined}
      />
    </div>
  );
}
