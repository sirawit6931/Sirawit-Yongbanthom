# backend/scripts/build_final_csv.py
# ประกอบ oxford_final.csv: id,wordEN,wordTH,pos,cefrLevel,matchWord,keepId,keepWordTH
# โดย reuse wordTH จาก Firestore เดิมเมื่อ matchId เจอ (ห้าม invented translation!)
import json, os, re, csv

HERE = os.path.dirname(os.path.abspath(__file__))
STRUCT = os.path.join(HERE, "oxford_struct.json")
EXIST = os.path.join(HERE, "vocab_existing.json")
OUT = os.path.join(HERE, "oxford_final.csv")

# hand-fixed TH สำหรับ entries ที่ match เดิมไม่ได้
HAND_TH = {
    ("A1", "second|next_after_the_first"): "ที่สอง (ลำดับ)",
    ("A1", "second|unit"): "วินาที",
    ("A2", "second|next_after_the_first"): "ที่สอง (ลำดับ)",
}


def norm(w):
    return (w or "").strip().lower()


def main():
    struct = json.load(open(STRUCT, encoding="utf-8"))
    exist = json.load(open(EXIST, encoding="utf-8"))

    byword = {}
    for d in exist:
        w = norm(d.get("wordEN"))
        if w:
            byword.setdefault(w, []).append(d)

    rows = []
    unmatched = []
    used_ids = set()
    for lvl in ("A1", "A2"):
        for e in struct[lvl]:
            word, pos = e["wordEN"], e["pos"]
            gloss = (e.get("gloss") or "").lower()
            key = (word or "").lower()
            doc_id = "ox_%s_%04d" % (lvl.lower(), len(rows) + 1)
            match = ""
            if key in byword:
                # รอบ 1: level ตรงกัน และยังไม่ถูกใช้
                for d in byword[key]:
                    if d["id"] in used_ids:
                        continue
                    if (d.get("cefrLevel") or d.get("level")) == lvl:
                        match = d["id"]
                        break
                # รอบ 2: doc ที่ไม่มี level (legacy) และยังไม่ถูกใช้
                if not match:
                    for d in byword[key]:
                        if d["id"] in used_ids:
                            continue
                        if not (d.get("cefrLevel") or d.get("level")):
                            match = d["id"]
                            break
                # รอบ 3: level ไม่ตรง (seed ติด label ผิด) — reuse แล้วแก้ level ตาม Oxford
                if not match:
                    for d in byword[key]:
                        if d["id"] not in used_ids:
                            match = d["id"]
                            break
            if match:
                used_ids.add(match)
            gkey = None
            if key == "second" and "next after" in gloss:
                gkey = "second|next_after_the_first"
            elif key == "second" and "unit" in gloss:
                gkey = "second|unit"
            keep_id = ""
            if gkey and (lvl, gkey) in HAND_TH:
                keep_id = match
            rows.append({
                "id": doc_id, "wordEN": word, "wordTH": "",
                "pos": pos, "cefrLevel": lvl,
                "matchWord": match, "keepId": keep_id,
                "keepWordTH": "", "gloss": e.get("gloss") or "",
            })
            if not match:
                unmatched.append((lvl, word, pos, e.get("gloss") or ""))

    print("rows:", len(rows))
    print("matched existing:", sum(1 for r in rows if r["matchWord"]))
    print("unmatched (need translation):", len(unmatched))

    print("existing docs NOT reused:")
    for d in exist:
        if d["id"] not in used_ids:
            print("  EXTRA:", d["id"], repr(d.get("wordEN")), d.get("wordTH"),
                  d.get("cefrLevel") or d.get("level"))

    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "wordEN", "wordTH", "pos",
                                          "cefrLevel", "matchWord", "keepId",
                                          "keepWordTH", "gloss"])
        w.writeheader()
        w.writerows(rows)
    print("written:", OUT)


if __name__ == "__main__":
    main()
