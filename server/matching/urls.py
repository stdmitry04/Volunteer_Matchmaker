from django.urls import path

from . import views

urlpatterns = [
    path('jobs', views.matched_jobs, name='matching-jobs'),
    path('interest', views.swipe_interest, name='matching-interest'),
    path('complete', views.complete_job, name='matching-complete'),
    path('users/<int:user_id>/badges', views.user_badges, name='user-badges'),
]
