# backend/scripts/build_seed_data.py
# สร้าง backend/data/oxford_vocabulary.json จาก oxford_final_filled.csv
# - id = doc id เดิม (matchWord) ถ้ามี เพื่อรักษา favoriteVocab.wordId / exercises.wordId ที่อ้างอยู่
#   ไม่งั้นใช้ ox_* id ใหม่
# ใช้เป็นแหล่งข้อมูลเดียวของ seed.js และ sync_vocabulary.js
import csv, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "oxford_final_filled.csv")
OUT_DIR = os.path.join(HERE, "..", "data")
OUT = os.path.join(OUT_DIR, "oxford_vocabulary.json")

POS_FULL = {"n": "noun", "v": "verb", "adj": "adjective", "adv": "adverb",
            "prep": "preposition", "pron": "pronoun", "conj": "conjunction",
            "det": "determiner", "modal": "modal verb", "aux": "auxiliary verb",
            "exclam": "exclamation", "number": "number", "phr": "phrase"}


def main():
    rows = list(csv.DictReader(open(SRC, encoding="utf-8-sig")))
    out = []
    seen = set()
    for r in rows:
        doc_id = r["matchWord"] or r["id"]
        if doc_id in seen:
            raise SystemExit("DUP ID: %s (%s)" % (doc_id, r["wordEN"]))
        seen.add(doc_id)
        out.append({
            "id": doc_id,
            "wordEN": r["wordEN"],
            "wordTH": r["wordTH"],
            "cefrLevel": r["cefrLevel"],
            "partOfSpeech": POS_FULL.get(r["pos"], ""),
        })
    a1 = sum(1 for x in out if x["cefrLevel"] == "A1")
    a2 = sum(1 for x in out if x["cefrLevel"] == "A2")
    assert len(out) == 1772, "count %d != 1772" % len(out)
    assert all(x["wordTH"] for x in out), "some wordTH empty"
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("written:", OUT)
    print("total: %d (A1: %d, A2: %d)" % (len(out), a1, a2))
    print("reused existing ids:", sum(1 for x in out if not x["id"].startswith("ox_")))


if __name__ == "__main__":
    main()
