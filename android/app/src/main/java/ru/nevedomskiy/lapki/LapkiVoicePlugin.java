package ru.nevedomskiy.lapki;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;

/** Uses an installed offline Russian voice; never launches an install or requests permissions. */
@CapacitorPlugin(name = "LapkiVoice")
public class LapkiVoicePlugin extends Plugin {
    private TextToSpeech tts;
    private boolean initialized = false;
    private boolean ready = false;
    private boolean foreground = true;

    @Override
    public void load() {
        getActivity().runOnUiThread(() -> {
            tts = new TextToSpeech(getContext(), status -> {
                initialized = true;
                if (status != TextToSpeech.SUCCESS || tts == null) return;
                Set<Voice> voices = tts.getVoices();
                if (voices != null) {
                    for (Voice voice : voices) {
                        if ("ru".equals(voice.getLocale().getLanguage()) && !voice.isNetworkConnectionRequired()) {
                            ready = tts.setVoice(voice) == TextToSpeech.SUCCESS;
                            break;
                        }
                    }
                }
                tts.setSpeechRate(0.82f);
                tts.setPitch(1.12f);
            });
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        getActivity().runOnUiThread(() -> {
            boolean spoken = false;
            String reason = !initialized ? "initializing" : !ready ? "missing_voice" : "inactive";
            if (ready && foreground && !text.isEmpty() && text.length() <= TextToSpeech.getMaxSpeechInputLength()) {
                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 0.8f);
                spoken = tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "lapki-prompt") == TextToSpeech.SUCCESS;
                reason = spoken ? "ok" : "engine_error";
            }
            JSObject result = new JSObject();
            result.put("spoken", spoken);
            result.put("reason", reason);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        getActivity().runOnUiThread(() -> { if (tts != null) tts.stop(); call.resolve(); });
    }

    @Override
    protected void handleOnPause() { foreground = false; if (tts != null) tts.stop(); }
    @Override
    protected void handleOnResume() { foreground = true; }
    @Override
    protected void handleOnDestroy() { if (tts != null) { tts.stop(); tts.shutdown(); tts = null; } ready = false; }
}
