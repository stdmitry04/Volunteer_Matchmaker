from django.contrib.auth.models import AbstractUser
from django.db import models

from core.models import BaseModel


def avatar_upload_path(instance, filename):
    """Generate upload path for user avatars."""
    ext = filename.split('.')[-1]
    return f'avatars/{instance.id}.{ext}'


class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.ImageField(
        upload_to=avatar_upload_path,
        null=True,
        blank=True,
        help_text='Profile picture'
    )

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email

    @property
    def avatar_url(self):
        """Return avatar URL or None."""
        if self.avatar:
            return self.avatar.url
        return None


class EmailVerification(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='verifications')
    token = models.CharField(max_length=255)
    is_verified = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.user.email} - {'Verified' if self.is_verified else 'Pending'}"
