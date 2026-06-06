"""Argus — personal voice assistant main loop."""
from __future__ import annotations

import sys

from dotenv import load_dotenv

from brain import ArgusBrain
from voice import EXIT_SIGNAL, VoiceInput, VoiceOutput


def _process_query(brain: ArgusBrain, voice_out: VoiceOutput, query: str) -> None:
    print(f"You: {query}")
    try:
        reply = brain.ask(query)
    except Exception as exc:
        reply = f"I hit an error processing that: {exc}"
        print(reply)

    print(f"Mythos: {reply}")
    voice_out.speak(reply)


def main() -> None:
    load_dotenv()

    print('Mythos starting. Say "Friday" to wake. Say "Mythos stop" to exit.')

    try:
        brain = ArgusBrain()
        voice_in = VoiceInput()
        voice_out = VoiceOutput(voice_in)
    except RuntimeError as exc:
        print(f"Startup failed: {exc}")
        sys.exit(1)

    voice_in.calibrate()
    voice_out.speak("Mythos online.")

    running = True
    while running:
        wake_result = voice_in.wait_for_wake_word()

        if wake_result == EXIT_SIGNAL:
            voice_out.speak("Shutting down.")
            break

        if wake_result is None:
            query = voice_in.listen_for_query()
        else:
            query = wake_result

        if not query:
            continue
        if query == EXIT_SIGNAL:
            voice_out.speak("Shutting down.")
            break

        _process_query(brain, voice_out, query)

        while running:
            follow_up = voice_in.listen_for_follow_up()

            if follow_up == EXIT_SIGNAL:
                voice_out.speak("Shutting down.")
                running = False
                break

            if follow_up is None:
                print("Going to sleep...")
                break

            _process_query(brain, voice_out, follow_up)


if __name__ == "__main__":
    main()
