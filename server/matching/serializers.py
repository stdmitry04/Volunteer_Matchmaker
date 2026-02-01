from rest_framework import serializers

from .models import Job, UserProfile, MatchingInterest


class JobMatchSerializer(serializers.ModelSerializer):
    is_urgent = serializers.BooleanField(read_only=True)
    distance = serializers.FloatField(read_only=True)
    score = serializers.FloatField(read_only=True)
    poster_username = serializers.CharField(source='poster.username', read_only=True)

    class Meta:
        model = Job
        fields = [
            'id', 'title', 'short_description', 'description',
            'skill_tags', 'latitude', 'longitude',
            'shift_start', 'shift_end', 'is_urgent',
            'distance', 'score', 'poster_username',
            'accessibility_requirements', 'status',
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['latitude', 'longitude', 'skill_tags', 'limitations']


class BadgeSerializer(serializers.Serializer):
    track = serializers.CharField()
    level = serializers.IntegerField()
    level_name = serializers.CharField()
    progress = serializers.IntegerField()
    next_threshold = serializers.IntegerField(allow_null=True)
    title = serializers.CharField(allow_blank=True)
    description = serializers.CharField()


class JobCompletionSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()
    completed = serializers.BooleanField(default=True)


class MatchingInterestSerializer(serializers.Serializer):
    job_id = serializers.UUIDField()
    interested = serializers.BooleanField()
