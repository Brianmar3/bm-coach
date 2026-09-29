package com.bmtraining.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

public class BmTimerForegroundService extends Service {
    public static final String ACTION_START = "com.bmtraining.app.timer.START";
    public static final String ACTION_STOP = "com.bmtraining.app.timer.STOP";
    public static final String ACTION_FINISH = "com.bmtraining.app.timer.FINISH";
    public static final String EXTRA_TIMER_ID = "timerId";
    public static final String EXTRA_END_AT = "endAt";
    public static final String EXTRA_TYPE = "type";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_CONTEXT = "context";
    public static final String EXTRA_COMPLETION_TITLE = "completionTitle";
    public static final String EXTRA_COMPLETION_BODY = "completionBody";

    private static final String PREFS = "bm_training_active_timer";
    private static final String CHANNEL_ID = "bm_training_active_timer_v1";
    private static final int NOTIFICATION_ID = 78101;
    private static final int ALARM_REQUEST_CODE = 78102;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable finishRunnable;

    public static Intent command(Context context, String action) {
        return new Intent(context, BmTimerForegroundService.class).setAction(action);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTimer(intent.getStringExtra(EXTRA_TIMER_ID));
            return START_NOT_STICKY;
        }
        if (ACTION_FINISH.equals(action)) {
            finishTimer(intent.getStringExtra(EXTRA_TIMER_ID), intent.getLongExtra(EXTRA_END_AT, 0L));
            return START_NOT_STICKY;
        }
        if (ACTION_START.equals(action)) {
            ActiveTimer timer = ActiveTimer.fromIntent(intent);
            if (timer != null) startTimer(timer);
            else stopSelf();
            return START_STICKY;
        }
        ActiveTimer restored = readActiveTimer(this);
        if (restored == null) {
            stopSelf();
        } else if (restored.endAt <= System.currentTimeMillis()) {
            startForeground(restored);
            finishTimer(restored.timerId, restored.endAt);
        } else {
            startTimer(restored);
        }
        return START_STICKY;
    }

    private void startTimer(ActiveTimer timer) {
        persist(timer);
        startForeground(timer);
        scheduleCompletion(timer);
    }

    private void startForeground(ActiveTimer timer) {
        int serviceType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, ongoingNotification(timer), serviceType);
    }

    private Notification ongoingNotification(ActiveTimer timer) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.bmtraining.app.R.drawable.ic_stat_bm_notification)
            .setContentTitle(timer.title)
            .setContentText(timer.context)
            .setContentIntent(openAppIntent())
            .setWhen(timer.endAt)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build();
    }

    private Notification completedNotification(ActiveTimer timer) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(com.bmtraining.app.R.drawable.ic_stat_bm_notification)
            .setContentTitle(timer.completionTitle)
            .setContentText(timer.completionBody)
            .setContentIntent(openAppIntent())
            .setAutoCancel(true)
            .setOnlyAlertOnce(false)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build();
    }

    private PendingIntent openAppIntent() {
        Intent open = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void scheduleCompletion(ActiveTimer timer) {
        cancelScheduledCompletion();
        long delay = Math.max(0L, timer.endAt - System.currentTimeMillis());
        finishRunnable = () -> finishTimer(timer.timerId, timer.endAt);
        handler.postDelayed(finishRunnable, delay);

        AlarmManager alarmManager = (AlarmManager) getSystemService(ALARM_SERVICE);
        PendingIntent alarmIntent = alarmIntent(timer);
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timer.endAt, alarmIntent);
            } else {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timer.endAt, alarmIntent);
            }
        } catch (SecurityException denied) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timer.endAt, alarmIntent);
        }
    }

    private PendingIntent alarmIntent(ActiveTimer timer) {
        Intent alarm = new Intent(this, BmTimerAlarmReceiver.class)
            .putExtra(EXTRA_TIMER_ID, timer.timerId)
            .putExtra(EXTRA_END_AT, timer.endAt);
        return PendingIntent.getBroadcast(this, ALARM_REQUEST_CODE, alarm, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void finishTimer(String timerId, long endAt) {
        ActiveTimer active = readActiveTimer(this);
        if (active == null || timerId == null || !active.timerId.equals(timerId) || (endAt > 0L && active.endAt != endAt)) {
            stopSelf();
            return;
        }
        startForeground(active);
        cancelScheduledCompletion();
        clearActiveTimer(this);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        if (!MainActivity.isVisible()) {
            try {
                NotificationManagerCompat.from(this).notify(NOTIFICATION_ID, completedNotification(active));
            } catch (SecurityException ignored) {
                // Android 13+ may deny notification display; timer cleanup must still succeed.
            }
        }
        stopSelf();
    }

    private void stopTimer(@Nullable String timerId) {
        ActiveTimer active = readActiveTimer(this);
        if (active != null && timerId != null && !active.timerId.equals(timerId)) return;
        cancelScheduledCompletion();
        clearActiveTimer(this);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        NotificationManagerCompat.from(this).cancel(NOTIFICATION_ID);
        stopSelf();
    }

    private void cancelScheduledCompletion() {
        if (finishRunnable != null) handler.removeCallbacks(finishRunnable);
        finishRunnable = null;
        AlarmManager alarmManager = (AlarmManager) getSystemService(ALARM_SERVICE);
        PendingIntent pending = PendingIntent.getBroadcast(this, ALARM_REQUEST_CODE, new Intent(this, BmTimerAlarmReceiver.class), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (pending != null) alarmManager.cancel(pending);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Temporizador activo", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Cuenta regresiva y aviso final de los temporizadores de entrenamiento.");
        channel.enableVibration(true);
        channel.enableLights(true);
        ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(channel);
    }

    private void persist(ActiveTimer timer) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString(EXTRA_TIMER_ID, timer.timerId).putLong(EXTRA_END_AT, timer.endAt)
            .putString(EXTRA_TYPE, timer.type).putString(EXTRA_TITLE, timer.title)
            .putString(EXTRA_CONTEXT, timer.context).putString(EXTRA_COMPLETION_TITLE, timer.completionTitle)
            .putString(EXTRA_COMPLETION_BODY, timer.completionBody).apply();
    }

    public static ActiveTimer readActiveTimer(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, MODE_PRIVATE);
        String timerId = prefs.getString(EXTRA_TIMER_ID, null);
        long endAt = prefs.getLong(EXTRA_END_AT, 0L);
        return timerId == null || endAt <= 0L ? null : new ActiveTimer(timerId, endAt,
            prefs.getString(EXTRA_TYPE, "TIMER"), prefs.getString(EXTRA_TITLE, "BM Training · Temporizador"),
            prefs.getString(EXTRA_CONTEXT, "Entrenamiento en curso"), prefs.getString(EXTRA_COMPLETION_TITLE, "Tiempo finalizado"),
            prefs.getString(EXTRA_COMPLETION_BODY, "Tu temporizador terminó."));
    }

    private static void clearActiveTimer(Context context) {
        context.getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        if (finishRunnable != null) handler.removeCallbacks(finishRunnable);
        super.onDestroy();
    }

    public static final class ActiveTimer {
        final String timerId;
        final long endAt;
        final String type;
        final String title;
        final String context;
        final String completionTitle;
        final String completionBody;

        ActiveTimer(String timerId, long endAt, String type, String title, String context, String completionTitle, String completionBody) {
            this.timerId = timerId; this.endAt = endAt; this.type = type; this.title = title; this.context = context;
            this.completionTitle = completionTitle; this.completionBody = completionBody;
        }

        static ActiveTimer fromIntent(Intent intent) {
            String timerId = intent.getStringExtra(EXTRA_TIMER_ID);
            long endAt = intent.getLongExtra(EXTRA_END_AT, 0L);
            if (timerId == null || timerId.isBlank() || endAt <= System.currentTimeMillis()) return null;
            return new ActiveTimer(timerId, endAt, intent.getStringExtra(EXTRA_TYPE), intent.getStringExtra(EXTRA_TITLE),
                intent.getStringExtra(EXTRA_CONTEXT), intent.getStringExtra(EXTRA_COMPLETION_TITLE), intent.getStringExtra(EXTRA_COMPLETION_BODY));
        }
    }
}
