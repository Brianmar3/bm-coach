package com.bmtraining.app;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BmTimer")
public class BmTimerPlugin extends Plugin {
    @PluginMethod
    public void startTimer(PluginCall call) {
        startOrUpdate(call);
    }

    @PluginMethod
    public void updateTimer(PluginCall call) {
        startOrUpdate(call);
    }

    private void startOrUpdate(PluginCall call) {
        String timerId = call.getString("timerId");
        Long endAt = call.getLong("endAt");
        if (timerId == null || timerId.isBlank() || endAt == null || endAt <= System.currentTimeMillis()) {
            call.reject("timerId and a future endAt are required");
            return;
        }
        Intent intent = BmTimerForegroundService.command(getContext(), BmTimerForegroundService.ACTION_START)
            .putExtra(BmTimerForegroundService.EXTRA_TIMER_ID, timerId)
            .putExtra(BmTimerForegroundService.EXTRA_END_AT, endAt)
            .putExtra(BmTimerForegroundService.EXTRA_TYPE, call.getString("type", "TIMER"))
            .putExtra(BmTimerForegroundService.EXTRA_TITLE, call.getString("title", "BM Training · Temporizador"))
            .putExtra(BmTimerForegroundService.EXTRA_CONTEXT, call.getString("context", "Entrenamiento en curso"))
            .putExtra(BmTimerForegroundService.EXTRA_COMPLETION_TITLE, call.getString("completionTitle", "Tiempo finalizado"))
            .putExtra(BmTimerForegroundService.EXTRA_COMPLETION_BODY, call.getString("completionBody", "Tu temporizador terminó."));
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (RuntimeException error) {
            call.reject("Unable to start the workout timer", error);
        }
    }

    @PluginMethod
    public void stopTimer(PluginCall call) {
        Intent intent = BmTimerForegroundService.command(getContext(), BmTimerForegroundService.ACTION_STOP);
        String timerId = call.getString("timerId");
        if (timerId != null) intent.putExtra(BmTimerForegroundService.EXTRA_TIMER_ID, timerId);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getActiveTimer(PluginCall call) {
        BmTimerForegroundService.ActiveTimer active = BmTimerForegroundService.readActiveTimer(getContext());
        JSObject result = new JSObject();
        result.put("active", active != null && active.endAt > System.currentTimeMillis());
        if (active != null) {
            result.put("timerId", active.timerId);
            result.put("endAt", active.endAt);
            result.put("type", active.type);
            result.put("title", active.title);
            result.put("context", active.context);
            result.put("status", active.endAt > System.currentTimeMillis() ? "running" : "finished");
        }
        call.resolve(result);
    }
}
