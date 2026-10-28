"""(Copied from the Production Board's service-PM video, docs/guides/service-pm-video/.)

Lay every narration line at the moment its beat started in the take.

    python mix.py <cues.json> <voice-dir> <seconds> <out.wav> [<spans.json>]

With a spans path it also writes, for every line, where each spoken piece
starts and ends inside that line's own audio: tts.py joins sentences with
pauses of pure digital silence, so the gaps are exact and the captions can
change on the sentence the voice is actually saying rather than on a guess.
"""
import json
import sys
import wave

import numpy as np

cues_path, voice_dir, seconds, out = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
spans_path = sys.argv[5] if len(sys.argv) > 5 else None
MIN_GAP = 0.2  # tts.py's shortest pause is 0.28s; speech never holds exact zero this long


def spans_of(pcm, rate):
    """[[start, end], …] in seconds: the stretches between runs of exact silence."""
    silent = np.concatenate([[True], pcm == 0, [True]]).astype(np.int8)
    edges = np.diff(silent)
    starts = np.flatnonzero(edges == -1)  # first sample of each sound run
    ends = np.flatnonzero(edges == 1)  # one past its last sample
    out = []
    for a, b in zip(starts, ends):
        # A short dip to zero inside a sentence is not a pause: join it on.
        if out and a - out[-1][1] < MIN_GAP * rate:
            out[-1][1] = b
        else:
            out.append([a, b])
    return [[a / rate, b / rate] for a, b in out]


spans = {}
cues = json.load(open(cues_path, encoding="utf-8"))
rate = None
track = None
for c in cues:
    with wave.open(f"{voice_dir}/{c['id']}.wav", "rb") as wf:
        if rate is None:
            rate = wf.getframerate()
            track = np.zeros(int((seconds + 2) * rate), dtype=np.float32)
        pcm = np.frombuffer(wf.readframes(wf.getnframes()), dtype=np.int16).astype(np.float32)
    spans[c["id"]] = spans_of(pcm, rate)
    at = int(c["at"] * rate)
    end = min(len(track), at + len(pcm))
    track[at:end] += pcm[: end - at]
track = np.clip(track[: int(seconds * rate)], -32768, 32767).astype(np.int16)
with wave.open(out, "wb") as wf:
    wf.setnchannels(1)
    wf.setsampwidth(2)
    wf.setframerate(rate)
    wf.writeframes(track.tobytes())
if spans_path:
    with open(spans_path, "w", encoding="utf-8") as f:
        json.dump(spans, f)
