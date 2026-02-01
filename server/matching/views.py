from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django.utils import timezone

from authentication.models import User
from .models import Job, UserProfile, MatchingInterest, JobAcceptance
from .serializers import (
    JobMatchSerializer, JobDetailSerializer, MatchingInterestSerializer,
    JobCompletionSerializer, JobCreateSerializer, UserProfileSerializer,
    UserProfileFullSerializer, LocationUpdateSerializer, BadgeSerializer,
    JobAcceptanceSerializer, AcceptVolunteerSerializer, InterestedUserSerializer,
)
from .scoring import calculate_score
from .badges import compute_badges, record_completion
from .geocoding import reverse_geocode, forward_geocode


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def matched_jobs(request):
    limit = int(request.query_params.get('limit', 20))

    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    # Use user's max_distance preference, or default to 25
    radius = profile.max_distance_miles or 25

    # Pre-filter: open, active jobs
    jobs = Job.objects.filter(status='open', is_active=True).select_related('poster')

    # Bounding box pre-filter if user has location
    if profile.latitude is not None and profile.longitude is not None:
        import math
        lat_delta = radius / 69.0  # ~69 miles per degree latitude
        lon_delta = radius / (69.0 * max(0.1, abs(math.cos(math.radians(profile.latitude)))))
        jobs = jobs.filter(
            latitude__gte=profile.latitude - lat_delta,
            latitude__lte=profile.latitude + lat_delta,
            longitude__gte=profile.longitude - lon_delta,
            longitude__lte=profile.longitude + lon_delta,
        )

    # Score and rank
    scored = []
    for job in jobs:
        score, distance = calculate_score(profile, job, radius=radius)
        if score > 0:
            scored.append((job, score, distance))

    scored.sort(key=lambda x: x[1], reverse=True)
    scored = scored[:limit]

    # Serialize with injected score/distance (privacy-safe: no raw coords)
    results = []
    for job, score, distance in scored:
        job._distance = distance  # Attach for serializer
        data = JobMatchSerializer(job).data
        data['score'] = score
        data['distance'] = round(distance, 1) if distance else None
        results.append(data)

    return Response(results)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def swipe_interest(request):
    serializer = MatchingInterestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    job_id = serializer.validated_data['job_id']
    interested = serializer.validated_data['interested']

    try:
        job = Job.objects.get(id=job_id, status='open', is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    interest, created = MatchingInterest.objects.update_or_create(
        user=request.user,
        job=job,
        defaults={'interested': interested},
    )

    # If user expressed interest (swiped right), create a pending JobAcceptance
    if interested:
        JobAcceptance.objects.get_or_create(
            user=request.user,
            job=job,
            defaults={'status': 'pending'},
        )

    action = 'interested in' if interested else 'passed on'
    return Response({
        'status': f'You {action} "{job.title}"',
        'created': created,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_badges(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    badges = compute_badges(user)
    return Response({
        'user_id': str(user.id),
        'username': user.username,
        'badges': badges,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_job(request):
    serializer = JobCompletionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    job_id = serializer.validated_data['job_id']
    completed = serializer.validated_data.get('completed', True)

    try:
        job = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    # Update JobAcceptance status for this user
    new_status = 'completed' if completed else 'dropped'
    try:
        acceptance = JobAcceptance.objects.get(
            job=job,
            user=request.user,
            is_active=True,
        )
        acceptance.status = new_status
        acceptance.save(update_fields=['status'])
    except JobAcceptance.DoesNotExist:
        pass  # User wasn't the volunteer, just record for badges

    # If poster is marking the job complete, update job status too
    if job.poster == request.user:
        job.status = 'completed'
        job.save(update_fields=['status'])

    badges = record_completion(request.user, job, completed=completed)
    return Response({
        'status': new_status,
        'job': job.title,
        'badges': badges,
    })


# ── Job CRUD ──────────────────────────────────────────────────────────────────

def _accessibility_flags_to_requirements(flags):
    """Convert {heavy_lifting: true, ...} dict to ['heavy_lifting', ...] list."""
    if not flags or not isinstance(flags, dict):
        return []
    return [key for key, val in flags.items() if val]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_job(request):
    serializer = JobCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    lat = data.get('latitude', 0.0)
    lng = data.get('longitude', 0.0)

    # Reverse geocode to get location label
    location_label = ''
    if lat and lng:
        location_label = reverse_geocode(lat, lng)

    defaults = {
        'title': data['title'],
        'description': data['description'],
        'short_description': data['short_description'],
        'poster': request.user,
        'skill_tags': data.get('skill_tags', []),
        'accessibility_requirements': _accessibility_flags_to_requirements(data.get('accessibility_flags', {})),
        'latitude': lat,
        'longitude': lng,
        'location_label': location_label,
    }

    if data.get('shift_start'):
        defaults['shift_start'] = data['shift_start']
    else:
        defaults['shift_start'] = timezone.now() + timezone.timedelta(hours=24)

    if data.get('shift_end'):
        defaults['shift_end'] = data['shift_end']
    else:
        defaults['shift_end'] = defaults['shift_start'] + timezone.timedelta(hours=2)

    job = Job.objects.create(**defaults)
    return Response(JobDetailSerializer(job).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_posted_jobs(request):
    jobs = Job.objects.filter(poster=request.user, is_active=True).select_related('poster')
    data = JobMatchSerializer(jobs, many=True).data
    return Response(data)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_job(request, job_id):
    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    if job.poster != request.user:
        return Response({'error': 'Only the poster can update this job.'}, status=status.HTTP_403_FORBIDDEN)

    allowed_fields = ['title', 'description', 'short_description', 'skill_tags', 'latitude', 'longitude', 'shift_start', 'shift_end', 'status']
    for field in allowed_fields:
        if field in request.data:
            setattr(job, field, request.data[field])

    if 'accessibility_flags' in request.data:
        job.accessibility_requirements = _accessibility_flags_to_requirements(request.data['accessibility_flags'])

    job.save()
    return Response(JobMatchSerializer(job).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_job(request, job_id):
    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    if job.poster != request.user:
        return Response({'error': 'Only the poster can delete this job.'}, status=status.HTTP_403_FORBIDDEN)

    job.is_active = False
    job.save()
    return Response({'status': 'Job deleted.'}, status=status.HTTP_200_OK)


# ── Profile ───────────────────────────────────────────────────────────────────

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def get_or_update_profile(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        from authentication.serializers import UserSerializer
        badges = compute_badges(request.user)
        return Response({
            'user': UserSerializer(request.user, context={'request': request}).data,
            'profile': UserProfileFullSerializer(profile).data,
            'badges': badges,
        })

    # PUT / PATCH - update skills, limitations, max_distance
    allowed_fields = ['skill_tags', 'limitations', 'max_distance_miles']
    update_data = {k: v for k, v in request.data.items() if k in allowed_fields}

    serializer = UserProfileFullSerializer(profile, data=update_data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    from authentication.serializers import UserSerializer
    badges = compute_badges(request.user)
    return Response({
        'user': UserSerializer(request.user, context={'request': request}).data,
        'profile': UserProfileFullSerializer(profile).data,
        'badges': badges,
    })


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def update_location(request):
    """
    GET: Return current location info
    PUT: Update location (GPS or manual)
    """
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'GET':
        return Response({
            'location_source': profile.location_source,
            'location_label': profile.location_label,
            'display_location': profile.display_location,
            'max_distance_miles': profile.max_distance_miles,
            'has_location': profile.latitude is not None,
            'last_updated': profile.last_location_update,
        })

    # PUT - Update location
    serializer = LocationUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data

    source = data.get('location_source', 'gps')
    profile.location_source = source

    if source == 'manual' and data.get('manual_location'):
        # Forward geocode the manual location
        result = forward_geocode(data['manual_location'])
        if result:
            lat, lng, label = result
            profile.latitude = lat
            profile.longitude = lng
            profile.location_label = label
        else:
            return Response(
                {'error': 'Could not find that location. Try a city name or ZIP code.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    else:
        # GPS coordinates provided
        profile.latitude = data.get('latitude')
        profile.longitude = data.get('longitude')
        # Reverse geocode to get label
        if profile.latitude and profile.longitude:
            profile.location_label = reverse_geocode(profile.latitude, profile.longitude)

    if 'max_distance_miles' in data:
        profile.max_distance_miles = data['max_distance_miles']

    profile.last_location_update = timezone.now()
    profile.save()

    return Response({
        'location_source': profile.location_source,
        'location_label': profile.location_label,
        'display_location': profile.display_location,
        'max_distance_miles': profile.max_distance_miles,
        'has_location': True,
        'last_updated': profile.last_location_update,
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def revoke_location(request):
    """Remove location data (user revoking permission)."""
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    profile.latitude = None
    profile.longitude = None
    profile.location_label = ''
    profile.location_source = 'manual'
    profile.last_location_update = None
    profile.save()

    return Response({
        'message': 'Location data removed',
        'has_location': False,
    })


# ── Job Acceptance ────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_volunteer(request, job_id):
    """Poster confirms a volunteer who has expressed interest (pending -> confirmed)."""
    serializer = AcceptVolunteerSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    if job.poster != request.user:
        return Response({'error': 'Only the poster can confirm volunteers.'}, status=status.HTTP_403_FORBIDDEN)

    volunteer_id = serializer.validated_data['user_id']
    try:
        volunteer = User.objects.get(id=volunteer_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Find the pending acceptance (created when volunteer swiped right)
    try:
        acceptance = JobAcceptance.objects.get(user=volunteer, job=job)
    except JobAcceptance.DoesNotExist:
        return Response({'error': 'User has not expressed interest in this job.'}, status=status.HTTP_400_BAD_REQUEST)

    if acceptance.status not in ('pending', 'accepted'):
        return Response({'error': f'Cannot confirm volunteer with status: {acceptance.status}'}, status=status.HTTP_400_BAD_REQUEST)

    # Update status to confirmed
    acceptance.status = 'confirmed'
    acceptance.save()

    # Auto-create conversation for chat
    try:
        from chat.models import Conversation
        Conversation.objects.get_or_create(
            job=job,
            volunteer=volunteer,
            defaults={'poster': request.user}
        )
    except ImportError:
        pass  # Chat app not installed yet

    return Response(JobAcceptanceSerializer(acceptance).data)


# Keep accept_volunteer as alias for backwards compatibility
def accept_volunteer(request, job_id):
    return confirm_volunteer(request, job_id)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_accepted_jobs(request):
    acceptances = JobAcceptance.objects.filter(
        user=request.user, is_active=True,
    ).select_related('job', 'job__poster')
    data = JobAcceptanceSerializer(acceptances, many=True).data
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def job_interested_users(request, job_id):
    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    if job.poster != request.user:
        return Response({'error': 'Only the poster can view interested users.'}, status=status.HTTP_403_FORBIDDEN)

    interests = MatchingInterest.objects.filter(
        job=job, interested=True,
    ).select_related('user')
    data = InterestedUserSerializer(interests, many=True).data
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_interested_jobs(request):
    interests = MatchingInterest.objects.filter(
        user=request.user, interested=True,
    ).select_related('job', 'job__poster')
    jobs = [i.job for i in interests]
    data = JobMatchSerializer(jobs, many=True).data
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def retract_application(request, job_id):
    """Volunteer retracts their application for a job."""
    try:
        job = Job.objects.get(id=job_id, is_active=True)
    except Job.DoesNotExist:
        return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)

    # Find and delete the JobAcceptance
    try:
        acceptance = JobAcceptance.objects.get(user=request.user, job=job)
    except JobAcceptance.DoesNotExist:
        return Response({'error': 'You have not applied to this job.'}, status=status.HTTP_400_BAD_REQUEST)

    # Only allow retraction if status is pending or confirmed (not completed/in_progress)
    if acceptance.status in ('completed', 'in_progress'):
        return Response(
            {'error': 'Cannot retract from a job that is in progress or completed.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete the acceptance
    acceptance.delete()

    # Also update the MatchingInterest to not interested
    MatchingInterest.objects.filter(user=request.user, job=job).update(interested=False)

    return Response({
        'status': 'Application retracted',
        'job_id': str(job_id),
        'job_title': job.title,
    })
