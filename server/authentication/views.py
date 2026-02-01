import os

from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import UserSerializer, RegisterSerializer, LoginSerializer, AvatarUploadSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = authenticate(
        email=serializer.validated_data['email'],
        password=serializer.validated_data['password'],
    )

    if user is None:
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user, context={'request': request}).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    serializer = UserSerializer(request.user, context={'request': request})
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar(request):
    """Upload or update user's profile picture."""
    serializer = AvatarUploadSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    user = request.user

    # Delete old avatar if exists
    if user.avatar:
        old_path = user.avatar.path
        if os.path.exists(old_path):
            os.remove(old_path)

    # Save new avatar
    user.avatar = serializer.validated_data['avatar']
    user.save(update_fields=['avatar'])

    return Response({
        'message': 'Avatar uploaded successfully',
        'avatar_url': request.build_absolute_uri(user.avatar.url),
    })


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_avatar(request):
    """Remove user's profile picture."""
    user = request.user

    if not user.avatar:
        return Response(
            {'error': 'No avatar to delete'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Delete the file
    if user.avatar.path and os.path.exists(user.avatar.path):
        os.remove(user.avatar.path)

    # Clear the field
    user.avatar = None
    user.save(update_fields=['avatar'])

    return Response({'message': 'Avatar deleted successfully'})
