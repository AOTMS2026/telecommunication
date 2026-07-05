#!/usr/bin/env python3
import os, re, json, glob, hashlib

SRC_DIRS = [
    "/home/claude/ft2/extracted/fine tuning",
    "/home/claude/ft3/extracted/fine tuning",
]
SYSTEM_PROMPT_PATH = "/home/claude/work/system_prompt.txt"
OUT_FILE = "/mnt/user-data/outputs/aotms_finetune_all.jsonl"

with open(SYSTEM_PROMPT_PATH, "r", encoding="utf-8") as f:
    SYSTEM_PROMPT = f.read().strip()

# ---------- offensive language filter ----------
OFFENSIVE = [
    "idiot", "stupid", "nonsense", "shut up", "useless", "waste fellow",
    "gudda", "lanjakodaka", "pichi", "donga", "dengu",
]

# ---------- filler / noise cleanup ----------
FILLER_WORDS = {
    "hmm", "hmmm", "aaa", "aaaa", "aaaaa", "umm", "ummm", "uh", "uhh",
    "ah", "ahh", "err", "erm",
}

WRONG_FEE_PATTERN = re.compile(r"\b(5000|6000|8000|10000|50000|60000)\b")
WRONG_DURATION_PATTERN = re.compile(
    r"\b(1 month|2 months|4 months|5 months|6 months|one month|two months) course\b",
    re.IGNORECASE,
)

MAX_TURN_WORDS = 60      # a single turn this long on real ASR data is almost
                         # always a mis-split merge of 2+ speakers, not one person talking
MAX_TOTAL_WORDS = 500    # a real 1-2 minute cold-call, cleaned, should not exceed this
MIN_USER_SHARE = 0.15    # if the "user" side is less than 15% of total words, the
                         # turn-split almost certainly collapsed both speakers into
                         # one role — drop rather than keep bad data


def collapse_repeats(text):
    # "yeah yeah yeah" -> "yeah", "okkkkkkk" -> "okay"
    text = re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", text, flags=re.IGNORECASE)
    # elongated letters: "okkkkkkk" -> "ok", "sooooo" -> "so"
    text = re.sub(r"(\w)\1{2,}", r"\1", text)
    return text


def strip_filler(text):
    words = text.split()
    kept = [w for w in words if re.sub(r"[^a-zA-Z]", "", w).lower() not in FILLER_WORDS]
    return " ".join(kept)


def clean_text(t):
    t = re.sub(r"Academy of Tech Master[s]?", "Academy of Tech Masters", t, flags=re.IGNORECASE)
    t = collapse_repeats(t)
    t = strip_filler(t)
    t = re.sub(r"\.{2,}", ".", t)
    t = re.sub(r"\s+", " ", t)
    t = re.sub(r"\s+([.,?!])", r"\1", t)
    t = re.sub(r"\bMem Academy\b", "Memu Academy", t)
    t = re.sub(r"\bMemu Academy of Tech Masters\b", "Memu Academy of Tech Masters", t)
    t = re.sub(r"₹?\s?18[,.]?000", "18,000", t)
    t = re.sub(r"₹?\s?15[,.]?000", "15,000", t)
    t = re.sub(r"₹?\s?16[,.]?000", "16,000", t)
    t = re.sub(r"₹?\s?20[,.]?000", "20,000", t)
    t = re.sub(r"₹?\s?28[,.]?000", "28,000", t)
    t = re.sub(r"₹?\s?30[,.]?000", "30,000", t)
    return t.strip()


def is_offensive(t):
    low = t.lower()
    return any(bad in low for bad in OFFENSIVE)


def has_wrong_facts(t):
    return bool(WRONG_FEE_PATTERN.search(t)) or bool(WRONG_DURATION_PATTERN.search(t))


CUSTOMER_BACKCHANNEL = {
    "okay", "avunandi", "avunu", "ya", "cheppandi", "yes", "yes sir",
    "yes madam", "ledandi", "ledu", "sare", "sare sir", "sare andi",
    "aa", "alright", "tell me", "sir", "madam", "aha", "kadandi", "yeah",
}

AGENT_MARKERS = [
    "academy of tech masters", "memu", "maa daggara", "call chestunnam",
    "call chestunnanu", "provide chestam", "course", "demo", "lms",
    "placement", "vijayawada", "ben circle", "certificate", "github",
    "whatsapp", "fee", "months", "sir we", "madam we", "meeku", "istamu",
    "chestamu", "nerpistamu", "cheptamu",
]


