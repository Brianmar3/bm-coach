package com.bmtraining.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

public class BmTimerAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intent finish = BmTimerForegroundService.command(context, BmTimerForegroundService.ACTION_FINISH)
            .putExtra(BmTimerForegroundService.EXTRA_TIMER_ID, intent.getStringExtra(BmTimerForegroundService.EXTRA_TIMER_ID))
            .putExtra(BmTimerForegroundService.EXTRA_END_AT, intent.getLongExtra(BmTimerForegroundService.EXTRA_END_AT, 0L));
        ContextCompat.startForegroundService(context, finish);
    }
}
