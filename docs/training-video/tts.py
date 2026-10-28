"""Narration for the training video: one WAV per line, with an offline voice.

Copied from the Production Board's service-PM video (bledsoecw/DB_Production_Board,
docs/guides/service-pm-video/tts.py) so the two videos sound like one set:
the same voice, speed, pauses and loudness. Only the LEXICON grows here.

    python tts.py <lines.json> <out-dir> <kokoro-dir> <voice>

lines.json is [{"id": "...", "text": "..."}]; each line is written to
<out-dir>/<id>.wav unless that file already exists, so re-running after a
wording change only re-speaks the lines that changed (the id is a hash of the
spoken text). Prints {"id": seconds} for every line as JSON on stdout.

The voice is Kokoro (kokoro-onnx), not Piper: Piper ran sentences together
and read like a machine (Carl, 27 Oct 2026). Three things make it sound like
somebody talking rather than a text being read out:

- Every sentence is spoken on its own and the line is joined back together
  with a real pause after each one (SENTENCE_PAUSE), and a shorter one after
  a colon (CLAUSE_PAUSE). Spoken as one block, the model leaves almost no gap
  at a full stop.
- The words it gets wrong are given to it as sounds, not letters (LEXICON,
  IPA in the model's own alphabet). Names first, then the abbreviations the
  board uses: "PO" read as "poe" and "WO" as "woe" otherwise.
- Every line is brought to the same loudness, so one line is never louder
  than the next.

Needs kokoro-onnx and soundfile (pip install kokoro-onnx soundfile) and the
model files kokoro-v1.0.onnx + voices-v1.0.bin in <kokoro-dir>; see README.md.
A change to anything below — the voice, the speed, a pause, the lexicon — is
a change to every line, so the cache is keyed on all of it (SETTINGS).
"""
import hashlib
import json
import os
import re
import sys

import numpy as np
import soundfile as sf

SPEED = 0.94  # a little under the model's own pace: this is teaching, not reading
SENTENCE_PAUSE = 0.42  # seconds after . ! ?
CLAUSE_PAUSE = 0.28  # seconds after a colon or semicolon
TARGET_RMS = 0.075  # every line to the same loudness (about -22 dBFS)
PEAK = 0.95
FADE = 0.006  # seconds faded at each sentence's ends, so joins never click

# Word -> how it is said, in the model's phoneme alphabet. Matched whole-word,
# case-sensitive, with a possessive 's added automatically. Checked against
# the board's people by name; add a line here when a new name is mispronounced.
LEXICON = {
    "Yahir": "jɑːˈɪɹ",  # yah-EER
    "Whitcombe": "wˈɪtkəm",  # WIT-cum (the video's made-up customer)
    "Bonnewitz": "bˈɑːnəwɪts",  # BON-uh-wits, the street the yard is on
    "Alberto": "ælbˈɛɹtoʊ",  # al-BEHR-toe
    "Kreischer": "kɹˈaɪʃɚ",  # KRY-sher
    "Ingman": "ˈɪŋmən",
    "Elick": "ˈɛlɪk",  # EL-ick
    "Kodey": "kˈoʊdi",
    "Nick S": "nˈɪk ˈɛs",
    "PMs": "pˌiːˈɛmz",
    "PM": "pˌiːˈɛm",
    "POs": "pˌiːˈoʊz",
    "PO": "pˌiːˈoʊ",
    "WOs": "dˈʌbəljˌuːˈoʊz",
    "WO": "dˈʌbəljˌuːˈoʊ",
    # The Crew App's own words.
    "N/A": "ˌɛnˈeɪ",
    "ES": "ˌiːˈɛs",
    "EN": "ˌiːˈɛn",
    "Ord": "ˈɔːɹd",
    "Mohr": "mˈɔːɹ",
    "Castellano": "kˌæstəlˈɑːnoʊ",  # cas-tel-AH-no
}

