# backend/scripts/patch_seeds.py
# แก้ seed ทั้ง 2 ฝั่งให้ชี้ไปที่ data ชุดเดียวกัน (data/oxford_vocabulary.json = 1,772 คำ)
#  - backend/seed.js          : แทนที่อาร์เรย์ OXFORD_A1/A2 ด้วย require + แก้ payload
#  - frontend/scripts/oxfordVocabSeed.js : generate อาร์เรย์ ESM ให้ seedFirestore.js import
# รัน: python backend/scripts/patch_seeds.py   (ทำซ้ำได้ — ตรวจว่า patch แล้วจะไม่ทำซ้ำ)
import io, os, json, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "..")
SEED = os.path.join(ROOT, "backend", "seed.js")
FE_SEED_DIR = os.path.join(ROOT, "frontend", "scripts")
FE_MODULE = os.path.join(FE_SEED_DIR, "oxfordVocabSeed.js")
DATA = os.path.join(ROOT, "backend", "data", "oxford_vocabulary.json")

NEW_BLOCK = """// ══════════════════════════════════════════════════════════════════════════════
// Oxford 3000 — A1 + A2 (1,772 คำ: A1 900 / A2 872)
// source: data/oxford_vocabulary.json (สร้างด้วย scripts/build_seed_data.py)
// ══════════════════════════════════════════════════════════════════════════════
const ALL_VOCAB = require('./data/oxford_vocabulary.json');
const OXFORD_A1 = ALL_VOCAB.filter((v) => v.cefrLevel === 'A1');
const OXFORD_A2 = ALL_VOCAB.filter((v) => v.cefrLevel === 'A2');"""

NEW_PAYLOAD = ("      batch.set(ref, { wordEN: v.wordEN, wordTH: v.wordTH, cefrLevel: v.cefrLevel, "
               "partOfSpeech: v.partOfSpeech || '', ttsVoice: '' }, { merge: true });")


def _load(p):
    text = open(p, encoding="utf-8", newline="").read()
    nl = "\r\n" if "\r\n" in text else "\n"
    return text.replace("\r\n", "\n"), nl


def _save(p, text, nl):
    if nl != "\n":
        text = text.replace("\n", nl)
    open(p, "w", encoding="utf-8", newline="").write(text)


def patch_backend_seed():
    text, nl = _load(SEED)

    if "require('./data/oxford_vocabulary.json')" in text:
        print("backend/seed.js: patch แล้วข้าม")
        return

    lines = text.split("\n")
    # หาขอบเขต: จากบรรทัด header 'Oxford 3000 — A1 Level' (ก่อน const OXFORD_A1)
    # ถึงบรรทัด const ALL_VOCAB = ...
    start = None
    end = None
    for i, ln in enumerate(lines):
        if ln.startswith("const OXFORD_A1 = ["):
            start = i - 1  # include header comment block 1 บรรทัดเหนือขึ้นไป
            # ถอยไปจนถึงบรรทัด // ═══ ที่เริ่ม header
            while start > 0 and lines[start - 1].startswith("//"):
                start -= 1
        if ln.startswith("const ALL_VOCAB = ["):
            end = i
            break
    if start is None or end is None:
        sys.exit("patch_backend_seed: หาขอบเขตไม่พบ")

    lines[start:end + 1] = NEW_BLOCK.split("\n")

    text = "\n".join(lines)

    # แก้ payload seedVocabulary (batch.set ของ vocabulary)
    old_payload = "      batch.set(ref, { wordEN: v.wordEN, wordTH: v.wordTH, cefrLevel: v.level, level: v.level, ttsVoice: '' });"
    if old_payload not in text:
        sys.exit("patch_backend_seed: ไม่พบ payload เดิม")
    text = text.replace(old_payload, NEW_PAYLOAD)

    # คอมเมนต์บอกจำนวนคำเดิม
    text = text.replace("// รวม = 60 คำ ใช้จาก OXFORD_A1 (มี 100 คำ พอสมควร)",
                        "// รวม = 60 คำ ใช้จาก OXFORD_A1 (900 คำ)")

    _save(SEED, text, nl)
    print("backend/seed.js: patch แล้ว")


def generate_frontend_module():
    data = json.load(open(DATA, encoding="utf-8"))
    assert len(data) == 1772
    out = []
    out.append("// frontend/scripts/oxfordVocabSeed.js")
    out.append("// AUTO-GENERATED จาก backend/data/oxford_vocabulary.json (Oxford 3000 A1+A2 = 1,772 คำ)")
    out.append("// สร้างใหม่ด้วย: python backend/scripts/patch_seeds.py (หรือ build_seed_data.py แล้วรันไฟล์นี้)")
    out.append("// อย่าแก้ไฟล์นี้ด้วยมือ")
    out.append("export default [")
    for v in data:
        w = json.dumps(v["wordEN"], ensure_ascii=False)
        t = json.dumps(v["wordTH"], ensure_ascii=False)
        p = json.dumps(v.get("partOfSpeech", ""), ensure_ascii=False)
        out.append("  { id:%s, wordEN:%s, wordTH:%s, level:%s, cefrLevel:%s, partOfSpeech:%s },"
                   % (json.dumps(v["id"]), w, t,
                      json.dumps(v["cefrLevel"]), json.dumps(v["cefrLevel"]), p))
    out.append("];")
    open(FE_MODULE, "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
    print("frontend/scripts/oxfordVocabSeed.js: generate แล้ว (%d คำ)" % len(data))


def patch_frontend_seed():
    p = os.path.join(FE_SEED_DIR, "seedFirestore.js")
    text, nl = _load(p)
    if "oxfordVocabSeed" in text:
        print("frontend/scripts/seedFirestore.js: patch แล้วข้าม")
        return
    lines = text.split("\n")
    start = end = None
    for i, ln in enumerate(lines):
        if ln.startswith("const OXFORD_VOCAB = ["):
            start = i
        if start is not None and ln.strip() == "];" and i > start:
            end = i
            break
    if start is None or end is None:
        sys.exit("patch_frontend_seed: หาขอบเขตไม่พบ")
    lines[start:end + 1] = ["import OXFORD_VOCAB from './oxfordVocabSeed';"]
    text = "\n".join(lines)

    old_payload = """    await setDoc(doc(db, 'vocabulary', vocab.id), {
      wordEN: vocab.wordEN,
      wordTH: vocab.wordTH,
      cefrLevel: vocab.level,
      level: vocab.level,
      ttsVoice: '',
    });"""
    new_payload = """    await setDoc(doc(db, 'vocabulary', vocab.id), {
      wordEN: vocab.wordEN,
      wordTH: vocab.wordTH,
      cefrLevel: vocab.cefrLevel ?? vocab.level,
      partOfSpeech: vocab.partOfSpeech || '',
      ttsVoice: '',
    }, { merge: true });"""
    if old_payload not in text:
        sys.exit("patch_frontend_seed: ไม่พบ payload เดิม")
    text = text.replace(old_payload, new_payload)

    _save(p, text, nl)
    print("frontend/scripts/seedFirestore.js: patch แล้ว")


if __name__ == "__main__":
    patch_backend_seed()
    generate_frontend_module()
    patch_frontend_seed()
