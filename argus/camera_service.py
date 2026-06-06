"""Camera access for Argus via OpenCV."""
from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

import cv2

PHOTOS_DIR = Path(__file__).resolve().parent / "photos"
WINDOW_TITLE = "Argus Camera"
_camera_thread: threading.Thread | None = None
_camera_stop = threading.Event()


def _ensure_photos_dir() -> Path:
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    return PHOTOS_DIR


def _camera_loop() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Could not open camera.")
        return
    try:
        while not _camera_stop.is_set():
            ok, frame = cap.read()
            if not ok:
                break
            cv2.imshow(WINDOW_TITLE, frame)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), ord("Q")):
                break
    finally:
        cap.release()
        cv2.destroyWindow(WINDOW_TITLE)


def is_camera_open() -> bool:
    return _camera_thread is not None and _camera_thread.is_alive()


def close_camera() -> None:
    """Stop the camera feed thread and close the preview window."""
    global _camera_thread
    _camera_stop.set()
    try:
        cv2.destroyWindow(WINDOW_TITLE)
    except Exception:
        pass
    if _camera_thread is not None and _camera_thread.is_alive():
        _camera_thread.join(timeout=2.0)
    _camera_thread = None
    _camera_stop.clear()
    print("Camera closed.")


def open_camera() -> None:
    """Show live camera feed; toggles off if already open."""
    global _camera_thread
    if is_camera_open():
        close_camera()
        return
    _camera_stop.clear()
    _camera_thread = threading.Thread(target=_camera_loop, daemon=True)
    _camera_thread.start()


def take_photo() -> str | None:
    """Capture one frame and save under argus/photos/."""
    _ensure_photos_dir()
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Could not open camera.")
        return None
    try:
        ok, frame = cap.read()
        if not ok:
            print("Could not capture frame.")
            return None
        filename = f"photo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        path = PHOTOS_DIR / filename
        cv2.imwrite(str(path), frame)
        saved = str(path)
        print(f"Photo saved to: {saved}")
        return saved
    finally:
        cap.release()
