"""(Copied from the Production Board's service-PM video, docs/guides/service-pm-video/.)

Listen to the narration with a speech recogniser and list what it mishears.

    python check-voice.py <lines.json> <voice-dir> [--model small.en] [--top 25]

    e.g.  python check-voice.py "$VIDEO_WORK/lines.json" "$VIDEO_WORK/voice-am_michael"

A stand-in for listening to fourteen minutes of narration by ear: a line the
recogniser mishears is a line a person is likely to stumble on too. Prints
the worst lines with each differing word ("techs -> texts"), then the word
error rate overall. Measured 27 Oct 2026: Piper's narration 4.6% over 48 of
124 lines; Kokoro am_michael with the LEXICON 1.2% over 21 lines, nearly all
of it the recogniser and not the voice (it spells Yahir "Yair", and "crews"
and "cruise" are one sound). A new name in the script is worth one run.

Needs faster-whisper and scipy (pip install faster-whisper scipy); the
recogniser model downloads itself on first use.
"""
import argparse
import difflib
import json
import os
import re

import soundfile as sf
from math import gcd
from scipy.signal import resample_poly
from faster_whisper import WhisperModel


def load16k(path):
    x, sr = sf.read(path, dtype="float32", always_2d=True)
    x = x.mean(axis=1)
    if sr != 16000:
        g = gcd(sr, 16000)
        x = resample_poly(x, 16000 // g, sr // g).astype("float32")
    return x

ap = argparse.ArgumentParser()
ap.add_argument("lines")
ap.add_argument("wavdir")
ap.add_argument("--model", default="small.en")
ap.add_argument("--top", type=int, default=25)
ap.add_argument("--json")
a = ap.parse_args()

CANON = [
    (r"\bjob tread\b", "jobtread"),
    (r"\bclose out\b", "closeout"),
    (r"\bcloseout\b", "closeout"),
    (r"\bd b\b", "db"),
    (r"\bo k\b", "ok"),
    (r"\bnick s\b", "nicks"),
    (r"\be mail", "email"),
    (r"\bto do\b", "todo"),
    (r"\bre-?check", "recheck"),
    (r"\bgray", "grey"),
    (r"\bkarl\b", "carl"),
    (r"\bsean\b", "shawn"),
    (r"\bcody\b", "kodey"),
    (r"\bany more\b", "anymore"),
    (r"\b1\b", "one"), (r"\b2\b", "two"), (r"\b3\b", "three"), (r"\b4\b", "four"), (r"\b5\b", "five"), (r"\b8\b", "eight"),
    (r"\b8 am\b", "eight am"),
    # The Crew App video's own (Oct 2026): numerals the recogniser writes as
    # digits, "okay" for the OK button, and its spelling of Yahir.
    (r"\b10\b", "ten"), (r"\b15\b", "fifteen"), (r"\b45\b", "forty five"),
    (r"\bokay\b", "ok"), (r"\bn a\b", "na"),
    (r"\byair\b", "yahir"), (r"\byair's\b", "yahir's"),
]


def norm(t):
    t = t.lower().replace("’", "'").replace("-", " ")
    t = re.sub(r"[^a-z0-9' ]+", " ", t)
    words = t.split()
    # collapse spelled-out letters: "p m" -> "pm"
    out, run = [], []
    for w in words:
        if len(w) == 1 and w not in ("a", "i"):
            run.append(w)
            continue
        if run:
            out.append("".join(run))
            run = []
        out.append(w)
    if run:
        out.append("".join(run))
    t = " ".join(out)
    for pat, rep in CANON:
        t = re.sub(pat, rep, t)
    return t.split()


lines = json.load(open(a.lines, encoding="utf-8"))
model = WhisperModel(a.model, device="cpu", compute_type="int8")
rows, errs, total = [], 0, 0
for line in lines:
    wav = os.path.join(a.wavdir, line["id"] + ".wav")
    if not os.path.exists(wav):
        continue
    segs, _ = model.transcribe(load16k(wav), beam_size=5, language="en", condition_on_previous_text=False)
    heard = " ".join(s.text for s in segs).strip()
    ref, hyp = norm(line["text"]), norm(heard)
    sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    diffs, e = [], 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            continue
        e += max(i2 - i1, j2 - j1)
        diffs.append(f"{' '.join(ref[i1:i2]) or '∅'} → {' '.join(hyp[j1:j2]) or '∅'}")
    errs += e
    total += len(ref)
    rows.append({"id": line["id"], "text": line["text"], "heard": heard, "wer": e / max(1, len(ref)), "diffs": diffs})

rows.sort(key=lambda r: -r["wer"])
for r in rows[: a.top]:
    if not r["diffs"]:
        break
    print(f"{r['wer']:.2f}  {r['text'][:90]}")
    print("      " + " | ".join(r["diffs"]))
print(f"\nOVERALL word error rate {errs / max(1, total):.3f} over {total} words, {sum(1 for r in rows if r['diffs'])} of {len(rows)} lines differ")
if a.json:
    json.dump(rows, open(a.json, "w"), indent=1)