lines_path, out_dir, kokoro_dir, voice_name = sys.argv[1:5]
SETTINGS = json.dumps(
    {"voice": voice_name, "speed": SPEED, "pauses": [SENTENCE_PAUSE, CLAUSE_PAUSE],
     "rms": TARGET_RMS, "lexicon": LEXICON, "v": 1},
    sort_keys=True, ensure_ascii=False,
)
os.makedirs(out_dir, exist_ok=True)
stamp = os.path.join(out_dir, "settings.json")
if not os.path.exists(stamp) or open(stamp, encoding="utf-8").read() != SETTINGS:
    for f in os.listdir(out_dir):
        if f.endswith(".wav"):
            os.remove(os.path.join(out_dir, f))
    with open(stamp, "w", encoding="utf-8") as f:
        f.write(SETTINGS)

LEX_RE = re.compile(
    r"(?<![\w'])(" + "|".join(re.escape(w) for w in sorted(LEXICON, key=len, reverse=True)) + r")('s)?(?![\w])"
)

kokoro = None


def phonemes(text):
    """The text in the model's alphabet, with the lexicon's words put in as sounds."""
    out, last = [], 0
    for m in LEX_RE.finditer(text):
        before = text[last:m.start()]
        if before.strip():
            out.append(kokoro.tokenizer.phonemize(before, "en-us"))
        word = LEXICON[m.group(1)]
        if m.group(2):
            word += "ᵻz" if word.endswith(("s", "z", "ʃ", "ʒ", "tʃ", "dʒ")) else "z"
        out.append(word)
        last = m.end()
    rest = text[last:]
    if rest.strip():
        out.append(kokoro.tokenizer.phonemize(rest, "en-us"))
    return " ".join(" ".join(out).split())


def pieces(text):
    """[(sentence, pause after)] — split at sentence ends and at colons."""
    parts = re.split(r"(?<=[.!?:;])\s+", text.strip())
    out = []
    for p in parts:
        if not p.strip():
            continue
        pause = CLAUSE_PAUSE if p.rstrip()[-1] in ":;" else SENTENCE_PAUSE
        out.append((p.strip(), pause))
    if out:
        out[-1] = (out[-1][0], 0.0)
    return out


def speak(text):
    chunks = []
    for sentence, pause in pieces(text):
        audio, rate = kokoro.create(phonemes(sentence), voice=voice_name, speed=SPEED, is_phonemes=True)
        audio = audio.astype(np.float32)
        n = int(FADE * rate)
        if len(audio) > 2 * n:
            ramp = np.linspace(0.0, 1.0, n, dtype=np.float32)
            audio[:n] *= ramp
            audio[-n:] *= ramp[::-1]
        chunks.append(audio)
        if pause:
            chunks.append(np.zeros(int(pause * rate), dtype=np.float32))
    audio = np.concatenate(chunks)
    voiced = audio[np.abs(audio) > 0.01]
    rms = float(np.sqrt(np.mean(voiced**2))) if len(voiced) else 0.0
    if rms > 0:
        audio = audio * (TARGET_RMS / rms)
    peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
    if peak > PEAK:
        audio = audio * (PEAK / peak)
    return audio, rate


lines = json.load(open(lines_path, encoding="utf-8"))
lengths = {}
for line in lines:
    path = os.path.join(out_dir, line["id"] + ".wav")
    if not os.path.exists(path):
        if kokoro is None:
            from kokoro_onnx import Kokoro

            kokoro = Kokoro(os.path.join(kokoro_dir, "kokoro-v1.0.onnx"), os.path.join(kokoro_dir, "voices-v1.0.bin"))
        audio, rate = speak(line["text"])
        tmp = path + ".tmp.wav"
        sf.write(tmp, audio, rate, subtype="PCM_16")
        os.replace(tmp, path)
    lengths[line["id"]] = sf.info(path).duration
json.dump(lengths, sys.stdout)
