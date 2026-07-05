#!/usr/bin/env python3
import json, sys, hashlib
from collections import Counter

FILE = sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-data/outputs/aotms_finetune_all.jsonl"
MAX_TOTAL_WORDS = 1200

errors = []
warnings = []
hashes = Counter()
line_count = 0

with open(FILE, "r", encoding="utf-8") as f:
    for i, line in enumerate(f, start=1):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        line_count += 1

        # 1. valid JSON / missing brackets
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            errors.append(f"line {i}: invalid JSON ({e})")
            continue

        if "messages" not in obj or not isinstance(obj["messages"], list):
            errors.append(f"line {i}: missing/invalid 'messages' key")
            continue

        msgs = obj["messages"]

        if not msgs or msgs[0].get("role") != "system":
            warnings.append(f"line {i}: does not start with a system message")

        # 2. empty responses
        for m in msgs:
            if "role" not in m or "content" not in m:
                errors.append(f"line {i}: message missing role/content")
                continue
            if not m["content"] or not m["content"].strip():
                errors.append(f"line {i}: empty '{m.get('role')}' message content")

        # 3. duplicate conversations (hash of non-system content)
        body = "".join(m.get("content", "") for m in msgs if m.get("role") != "system")
        h = hashlib.md5(body.encode("utf-8")).hexdigest()
        hashes[h] += 1

        # 4. very long conversations (system prompt excluded — it's fixed boilerplate,
        #    not part of the actual call dialogue being trained on)
        total_words = sum(
            len(m.get("content", "").split()) for m in msgs if m.get("role") != "system"
        )
        if total_words > MAX_TOTAL_WORDS:
            warnings.append(f"line {i}: very long conversation ({total_words} words, excluding system prompt)")

        # 5. role alternation sanity check
        roles = [m["role"] for m in msgs if m["role"] != "system"]
        for j in range(1, len(roles)):
            if roles[j] == roles[j - 1]:
                warnings.append(f"line {i}: repeated '{roles[j]}' role back-to-back (turn {j})")
                break

dup_count = sum(c - 1 for c in hashes.values() if c > 1)
if dup_count:
    warnings.append(f"{dup_count} duplicate conversation(s) found across the file")

print(f"File: {FILE}")
print(f"Total lines checked: {line_count}")
print(f"Errors: {len(errors)}")
for e in errors:
    print("  ERROR:", e)
print(f"Warnings: {len(warnings)}")
for w in warnings:
    print("  WARN:", w)

if not errors and not warnings:
    print("Dataset looks clean. Safe to train.")
elif not errors:
    print("No blocking errors. Review warnings above before training.")
else:
    print("Fix errors above before training.")