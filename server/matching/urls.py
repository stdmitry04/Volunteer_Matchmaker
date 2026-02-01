from django.urls import path

from . import views

urlpatterns = [
    # Matching
    path('jobs', views.matched_jobs, name='matching-jobs'),
    path('interest', views.swipe_interest, name='matching-interest'),
    path('complete', views.complete_job, name='matching-complete'),
    path('users/<int:user_id>/badges', views.user_badges, name='user-badges'),

    # Job CRUD
    path('jobs/create', views.create_job, name='job-create'),
    path('jobs/my-posted', views.my_posted_jobs, name='my-posted-jobs'),
    path('jobs/<uuid:job_id>/update', views.update_job, name='job-update'),
    path('jobs/<uuid:job_id>/delete', views.delete_job, name='job-delete'),

    # Acceptance
    path('jobs/accepted', views.my_accepted_jobs, name='my-accepted-jobs'),
    path('jobs/interested', views.my_interested_jobs, name='my-interested-jobs'),
    path('jobs/<uuid:job_id>/accept', views.confirm_volunteer, name='accept-volunteer'),  # Legacy name
    path('jobs/<uuid:job_id>/confirm', views.confirm_volunteer, name='confirm-volunteer'),
    path('jobs/<uuid:job_id>/retract', views.retract_application, name='retract-application'),
    path('jobs/<uuid:job_id>/interested', views.job_interested_users, name='job-interested-users'),

    # Profile
    path('profile', views.get_or_update_profile, name='profile'),

    # Location (privacy-preserving)
    path('location', views.update_location, name='location'),
    path('location/revoke', views.revoke_location, name='revoke-location'),
]
