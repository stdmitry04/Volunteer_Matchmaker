from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from authentication.models import User
from .models import Job, UserProfile, MatchingInterest
from .serializers import JobMatchSerializer, MatchingInterestSerializer, JobCompletionSerializer
from .scoring import calculate_score
from .badges import compute_badges, record_completion


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def matched_jobs(request):
    radius = float(request.query_params.get('radius', 25))
    limit = int(request.query_params.get('limit', 20))

    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    # Pre-filter: open, active jobs
    jobs = Job.objects.filter(status='open', is_active=True).select_related('poster')

    # Bounding box pre-filter if user has location
    if profile.latitude is not None and profile.longitude is not None:
        lat_delta = radius / 69.0  # ~69 miles per degree latitude
        lon_delta = radius / (69.0 * max(0.1, abs(__import__('math').cos(__import__('math').radians(profile.latitude)))))
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

    # Serialize with injected score/distance
    results = []
    for job, score, distance in scored:
        data = JobMatchSerializer(job).data
        data['score'] = score
        data['distance'] = distance
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

    badges = record_completion(request.user, job, completed=completed)
    return Response({
        'status': 'completed' if completed else 'dropped',
        'job': job.title,
        'badges': badges,
    })
