'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { aiService } from '@/lib/services/ai.service';
import {
  JobFormData,
  AccessibilityFlags,
  EnhanceJobResponse,
  SKILL_TAG_OPTIONS,
  DEFAULT_ACCESSIBILITY_FLAGS,
} from '@/types/job';

interface JobSubmissionFormProps {
  onSubmit?: (data: JobFormData) => Promise<void>;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  fieldsToOverwrite: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ isOpen, fieldsToOverwrite, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Overwrite existing fields?</h3>
        <p className="text-gray-600 mb-4">
          The following fields already have content that will be replaced:
        </p>
        <ul className="list-disc list-inside mb-4 text-gray-700">
          {fieldsToOverwrite.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>
            Keep My Input
          </Button>
          <Button onClick={onConfirm}>Overwrite</Button>
        </div>
      </div>
    </div>
  );
}

export default function JobSubmissionForm({ onSubmit }: JobSubmissionFormProps) {
  const { showToast, ToastContainer } = useToast();
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geminiPrompt, setGeminiPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [generatedImage, setGeneratedImage] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [accessibilityFlags, setAccessibilityFlags] = useState<AccessibilityFlags>(DEFAULT_ACCESSIBILITY_FLAGS);
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [manualAddress, setManualAddress] = useState('');
  const [showManualLocation, setShowManualLocation] = useState(false);

  // Confirm dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingEnhancement, setPendingEnhancement] = useState<EnhanceJobResponse | null>(null);
  const [fieldsToOverwrite, setFieldsToOverwrite] = useState<string[]>([]);

  const hasExistingContent = useCallback(() => {
    const fields: string[] = [];
    if (title.trim()) fields.push('Title');
    if (description.trim()) fields.push('Description');
    if (shortDescription.trim()) fields.push('Short Description');
    if (selectedSkills.length > 0) fields.push('Skills');
    const hasAccessibilitySet = Object.values(accessibilityFlags).some((v) => v);
    if (hasAccessibilitySet) fields.push('Accessibility Requirements');
    return fields;
  }, [title, description, shortDescription, selectedSkills, accessibilityFlags]);

  const applyEnhancement = useCallback((result: EnhanceJobResponse) => {
    setTitle(result.title);
    setDescription(result.description);
    setShortDescription(result.short_description);
    setSelectedSkills(result.skill_tags);
    setAccessibilityFlags(result.accessibility_flags);
    showToast('Form filled with AI suggestions!', 'success');
  }, [showToast]);

  const handleGeminiAssist = async () => {
    // If no content in form and no prompt input showing, show prompt input
    const promptToUse = geminiPrompt.trim() || description.trim() || title.trim();

    if (!promptToUse) {
      setShowPromptInput(true);
      return;
    }

    setIsEnhancing(true);
    try {
      const result = await aiService.enhanceJob(promptToUse);

      // Check if user has existing content
      const existingFields = hasExistingContent();
      if (existingFields.length > 0) {
        setPendingEnhancement(result);
        setFieldsToOverwrite(existingFields);
        setShowConfirmDialog(true);
      } else {
        applyEnhancement(result);
      }

      setShowPromptInput(false);
      setGeminiPrompt('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to enhance. Please try again.', 'error');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleConfirmOverwrite = () => {
    if (pendingEnhancement) {
      applyEnhancement(pendingEnhancement);
    }
    setShowConfirmDialog(false);
    setPendingEnhancement(null);
    setFieldsToOverwrite([]);
  };

  const handleCancelOverwrite = () => {
    setShowConfirmDialog(false);
    setPendingEnhancement(null);
    setFieldsToOverwrite([]);
    showToast('Kept your original input', 'info');
  };

  const handleGenerateImage = async () => {
    const prompt = `${title} ${shortDescription}`.trim();
    if (!prompt) {
      showToast('Please enter a title or short description first', 'error');
      return;
    }

    setIsGeneratingImage(true);
    try {
      const imageUrl = await aiService.generateImage(prompt);
      setGeneratedImage(imageUrl);
      showToast('Image generated!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to generate image.', 'error');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const toggleAccessibilityFlag = (flag: keyof AccessibilityFlags) => {
    setAccessibilityFlags((prev) => ({
      ...prev,
      [flag]: !prev[flag],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim() || !shortDescription.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    if (!onSubmit) {
      showToast('Job submitted successfully!', 'success');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        short_description: shortDescription,
        skill_tags: selectedSkills,
        accessibility_flags: accessibilityFlags,
        latitude,
        longitude,
        shift_start: shiftStart || undefined,
        shift_end: shiftEnd || undefined,
        image: generatedImage || undefined,
      });
      showToast('Job posted successfully!', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to submit. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Gemini Assist Section */}
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Gemini Assist</h3>
              <p className="text-sm text-gray-600 mb-3">
                Describe what you need help with in one sentence, and AI will fill out the form for you.
              </p>

              {showPromptInput && (
                <div className="mb-3">
                  <textarea
                    value={geminiPrompt}
                    onChange={(e) => setGeminiPrompt(e.target.value)}
                    placeholder="e.g., I need help moving furniture to my new apartment this Saturday"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    rows={2}
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">{geminiPrompt.length}/200 characters</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleGeminiAssist}
                disabled={isEnhancing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-medium rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEnhancing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enhancing...
                  </>
                ) : (
                  <>
                    <span>Gemini Assist</span>
                    <span className="text-lg">✨</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <Input
            label="Job Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Help Moving Furniture"
            maxLength={80}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/80 characters</p>
        </div>

        {/* Short Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Description *</label>
          <textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            placeholder="Brief one-line summary for the job card"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={2}
            maxLength={200}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{shortDescription.length}/200 characters</p>
        </div>

        {/* Full Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Description *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide details about the task, expectations, and any helpful context..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={4}
            required
          />
        </div>

        {/* Generate Image */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">Generate Image</h3>
              <p className="text-sm text-gray-600 mb-3">
                Auto-generate an illustration for your job posting using AI. Fill in the title and short description first.
              </p>

              {generatedImage && (
                <div className="mb-3">
                  <img
                    src={generatedImage}
                    alt="Generated job image"
                    className="w-full max-w-sm rounded-lg border border-gray-200 shadow-sm"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateImage}
                disabled={isGeneratingImage || (!title.trim() && !shortDescription.trim())}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingImage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : generatedImage ? (
                  'Regenerate Image'
                ) : (
                  'Generate Image'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Skill Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Required Skills</label>
          <div className="flex flex-wrap gap-2">
            {SKILL_TAG_OPTIONS.map((skill) => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedSkills.includes(skill)
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* Accessibility Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Physical Requirements
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Check any that apply to help match with suitable volunteers
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'heavy_lifting', label: 'Heavy Lifting Required' },
              { key: 'standing_long', label: 'Extended Standing' },
              { key: 'driving_required', label: 'Driving Required' },
              { key: 'outdoor_work', label: 'Outdoor Work' },
            ].map(({ key, label }) => (
              <label
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  accessibilityFlags[key as keyof AccessibilityFlags]
                    ? 'border-primary bg-primary-light'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={accessibilityFlags[key as keyof AccessibilityFlags]}
                  onChange={() => toggleAccessibilityFlag(key as keyof AccessibilityFlags)}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (!navigator.geolocation) {
                  showToast('Geolocation is not supported by your browser', 'error');
                  setShowManualLocation(true);
                  return;
                }
                setLocationStatus('Getting location...');

                const onSuccess = (pos: GeolocationPosition) => {
                  setLatitude(pos.coords.latitude);
                  setLongitude(pos.coords.longitude);
                  setLocationStatus(`Location set (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
                  showToast('Location set successfully!', 'success');
                };

                const onError = (error: GeolocationPositionError) => {
                  setLocationStatus('');
                  if (error.code === error.PERMISSION_DENIED) {
                    showToast('Location permission denied. Please enable location access in your browser settings, or enter an address below.', 'error');
                    setShowManualLocation(true);
                  } else if (error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT) {
                    // Retry without high accuracy (uses IP/WiFi instead of GPS)
                    navigator.geolocation.getCurrentPosition(
                      onSuccess,
                      () => {
                        setLocationStatus('');
                        showToast('Could not detect location automatically. Please enter an address below.', 'error');
                        setShowManualLocation(true);
                      },
                      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
                    );
                  } else {
                    showToast('Unable to get your location. Please enter an address below.', 'error');
                    setShowManualLocation(true);
                  }
                };

                navigator.geolocation.getCurrentPosition(onSuccess, onError, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 0,
                });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Use My Location
            </button>
            {!showManualLocation && (
              <button
                type="button"
                onClick={() => setShowManualLocation(true)}
                className="text-sm text-primary hover:underline"
              >
                Enter address instead
              </button>
            )}
            {locationStatus && (
              <span className="text-sm text-gray-500">{locationStatus}</span>
            )}
          </div>

          {showManualLocation && (
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="City, ZIP, or address (e.g. East Lansing, MI)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!manualAddress.trim()) {
                    showToast('Please enter an address', 'error');
                    return;
                  }
                  setLocationStatus('Looking up address...');
                  try {
                    const response = await fetch(
                      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress.trim())}&limit=1`,
                      { headers: { 'User-Agent': 'SpartaHack-App' } }
                    );
                    const results = await response.json();
                    if (results.length > 0) {
                      const { lat, lon, display_name } = results[0];
                      setLatitude(parseFloat(lat));
                      setLongitude(parseFloat(lon));
                      setLocationStatus(`Location set: ${display_name.split(',').slice(0, 2).join(',')}`);
                      showToast('Location set from address!', 'success');
                    } else {
                      setLocationStatus('');
                      showToast('Could not find that address. Try a different format.', 'error');
                    }
                  } catch {
                    setLocationStatus('');
                    showToast('Address lookup failed. Please try again.', 'error');
                  }
                }}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium"
              >
                Look Up
              </button>
            </div>
          )}
        </div>

        {/* Shift Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift Start</label>
            <input
              type="datetime-local"
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift End</label>
            <input
              type="datetime-local"
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <Button type="submit" className="w-full py-3" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting...
              </span>
            ) : (
              'Post Job'
            )}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        fieldsToOverwrite={fieldsToOverwrite}
        onConfirm={handleConfirmOverwrite}
        onCancel={handleCancelOverwrite}
      />

      <ToastContainer />
    </>
  );
}
