alter table app.users add column last_nudged_on date;

select app.schedule_job('nudge', '*/15 * * * *');
