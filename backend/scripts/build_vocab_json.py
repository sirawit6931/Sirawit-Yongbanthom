# backend/scripts/build_vocab_json.py
# แปลง oxford_raw_entries.json (บรรทัดดิบจาก PDF) -> structured entries
# fields: wordEN, pos (ย่อ), partOfSpeech (เต็ม), cefrLevel, glossEN
# รัน: python backend/scripts/build_vocab_json.py
# ผลลัพธ์: backend/scripts/oxford_struct.json
import re, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "oxford_raw_entries.json")
OUT = os.path.join(HERE, "oxford_struct.json")

POS_SHORT = ["n", "v", "adj", "adv", "prep", "pron", "conj", "det",
             "modal", "aux", "exclam", "interj", "num", "phr"]
POS_FULL = {"n": "noun", "v": "verb", "adj": "adjective", "adv": "adverb",
            "prep": "preposition", "pron": "pronoun", "conj": "conjunction",
            "det": "determiner", "modal": "modal verb", "aux": "auxiliary verb",
            "exclam": "exclamation", "interj": "interjection",
            "num": "number", "number": "number", "phr": "phrase"}


def strip_homograph(word):
    # ตัดเลข homograph ท้ายคำ: second1, close2 -> second, close
    return re.sub(r"[12]$", "", word)


def fix_entry(e, level):
    low = e.lower()
    # เคสพิเศษ
    if low.startswith("a,") and "indefinite article" in low:
        return {"wordEN": "a/an", "pos": "det", "gloss": "indefinite article", "cefrLevel": level}
    if low.startswith("the ") and "definite article" in low:
        return {"wordEN": "the", "pos": "det", "gloss": "definite article", "cefrLevel": level}
    if low.startswith("one ") and ("number/det" in low or "number, det" in low):
        # 'one number/det., pron.' = คำว่า one (หลาย POS) นับเป็น 1 entry -> เอา POS ตัวแรก
        return {"wordEN": "one", "pos": "number", "gloss": None, "cefrLevel": level}
    toks = e.split()
    if toks and toks[-1] == "number" and len(toks) > 1 and "." not in toks[-2]:
        # เช่น 'fifteen number' / 'second ... det./ number'
        pos = "number"
        head = " ".join(toks[:-1]).rstrip(",")
    else:
        # หา POS ตัวแรก: เช่น 'orange n., adj.' -> 'n'
        m = re.search(r"(?<![a-zA-Z])((?:n|v|adj|adv|prep|pron|conj|det|modal|aux|exclam|interj|num|phr))\.", e)
        if m:
            pos = m.group(1)
            head = e[:m.start()].rstrip(" ,")
        else:
            return {"wordEN": None, "pos": None, "gloss": None, "cefrLevel": level, "raw": e, "FIXME": True}
    head = head.strip().rstrip(",").rstrip("/")
    word, gloss = head, None
    gm = re.match(r"^(.*?)\s*\((.*)\)\s*$", head)
    if gm:
        word, gloss = gm.group(1).strip(), gm.group(2).strip()
    word = strip_homograph(word).strip()
    return {"wordEN": word, "pos": pos, "gloss": gloss, "cefrLevel": level}


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    out = {"A1": [], "A2": []}
    bad = []
    for lvl in ("A1", "A2"):
        for raw in data[lvl]:
            r = fix_entry(raw, lvl)
            # ปรับ modal/auxiliary: 'can1 modal'/'have to modal'/'have auxiliary'
            if r["wordEN"] and r["wordEN"].endswith(" modal"):
                base = r["wordEN"][:-6].strip()
                base = re.sub(r"[12]$", "", base)
                r["wordEN"] = base
                r["pos"] = "modal"
            if r["wordEN"] and r["wordEN"].endswith(" auxiliary"):
                r["wordEN"] = r["wordEN"][:-10].strip()
                r["pos"] = "aux"
            r["partOfSpeech"] = POS_FULL.get(r["pos"], "")
            if r["wordEN"]:
                w = r["wordEN"].replace(" ", " ").strip()
                r["wordEN"] = re.sub(r"\s+", " ", w)
            else:
                bad.append(raw)
            out[lvl].append(r)
    print("A1:", len(out["A1"]))
    print("A2:", len(out["A2"]))
    print("TOTAL:", len(out["A1"]) + len(out["A2"]))
    print("unparsed:", len(bad))
    for b in bad:
        print("  BAD:", repr(b))
    # นับ (wordEN, level) ซ้ำภายใน level
    from collections import Counter
    for lvl in ("A1", "A2"):
        c = Counter(x["wordEN"] for x in out[lvl])
        dups = {k: v for k, v in c.items() if v > 1}
        print(lvl, "unique words:", len(c), "dups:", dups)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("written:", OUT)


if __name__ == "__main__":
    main()
