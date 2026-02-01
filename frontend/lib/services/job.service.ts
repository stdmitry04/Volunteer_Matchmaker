import api from '../api';
import { Job } from '@/types/matching';
import { JobFormData } from '@/types/job';

export interface InterestedUser {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  interested_at: string;
}

export interface JobAcceptance {
  id: string;
  job: Job;
  username: string;
  status: string;
  created_at: string;
}

export const jobService = {
  async createJob(data: JobFormData): Promise<Job> {
    try {
      // Build payload, only including shift times if they have values
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        short_description: data.short_description,
        skill_tags: data.skill_tags,
        accessibility_flags: data.accessibility_flags,
      };

      // Only include location if set
      if (data.latitude !== undefined && data.longitude !== undefined) {
        payload.latitude = data.latitude;
        payload.longitude = data.longitude;
      }

      // Convert datetime-local format to ISO if present (not empty string)
      if (data.shift_start && data.shift_start.trim()) {
        payload.shift_start = new Date(data.shift_start).toISOString();
      }
      if (data.shift_end && data.shift_end.trim()) {
        payload.shift_end = new Date(data.shift_end).toISOString();
      }

      const response = await api.post<Job>('/matching/jobs/create', payload);
      return response.data;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number; data?: Record<string, unknown> } };
        if (axiosError.response?.status === 400) {
          // Extract validation error message
          const errData = axiosError.response.data;
          if (errData && typeof errData === 'object') {
            const messages = Object.entries(errData)
              .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
              .join('; ');
            throw new Error(messages || 'Invalid data submitted');
          }
        }
        if (axiosError.response?.status === 401) {
          throw new Error('Please log in to post a job');
        }
      }
      throw error;
    }
  },

  async getMyPostedJobs(): Promise<Job[]> {
    const response = await api.get<Job[]>('/matching/jobs/my-posted');
    return response.data;
  },

  async updateJob(jobId: string, data: Partial<JobFormData>): Promise<Job> {
    const response = await api.patch<Job>(`/matching/jobs/${jobId}/update`, data);
    return response.data;
  },

  async deleteJob(jobId: string): Promise<void> {
    await api.delete(`/matching/jobs/${jobId}/delete`);
  },

  async getAcceptedJobs(): Promise<JobAcceptance[]> {
    const response = await api.get<JobAcceptance[]>('/matching/jobs/accepted');
    return response.data;
  },

  async getInterestedJobs(): Promise<Job[]> {
    const response = await api.get<Job[]>('/matching/jobs/interested');
    return response.data;
  },

  async getInterestedUsers(jobId: string): Promise<InterestedUser[]> {
    const response = await api.get<InterestedUser[]>(`/matching/jobs/${jobId}/interested`);
    return response.data;
  },

  async acceptVolunteer(jobId: string, userId: number): Promise<JobAcceptance> {
    const response = await api.post<JobAcceptance>(`/matching/jobs/${jobId}/accept`, {
      user_id: userId,
    });
    return response.data;
  },

  // Alias for acceptVolunteer - poster confirms a volunteer
  async confirmVolunteer(jobId: string, userId: number): Promise<JobAcceptance> {
    const response = await api.post<JobAcceptance>(`/matching/jobs/${jobId}/confirm`, {
      user_id: userId,
    });
    return response.data;
  },

  // Volunteer retracts their application
  async retractApplication(jobId: string): Promise<{ status: string; job_title: string }> {
    const response = await api.post<{ status: string; job_id: string; job_title: string }>(
      `/matching/jobs/${jobId}/retract`
    );
    return response.data;
  },
};
