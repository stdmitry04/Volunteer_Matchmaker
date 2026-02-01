'use client';

import { UserProfile } from '@/lib/mock/profileData';
import AvatarUpload from './AvatarUpload';

interface ProfileHeaderProps {
  profile: UserProfile;
  avatarUrl?: string | null;
  onAvatarUpload?: (newAvatarUrl: string) => void;
  onAvatarDelete?: () => void;
}

export default function ProfileHeader({
  profile,
  avatarUrl,
  onAvatarUpload,
  onAvatarDelete,
}: ProfileHeaderProps) {
  const memberSince = new Date(profile.joinedAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const userName = `${profile.firstName} ${profile.lastName}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Avatar with Upload */}
        {onAvatarUpload && onAvatarDelete ? (
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            userName={userName}
            onUploadSuccess={onAvatarUpload}
            onDeleteSuccess={onAvatarDelete}
          />
        ) : (
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-primary flex items-center justify-center text-white text-3xl md:text-4xl font-bold flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={userName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              `${profile.firstName[0]}${profile.lastName[0]}`
            )}
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-gray-500 mt-1">@{profile.username}</p>

          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {profile.location}
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Member since {memberSince}
            </div>
          </div>

          {/* Bio */}
          <p className="mt-4 text-gray-700 leading-relaxed">
            {profile.bio}
          </p>
        </div>
      </div>
    </div>
  );
}
