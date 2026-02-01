from django.contrib import admin

from .models import Job, UserProfile, MatchingInterest, Badge, JobCompletion

admin.site.register(Job)
admin.site.register(UserProfile)
admin.site.register(MatchingInterest)
admin.site.register(Badge)
admin.site.register(JobCompletion)
