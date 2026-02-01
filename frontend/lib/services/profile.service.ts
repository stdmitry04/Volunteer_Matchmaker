import api from '../api';

export interface ProfileResponse {
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
  profile: {
    latitude: number | null;
    longitude: number | null;
    location_source: 'gps' | 'manual';
    location_label: string;
    display_location: string;
    max_distance_miles: number;
    skill_tags: string[];
    limitations: string[];
  };
  badges: BadgeResponse[];
}

export interface BadgeResponse {
  track: string;
  level: number;
  level_name: string;
  progress: number;
  next_threshold: number | null;
  title: string;
  description: string;
}

export interface UpdateProfilePayload {
  skill_tags?: string[];
  limitations?: string[];
  max_distance_miles?: number;
}

export interface LocationResponse {
  location_source: 'gps' | 'manual';
  location_label: string;
  display_location: string;
  max_distance_miles: number;
  has_location: boolean;
  last_updated: string | null;
}

export interface UpdateLocationPayload {
  latitude?: number;
  longitude?: number;
  location_source: 'gps' | 'manual';
  manual_location?: string;
  max_distance_miles?: number;
}

export const profileService = {
  async getProfile(): Promise<ProfileResponse> {
    const response = await api.get<ProfileResponse>('/matching/profile');
    return response.data;
  },

  async updateProfile(data: UpdateProfilePayload): Promise<ProfileResponse> {
    const response = await api.patch<ProfileResponse>('/matching/profile', data);
    return response.data;
  },

  async getLocation(): Promise<LocationResponse> {
    const response = await api.get<LocationResponse>('/matching/location');
    return response.data;
  },

  async updateLocation(data: UpdateLocationPayload): Promise<LocationResponse> {
    const response = await api.put<LocationResponse>('/matching/location', data);
    return response.data;
  },

  async revokeLocation(): Promise<{ message: string; has_location: boolean }> {
    const response = await api.delete('/matching/location/revoke');
    return response.data;
  },

  async uploadAvatar(file: File): Promise<{ message: string; avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await api.post('/auth/avatar/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async deleteAvatar(): Promise<{ message: string }> {
    const response = await api.delete('/auth/avatar/delete/');
    return response.data;
  },
};
