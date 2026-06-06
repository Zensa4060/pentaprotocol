"""Speech input (local faster-whisper) and offline TTS output for Mythos."""
from __future__ import annotations

import os
import re
import tempfile

import speech_recognition as sr
from faster_whisper import WhisperModel

WAKE_WORD = "friday"
STOP_PHRASE = "mythos stop"
SPEECH_RATE_WPM = 175
FOLLOW_UP_TIMEOUT = 900.0

# Returned by listen helpers when the user wants to exit.
EXIT_SIGNAL = "__EXIT__"


def strip_markdown(text: str) -> str:
    """Remove markdown artifacts so TTS does not read symbols aloud."""
    if not text:
        return ""
    out = text
    out = re.sub(r"```[\s\S]*?```", " ", out)
    out = re.sub(r"`([^`]+)`", r"\1", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"\1", out)
    out = re.sub(r"\*([^*]+)\*", r"\1", out)
    out = re.sub(r"__([^_]+)__", r"\1", out)
    out = re.sub(r"_([^_]+)_", r"\1", out)
    out = re.sub(r"^#{1,6}\s+", "", out, flags=re.MULTILINE)
    out = re.sub(r"^\s*[-*+]\s+", "", out, flags=re.MULTILINE)
    out = re.sub(r"^\s*\d+\.\s+", "", out, flags=re.MULTILINE)
    out = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", out)
    out = re.sub(r"[*#_`>|]", " ", out)
    out = re.sub(r"\s+", " ", out).strip()
    return out


class VoiceInput:
    """Microphone listener using speech_recognition + local faster-whisper."""

    def __init__(self) -> None:
        print("Loading Whisper model...")
        self._whisper_model = WhisperModel("tiny", device="cpu", compute_type="int8")
        self.recognizer = sr.Recognizer()
        self.recognizer.dynamic_energy_threshold = True
        self.recognizer.energy_threshold = 300
        self.recognizer.pause_threshold = 0.5
        self._microphone = sr.Microphone()

    def calibrate(self) -> None:
        """One-time ambient noise calibration."""
        print("Calibrating microphone for ambient noise…")
        with self._microphone as source:
            self.recognizer.adjust_for_ambient_noise(source, duration=1.0)
        print("Ready.")

    def _transcribe(self, audio: sr.AudioData) -> str:
        path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio.get_wav_data())
                path = tmp.name
            segments, _ = self._whisper_model.transcribe(path, beam_size=1)
            return " ".join(segment.text for segment in segments).strip()
        except Exception as exc:
            print(f"Speech recognition error: {exc}")
            return ""
        finally:
            if path and os.path.exists(path):
                os.unlink(path)

    def _listen(self, *, timeout: float, phrase_limit: float) -> sr.AudioData | None:
        try:
            with self._microphone as source:
                return self.recognizer.listen(
                    source,
                    timeout=timeout,
                    phrase_time_limit=phrase_limit,
                )
        except sr.WaitTimeoutError:
            return None

    def wait_for_wake_word(self) -> str | None:
        """Listen silently until the wake word or stop phrase is heard.

        Returns:
            EXIT_SIGNAL — user said stop phrase
            str — query text if wake word and query were in the same utterance
            None — wake word only; caller should record the query next
        """
        while True:
            audio = self._listen(timeout=1.0, phrase_limit=2.0)
            if audio is None:
                continue

            text = self._transcribe(audio).strip()
            if not text:
                continue

            lower = text.lower()
            if STOP_PHRASE in lower:
                return EXIT_SIGNAL

            if WAKE_WORD not in lower:
                continue

            idx = lower.find(WAKE_WORD)
            query = text[idx + len(WAKE_WORD) :].strip(" ,.!?-:")
            return query if query else None

    def listen_for_query(self) -> str | None:
        """Record the user's question after the wake word."""
        print("Listening…")
        audio = self._listen(timeout=5.0, phrase_limit=8.0)
        if audio is None:
            return None

        text = self._transcribe(audio).strip()
        if not text:
            return None

        if STOP_PHRASE in text.lower():
            return EXIT_SIGNAL
        return text

    def listen_for_follow_up(self) -> str | None:
        """Active mode: listen for a follow-up without the wake word.

        Returns query text, None after silence timeout, or EXIT_SIGNAL.
        """
        print("Listening for follow-up...")
        audio = self._listen(timeout=FOLLOW_UP_TIMEOUT, phrase_limit=8.0)
        if audio is None:
            return None

        text = self._transcribe(audio).strip()
        if not text:
            return None

        if STOP_PHRASE in text.lower():
            return EXIT_SIGNAL
        return text


class VoiceOutput:
    """Offline text-to-speech via pyttsx3."""

    def __init__(self) -> None:
        pass

    def _select_male_voice_on(self, engine) -> None:
        voices = engine.getProperty("voices") or []
        preferred = ("david", "mark", "james", "george", "male", "guy", "ryan", "alex")
        for voice in voices:
            blob = f"{voice.id} {voice.name}".lower()
            if any(token in blob for token in preferred):
                engine.setProperty("voice", voice.id)
                break

    def speak(self, text: str) -> None:
        clean = strip_markdown(text)
        if not clean:
            return
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty("rate", SPEECH_RATE_WPM)
        self._select_male_voice_on(engine)
        engine.say(clean)
        engine.runAndWait()
        engine.stop()
