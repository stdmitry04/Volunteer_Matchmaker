from rest_framework import serializers

from .models import Job, UserProfile, MatchingInterest, JobAcceptance
from .geocoding import format_distance


class JobMatchSerializer(serializers.ModelSerializer):
    """Job serializer that hides exact coordinates for privacy."""
    is_urgent = serializers.BooleanField(read_only=True)
    distance = serializers.FloatField(read_only=True)
    distance_display = serializers.SerializerMethodField()
    score = serializers.FloatField(read_only=True)
    poster_username = serializers.CharField(source='poster.username', read_only=True)
    location_label = serializers.CharField(read_only=True)

    class Meta:
        model = Job
        fields = [
            'id', 'title', 'short_description', 'description',
            'skill_tags', 'location_label',
            'shift_start', 'shift_end', 'is_urgent',
            'distance', 'distance_display', 'score', 'poster_username',
            'accessibility_requirements', 'status', 'image',
        ]
        # Note: latitude/longitude removed from fields for privacy

    def get_distance_display(self, obj):
        """Return formatted distance string."""
        distance = getattr(obj, '_distance', None)
        if distance is not None:
            return format_distance(distance)
        return None


class JobDetailSerializer(serializers.ModelSerializer):
    """Full job serializer for job owners (includes coordinates)."""
    is_urgent = serializers.BooleanField(read_only=True)
    poster_username = serializers.CharField(source='poster.username', read_only=True)

    class Meta:
        model = Job
        fields = [
            'id', 'title', 'short_description', 'description',
            'skill_tags', 'latitude', 'longitude', 'location_label',
            'shift_start', 'shift_end', 'is_urgent',
            'poster_username', 'accessibility_requirements', 'status', 'image',
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    """Profile serializer that hides exact coordinates for privacy."""
    display_location = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'location_source', 'location_label', 'display_location',
            'max_distance_miles', 'skill_tags', 'limitations',
        ]
        # Note: latitude/longitude hidden for privacy; use LocationUpdateSerializer to update


class UserProfileFullSerializer(serializers.ModelSerializer):
    """Full profile serializer for the user themselves (includes coordinates)."""
    display_location = serializers.CharField(read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'latitude', 'longitude', 'location_source', 'location_label',
            'display_location', 'max_distance_miles', 'skill_tags', 'limitations',
        ]
        read_only_fields = ['display_location']


class LocationUpdateSerializer(serializers.Serializer):
    """Serializer for updating user location."""
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    location_source = serializers.ChoiceField(
        choices=['gps', 'manual'],
        required=False,
        default='gps'
    )
    manual_location = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
        help_text="City, ZIP, or address for manual location"
    )
    max_distance_miles = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=100,
        default=25
    )

    def validate(self, data):
        source = data.get('location_source', 'gps')
        if source == 'gps':
            if data.get('latitude') is None or data.get('longitude') is None:
                raise serializers.ValidationError(
                    "latitude and longitude required for GPS location"
                )
        elif source == 'manual':
            if not data.get('manual_location') and not (data.get('latitude') and data.get('longitude')):
                raise serializers.ValidationError(
                    "manual_location or coordinates required for manual location"
                )
        return data


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


class JobCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField()
    short_description = serializers.CharField(max_length=200)
    skill_tags = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    accessibility_flags = serializers.DictField(required=False, default=dict)
    latitude = serializers.FloatField(required=False, allow_null=True, default=None)
    longitude = serializers.FloatField(required=False, allow_null=True, default=None)
    shift_start = serializers.DateTimeField(required=False, allow_null=True, default=None)
    shift_end = serializers.DateTimeField(required=False, allow_null=True, default=None)
    image = serializers.CharField(max_length=500, required=False, default='')

    def validate(self, data):
        if data.get('shift_start') and data.get('shift_end'):
            if data['shift_end'] <= data['shift_start']:
                raise serializers.ValidationError('shift_end must be after shift_start.')
        return data


class JobAcceptanceSerializer(serializers.ModelSerializer):
    job = JobMatchSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = JobAcceptance
        fields = ['id', 'job', 'username', 'status', 'created_at']


class AcceptVolunteerSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class InterestedUserSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(source='user.id')
    username = serializers.CharField(source='user.username')
    email = serializers.EmailField(source='user.email')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    interested_at = serializers.DateTimeField(source='created_at')
