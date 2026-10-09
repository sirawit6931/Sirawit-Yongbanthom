# backend/scripts/merge_translations.py
# ประกบคำแปลจาก th_*.tsv เข้า oxford_final.csv
# - แถวที่ matchWord (มี doc เดิม) -> ใช้ wordTH เดิมจาก Firestore
# - แถวที่เหลือ -> ใช้คำแปลจาก th_*.tsv ตาม key = wordEN.lower()|pos|gloss
# ผล: oxford_final_filled.csv + รายงาน missing keys -> %TEMP%
import csv, json, glob, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# 1) อ่านไฟล์คำแปลทั้งหมด
trans = {}
dup_files = []
for f in sorted(glob.glob(os.path.join(HERE, "th_*.tsv"))):
    for ln, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.rstrip("\n").rstrip("\r")
        if not line:
            continue
        if "\t" not in line:
            dup_files.append("NO-TAB %s:%d %r" % (os.path.basename(f), ln, line))
            continue
        k, v = line.split("\t", 1)
        k = k.strip()
        v = v.strip()
        if k in trans and trans[k] != v:
            dup_files.append("CONFLICT %s: %r %r vs %r" % (k, os.path.basename(f), trans[k], v))
        trans[k] = v

# 2) wordTH เดิมจาก Firestore
exist = {d["id"]: d for d in json.load(open(os.path.join(HERE, "vocab_existing.json"), encoding="utf-8"))}

rows = list(csv.DictReader(open(os.path.join(HERE, "oxford_final.csv"), encoding="utf-8-sig")))
missing = []
filled = []
for r in rows:
    if r["matchWord"]:
        doc = exist.get(r["matchWord"])
        th = (doc or {}).get("wordTH", "")
        if not th:
            missing.append(("NO-EXIST-TH", r["id"], r["wordEN"], r["pos"], r["gloss"]))
            th = ""
    else:
        key = r["wordEN"].lower() + "|" + r["pos"] + "|" + r["gloss"]
        th = trans.get(key, "")
        if not th:
            missing.append(("NO-TRANS", r["id"], key, "", ""))
    rr = dict(r)
    rr["wordTH"] = th
    filled.append(rr)

out = os.path.join(HERE, "oxford_final_filled.csv")
with open(out, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(filled[0].keys()))
    w.writeheader()
    w.writerows(filled)

print("rows:", len(filled))
print("with TH:", sum(1 for r in filled if r["wordTH"]))
print("translations loaded:", len(trans))
print("problems:", len(dup_files))
for x in dup_files[:40]:
    print("  ", x)
print("missing:", len(missing))
for x in missing[:80]:
    print("  ", x)
print("written:", out)
