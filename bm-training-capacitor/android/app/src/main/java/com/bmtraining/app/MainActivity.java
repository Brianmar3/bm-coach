package com.bmtraining.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String INTERNAL_HOST = "bm-training-app.vercel.app";
    private volatile boolean firstPageVisible = false;
    private long splashDeadline;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        splashDeadline = System.currentTimeMillis() + 10000L;
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(
            () -> !firstPageVisible && System.currentTimeMillis() < splashDeadline
        );

        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                firstPageVisible = true;
            }

            @Override
            public void onReceivedError(WebView view) {
                firstPageVisible = true;
            }
        });

        super.onCreate(savedInstanceState);
        if (bridge == null) return;

        WebView webView = bridge.getWebView();
        webView.setBackgroundColor(0xff000000);
        WebSettings settings = webView.getSettings();
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) ->
            downloadHttpsResource(url, userAgent, contentDisposition, mimeType)
        );

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                    return;
                }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    private void downloadHttpsResource(
        String url,
        String userAgent,
        String contentDisposition,
        String mimeType
    ) {
        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !INTERNAL_HOST.equalsIgnoreCase(uri.getHost())) {
            Toast.makeText(this, "La descarga no es compatible dentro de BM Training.", Toast.LENGTH_LONG).show();
            return;
        }

        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri)
                .setTitle(fileName)
                .setMimeType(mimeType)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName);
            if (userAgent != null && !userAgent.isBlank()) request.addRequestHeader("User-Agent", userAgent);
            String cookieHeader = CookieManager.getInstance().getCookie(url);
            if (cookieHeader != null && !cookieHeader.isBlank()) request.addRequestHeader("Cookie", cookieHeader);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, "Descarga iniciada.", Toast.LENGTH_SHORT).show();
        } catch (RuntimeException error) {
            Toast.makeText(this, "No se pudo iniciar la descarga.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onPause() {
        CookieManager.getInstance().flush();
        super.onPause();
    }
}
