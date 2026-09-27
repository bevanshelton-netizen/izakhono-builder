package za.co.izakhono.nav;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int REQ_LOCATION = 4101;
    private static final int REQ_AUDIO = 4102;

    private WebView webView;
    private TextToSpeech tts;
    private LocationManager locationManager;
    private SpeechRecognizer speechRecognizer;
    private String pendingSpeechLocale = "en-ZA";
    private boolean pendingNativeLocationStart = false;
    private GeolocationPermissions.Callback pendingGeoCallback;
    private String pendingGeoOrigin;

    private final LocationListener locationListener = new LocationListener() {
        @Override public void onLocationChanged(Location location) {
            JSONObject detail = new JSONObject();
            try {
                detail.put("lat", location.getLatitude());
                detail.put("lng", location.getLongitude());
                detail.put("accuracy", location.hasAccuracy() ? location.getAccuracy() : 0);
                detail.put("speed", location.hasSpeed() ? location.getSpeed() : 0);
                detail.put("heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            } catch (Exception ignored) {}
            dispatchEvent("izakhono-native-location", detail);
        }
    };

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        tts = new TextToSpeech(this, status -> {});

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        webView.addJavascriptInterface(new VoiceBridge(), "IzakhonoNativeVoice");
        webView.addJavascriptInterface(new LocationBridge(), "IzakhonoNativeLocation");
        webView.addJavascriptInterface(new SpeechBridge(), "IzakhonoNativeSpeech");
        webView.addJavascriptInterface(new ShareBridge(), "IzakhonoNativeShare");
        webView.addJavascriptInterface(new WakeBridge(), "IzakhonoNativeWake");

        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl()));
                } catch (Exception ignored) {}
                return true;
            }

            @Override public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectBootstrap();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(
                    String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    requestPermissions(new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    }, REQ_LOCATION);
                }
            }

            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(request::deny);
            }
        });

        requestLocationIfNeeded();
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void injectBootstrap() {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                getAssets().open("native-bootstrap.js"), StandardCharsets.UTF_8))) {
            StringBuilder js = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) js.append(line).append('\n');
            webView.evaluateJavascript(js.toString(), null);
        } catch (Exception ignored) {}
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private void requestLocationIfNeeded() {
        if (!hasLocationPermission()) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            }, REQ_LOCATION);
        }
    }

    private void startNativeLocation() {
        if (!hasLocationPermission()) {
            pendingNativeLocationStart = true;
            requestLocationIfNeeded();
            return;
        }
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 1f, locationListener, Looper.getMainLooper());
        } catch (Exception ignored) {}
        try {
            locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 1500L, 1f, locationListener, Looper.getMainLooper());
        } catch (Exception ignored) {}
    }

    private void stopNativeLocation() {
        try { locationManager.removeUpdates(locationListener); } catch (Exception ignored) {}
    }

    private void dispatchEvent(String name, JSONObject detail) {
        String js = "window.dispatchEvent(new CustomEvent(" + JSONObject.quote(name)
                + ",{detail:" + detail.toString() + "}));";
        runOnUiThread(() -> webView.evaluateJavascript(js, null));
    }

    private void startSpeech(String localeTag) {
        pendingSpeechLocale = (localeTag == null || localeTag.isBlank()) ? "en-ZA" : localeTag;
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_AUDIO);
            return;
        }

        runOnUiThread(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) {
                speechError("Speech recognition is unavailable on this phone.");
                return;
            }

            if (speechRecognizer != null) {
                try { speechRecognizer.destroy(); } catch (Exception ignored) {}
            }

            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
            speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rmsdB) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onError(int error) { speechError("Voice search could not understand that. Please try again."); }
                @Override public void onResults(Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        JSONObject detail = new JSONObject();
                        try { detail.put("text", matches.get(0)); } catch (Exception ignored) {}
                        dispatchEvent("izakhono-native-speech-result", detail);
                    }
                }
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
            });

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, pendingSpeechLocale);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            speechRecognizer.startListening(intent);
        });
    }

    private void speechError(String message) {
        JSONObject detail = new JSONObject();
        try { detail.put("message", message); } catch (Exception ignored) {}
        dispatchEvent("izakhono-native-speech-error", detail);
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == REQ_LOCATION) {
            boolean granted = hasLocationPermission();
            if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                pendingGeoCallback.invoke(pendingGeoOrigin, granted, false);
                pendingGeoCallback = null;
                pendingGeoOrigin = null;
            }
            if (granted && pendingNativeLocationStart) {
                pendingNativeLocationStart = false;
                startNativeLocation();
            }
        } else if (requestCode == REQ_AUDIO) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startSpeech(pendingSpeechLocale);
            } else {
                speechError("Microphone permission is required for voice destination search.");
            }
        }
    }

    @Override protected void onDestroy() {
        stopNativeLocation();
        if (speechRecognizer != null) {
            try { speechRecognizer.destroy(); } catch (Exception ignored) {}
        }
        if (tts != null) {
            try { tts.stop(); tts.shutdown(); } catch (Exception ignored) {}
        }
        if (webView != null) {
            try { webView.destroy(); } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public class VoiceBridge {
        @JavascriptInterface public void speak(String text, double rate, String localeTag) {
            if (text == null || text.isBlank() || tts == null) return;
            runOnUiThread(() -> {
                Locale locale = (localeTag == null || localeTag.isBlank())
                        ? Locale.getDefault() : Locale.forLanguageTag(localeTag);
                tts.setLanguage(locale);
                tts.setSpeechRate((float)Math.max(0.5, Math.min(1.5, rate)));
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "izakhono-nav");
            });
        }
    }

    public class LocationBridge {
        @JavascriptInterface public void start() { runOnUiThread(MainActivity.this::startNativeLocation); }
        @JavascriptInterface public void stop() { runOnUiThread(MainActivity.this::stopNativeLocation); }
    }

    public class SpeechBridge {
        @JavascriptInterface public void start(String localeTag) { startSpeech(localeTag); }
    }

    public class ShareBridge {
        @JavascriptInterface public void share(String title, String text) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT, title == null ? "IZAKHONO NAV" : title);
                send.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(send, title == null ? "Share from IZAKHONO NAV" : title));
            });
        }
    }

    public class WakeBridge {
        @JavascriptInterface public void acquire() {
            runOnUiThread(() -> getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
        }
        @JavascriptInterface public void release() {
            runOnUiThread(() -> getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON));
        }
    }
}
