from django.utils import timezone

from .models import Badge, JobCompletion, UserProfile

# Thresholds: list of (count_needed, level)
# Level 1=Bronze, 2=Silver, 3=Gold
TRACKS = {
    'specialist': {
        'thresholds': [1, 5, 15],
        'description': 'Complete skill-tagged jobs',
    },
    'firefighter': {
        'thresholds': [1, 5, 10],
        'description': 'Fill urgent jobs (under 24h)',
    },
    'anchor': {
        'thresholds': [1, 3, 6],  # months active
        'description': 'Months of active participation',
    },
    'inclusionist': {
        'thresholds': [1, 5, 5],  # Gold at 5 with special title
        'description': 'Complete jobs with accessibility requirements',
    },
}


def _level_from_count(count, thresholds):
    """Return (level, progress_count) based on thresholds."""
    level = 0
    for i, threshold in enumerate(thresholds):
        if count >= threshold:
            level = i + 1
        else:
            break
    return level


def _months_active(user):
    """Calculate months since user joined."""
    delta = timezone.now() - user.date_joined
    return delta.days / 30.0


def compute_badges(user):
    """Recompute all 4 badge tracks for a user. Returns list of badge dicts."""
    completions = JobCompletion.objects.filter(user=user, completed=True)

    # Specialist: completed jobs that had skill tags
    specialist_count = completions.filter(
        skill_tags_snapshot__isnull=False,
    ).exclude(skill_tags_snapshot=[]).count()

    # Firefighter: completed urgent jobs
    firefighter_count = completions.filter(was_urgent=True).count()

    # Anchor: months active
    anchor_count = _months_active(user)

    # Inclusionist: completed jobs with accessibility requirements
    inclusionist_count = completions.filter(had_accessibility=True).count()

    counts = {
        'specialist': specialist_count,
        'firefighter': firefighter_count,
        'anchor': anchor_count,
        'inclusionist': inclusionist_count,
    }

    results = []
    for track, config in TRACKS.items():
        count = counts[track]
        level = _level_from_count(count, config['thresholds'])

        title = ''
        if track == 'inclusionist' and level == 3:
            title = 'Accessibility Champion'

        # Next level info
        if level < 3:
            next_threshold = config['thresholds'][level]
        else:
            next_threshold = config['thresholds'][-1]

        badge, _ = Badge.objects.update_or_create(
            user=user,
            track=track,
            defaults={
                'level': level,
                'progress': int(count),
                'title': title,
            },
        )

        results.append({
            'track': track,
            'level': level,
            'level_name': badge.get_level_display(),
            'progress': int(count),
            'next_threshold': next_threshold if level < 3 else None,
            'title': title,
            'description': config['description'],
        })

    # Update UserProfile reliability stats
    total_completed = completions.count()
    total_dropped = JobCompletion.objects.filter(user=user, completed=False).count()
    UserProfile.objects.update_or_create(
        user=user,
        defaults={
            'jobs_completed': total_completed,
            'jobs_dropped': total_dropped,
        },
    )

    return results


def record_completion(user, job, completed=True):
    """Record a job completion/drop and recompute badges."""
    JobCompletion.objects.update_or_create(
        user=user,
        job=job,
        defaults={
            'completed': completed,
            'was_urgent': job.urgency_hours <= 24,
            'had_accessibility': bool(job.accessibility_requirements),
            'skill_tags_snapshot': job.skill_tags or [],
        },
    )
    return compute_badges(user)