def split_sentences(t):
    parts = re.split(r"(?<=[.?!])\s+", t)
    parts = [p.strip() for p in parts if p.strip() and len(p.strip()) > 1]
    # further split any run-on sentence (common in raw ASR text with no
    # punctuation) at commas / "sir"/"madam"/"andi" boundaries, so the
    # turn-classifier gets small enough pieces to assign correctly instead
    # of merging two speakers' lines into one giant turn
    refined = []
    for p in parts:
        if len(p.split()) <= 25:
            refined.append(p)
            continue
        sub = re.split(r",\s*|\b(?:sir|madam|andi)\b\s*", p, flags=re.IGNORECASE)
        sub = [s.strip(" ,") for s in sub if s.strip(" ,")]
        refined.extend(sub if sub else [p])
    return refined


def classify(sentence):
    s = sentence.lower().strip(" .?!")
    if not s:
        return None
    if s in CUSTOMER_BACKCHANNEL:
        return "user"
    if len(s.split()) <= 3 and not any(m in s for m in AGENT_MARKERS):
        return "user"
    if any(m in s for m in AGENT_MARKERS):
        return "assistant"
    if len(s.split()) <= 6:
        return "user"
    return "assistant"


def build_turns(raw):
    sentences = split_sentences(raw)
    if not sentences:
        return []
    turns, buf, current_role = [], [], "assistant"
    for sent in sentences:
        role = classify(sent)
        if role is None:
            continue
        if not turns and not buf:
            role = "assistant"
        if role != current_role and buf:
            turns.append((current_role, " ".join(buf)))
            buf = []
            current_role = role
        buf.append(sent)
    if buf:
        turns.append((current_role, " ".join(buf)))
    merged = []
    for role, text in turns:
        if merged and merged[-1][0] == role:
            merged[-1] = (role, merged[-1][1] + " " + text)
        else:
            merged.append((role, text))
    return merged


def is_complete(turns, raw):
    if len(turns) < 2:
        return False
    last_text = turns[-1][1].strip()
    if not last_text or last_text[-1] not in ".?!":
        return False
    if len(raw.split()) < 15:
        return False
    return True


def is_too_long(turns):
    total_words = sum(len(t.split()) for _, t in turns)
    if total_words > MAX_TOTAL_WORDS:
        return True
    if any(len(t.split()) > MAX_TURN_WORDS for _, t in turns):
        return True
    return False


def is_imbalanced(turns):
    """Drop conversations where the split collapsed almost everything into
    one role — a strong signal the automatic speaker-split failed, since a
    real cold-call always has the customer actually talking sometimes."""
    total = sum(len(t.split()) for _, t in turns)
    if total == 0:
        return True
    user_words = sum(len(t.split()) for role, t in turns if role == "user")
    return (user_words / total) < MIN_USER_SHARE


def has_empty_turn(turns):
    return any(not t.strip() for _, t in turns)


def to_example(turns):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for role, text in turns:
        messages.append({"role": role, "content": text})
    return {"messages": messages}


def raw_hash(messages):
    body = "".join(m["content"] for m in messages if m["role"] != "system")
    return hashlib.md5(body.encode("utf-8")).hexdigest()


def main():
    files = []
    for d in SRC_DIRS:
        files.extend(glob.glob(os.path.join(d, "*.txt")))
    files = sorted(files, key=lambda p: (os.path.dirname(p), int(re.search(r"(\d+)", os.path.basename(p)).group(1))))

    examples = []
    seen_hashes = set()
    stats = {"total": len(files), "kept": 0, "dup": 0, "offensive": 0,
              "wrong_facts": 0, "incomplete": 0, "too_long": 0, "empty_turn": 0,
              "imbalanced_split": 0}

    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            raw = f.read()
        raw = clean_text(raw)

        if is_offensive(raw):
            stats["offensive"] += 1
            continue
        if has_wrong_facts(raw):
            stats["wrong_facts"] += 1
            continue

        turns = build_turns(raw)

        if not is_complete(turns, raw):
            stats["incomplete"] += 1
            continue
        if has_empty_turn(turns):
            stats["empty_turn"] += 1
            continue
        if is_too_long(turns):
            stats["too_long"] += 1
            continue
        if is_imbalanced(turns):
            stats["imbalanced_split"] += 1
            continue

        example = to_example(turns)
        h = raw_hash(example["messages"])
        if h in seen_hashes:
            stats["dup"] += 1
            continue
        seen_hashes.add(h)
        examples.append(example)
        stats["kept"] += 1

    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()