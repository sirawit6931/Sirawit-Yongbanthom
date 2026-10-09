# backend/scripts/extract_oxford_a1a2.py
# สกัดรายการคำศัพท์ Oxford 3000 ระดับ A1+A2 จาก PDF (ไม่พึ่ง library ภายนอก)
# รัน: python backend/scripts/extract_oxford_a1a2.py
# ผลลัพธ์: backend/scripts/oxford_raw_entries.json  ({"A1": [...], "A2": [...]})
#
# วิธีถอดรหัส: ติดตาม font ปัจจุบัน (Tf) ของแต่ละ text fragment แล้ว map byte
# ผ่าน ToUnicode CMap ของ font นั้น (ligature fi/fl/ffi/ff, homograph 1/2, nbsp)
import re, zlib, json, os, sys

PDF = r"c:/Users/arm75/Downloads/The_Oxford_3000_by_CEFR_level.pdf"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "oxford_raw_entries.json")

GT = bytes([62])  # '>' หลบตัวอักษรที่ถูก filter ใน Windows shell

# fallback สำหรับ MyriadPro subset: code ที่ไม่มีใน ToUnicode CMap
# (0x1A=fl, 0x1B=fi, 0x1C=ffi, 0x1D=ff ใช้ร่วมกันทุก subset;
#  0x1E/0x19 = เลข homograph 1/2, 0x1F = fi ligature ทุก subset)
FALLBACK_MYRIAD = {0x1A: "fl", 0x1B: "fi", 0x1C: "ffi", 0x1D: "ff",
                   0x1E: "1", 0x19: "2", 0x1F: "fi"}
REPLACEMENT = "�"


def get_pdf_objects(data):
    objs = {}
    for m in re.finditer(rb"(\d+) (\d+) obj(.*?)endobj", data, re.S):
        objs[(int(m.group(1)), int(m.group(2)))] = m.group(3)
    return objs


def get_stream(body):
    m = re.search(rb"stream(.*?)endstream", body, re.S)
    if not m:
        return None
    s = m.group(1).lstrip(b"\r\n").rstrip(b"\r\n")
    try:
        return zlib.decompress(s)
    except Exception:
        return s


def parse_cmap(raw):
    mp = {}
    txt = raw.decode("latin1", "replace")
    for m in re.finditer(r"beginbfchar(.*?)endbfchar", txt, re.S):
        for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", m.group(1)):
            mp[int(a, 16)] = bytes.fromhex(b).decode("utf-16-be", "replace")
    for m in re.finditer(r"beginbfrange(.*?)endbfrange", txt, re.S):
        for a, b, c in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[.*?\])",
                                  m.group(1), re.S):
            s0, s1 = int(a, 16), int(b, 16)
            if c.startswith("["):
                dsts = re.findall(r"<([0-9A-Fa-f]+)>", c)
                for i, dd in enumerate(dsts):
                    mp[s0 + i] = bytes.fromhex(dd).decode("utf-16-be", "replace")
            else:
                d0 = bytes.fromhex(c[1:-1]).decode("utf-16-be", "replace")
                for i in range(s1 - s0 + 1):
                    mp[s0 + i] = "".join(chr(ord(ch) + i) for ch in d0)
    return mp


def font_display_name(objs, key):
    body = objs.get(key, b"")
    m = re.search(rb"/FontName\s*/(\S+)", body) or re.search(rb"/BaseFont\s*/(\S+)", body)
    return m.group(1).decode("latin1") if m else "?"


def build_font_cmaps(objs):
    """คืน dict: font_obj_key -> (display_name, cmap_dict)"""
    out = {}
    for key, body in objs.items():
        if b"/ToUnicode" not in body:
            continue
        t = re.search(rb"/ToUnicode\s+(\d+)\s+(\d+)\s+R", body)
        if not t:
            continue
        raw = get_stream(objs.get((int(t.group(1)), int(t.group(2))), b""))
        out[key] = (font_display_name(objs, key), parse_cmap(raw) if raw is not None else {})
    return out


def page_font_aliases(objs, page_key):
    """คืน dict: 'T1_x' -> font_obj_key ของหน้านั้น (อ่านจาก /Font dict โดยตรง)"""
    body = objs.get(page_key, b"")
    m = re.search(rb"/Font\s*<<(.*?)>>", body, re.S)
    if not m:
        return {}
    out = {}
    for name, fn, fg in re.findall(rb"/(T1_\d+)\s+(\d+)\s+(\d+)\s+R", m.group(1)):
        out[name.decode("latin1")] = (int(fn), int(fg))
    return out


def decode_bytes(raw, cmap, fname):
    """ถอด byte string ด้วย CMap ของ font; เจอ code ที่ไม่มี map ใช้ fallback/REPLACEMENT"""
    s = []
    for b in raw:
        if b in cmap:
            s.append(cmap[b])
            continue
        if 0x20 <= b <= 0x7E:
            # ทุก subset ใช้ ASCII ตรงตัวในช่วงนี้ (ตรวจจาก CMap แล้ว)
            s.append(chr(b))
            continue
        if "MyriadPro" in fname and b in FALLBACK_MYRIAD:
            s.append(FALLBACK_MYRIAD[b])
            continue
        if b >= 0x80:
            # font แบบ WinAnsi (Utopia Bold/Italic) high byte = ตัวอักษรจริง
            try:
                s.append(bytes([b]).decode("cp1252"))
                continue
            except Exception:
                pass
        s.append(REPLACEMENT)
    return "".join(s)


def parse_literal(d, i):
    depth = 1; i += 1; buf = bytearray()
    specials = {0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12,
                0x28: 40, 0x29: 41, 0x5C: 92}
    while i != len(d) and depth:
        ch = d[i]
        if ch == 0x5C:
            i += 1
            if i == len(d):
                break
            n = d[i]
            if 0x30 <= n <= 0x37:
                oct_s = bytes([n]); i += 1
                for _ in range(2):
                    if i != len(d) and 0x30 <= d[i] <= 0x37:
                        oct_s += bytes([d[i]]); i += 1
                    else:
                        break
                buf.append(int(oct_s, 8) & 0xFF)
                continue
            if n in specials and not (0x30 <= n <= 0x37):
                buf.append(specials[n])
            else:
                buf.append(n)
            i += 1
            continue
        if ch == 0x28:
            depth += 1
        elif ch == 0x29:
            depth -= 1
        if depth:
            buf.append(ch)
        i += 1
    return bytes(buf), i

def extract_text(d, aliases, cmaps):
    """อ่าน content stream ของ PDF แล้วคืน list ของบรรทัด

    (ตัดบรรทัดตาม y-position; ถอด text ตาม font ปัจจุบันผ่าน Tf)"""
    lines = []; cur = []; last_y = [None]
    cur_font = [None]
    i = 0; stack = []

    def cur_cmap():
        key = cur_font[0]
        if key is not None and key in cmaps:
            return cmaps[key]
        return ("?", {})

    def flush():
        if cur:
            lines.append("".join(cur)); cur.clear()

    while i != len(d):
        c = d[i]
        if c in (0x20, 0x09, 0x0A, 0x0D):
            i += 1; continue
        if c == 0x28:  # literal string -> decode ด้วย font ปัจจุบัน
            raw, i = parse_literal(d, i)
            fname, cmap = cur_cmap()
            cur.append(decode_bytes(raw, cmap, fname))
            continue
        if c == 0x3C and (len(d) - i) != 1 and d[i + 1] != 0x3C and d[i + 1] != 0x3D:  # hex string
            j = d.find(GT, i)
            if j != -1:
                hx = re.sub(rb"[^0-9A-Fa-f]", b"", d[i + 1:j])
                if len(hx) % 2:
                    hx = hx[:-1]
                try:
                    fname, cmap = cur_cmap()
                    cur.append(decode_bytes(bytes.fromhex(hx.decode()), cmap, fname))
                except Exception:
                    pass
                i = j + 1; continue
        if c == 0x2F:  # ชื่อ resource เช่น /T1_2 (ใช้กับ Tf)
            m = re.match(rb"/([A-Za-z0-9_]+)", d[i:])
            if m:
                stack.append(m.group(1))
                i += m.end(); continue
        m = re.match(rb"[-+]?[0-9]*\.[0-9]+|[-+]?[0-9]+", d[i:])
        if m:
            try:
                stack.append(float(m.group(0)))
            except Exception:
                pass
            i += m.end(); continue
        m = re.match(rb"[A-Za-z'\"]{1,3}", d[i:])
        if m:
            op = m.group(0)
            if op == b"Tf" and stack:
                # stack: [..., fontName(bytes), size]
                name = stack[-2] if len(stack) >= 2 else None
                if isinstance(name, bytes):
                    aname = name.decode("latin1")
                    if aname in aliases:
                        cur_font[0] = aliases[aname]
            elif op in (b"Td", b"TD"):
                dy = stack[-1] if stack and isinstance(stack[-1], float) else 0.0
                if dy != 0:
                    flush()
                base = last_y[0] if last_y[0] is not None else 0.0
                last_y[0] = base + dy
            elif op == b"Tm":
                y = stack[-1] if stack and isinstance(stack[-1], float) else None
                if y is not None:
                    if last_y[0] is not None and y != last_y[0]:
                        flush()
                    last_y[0] = y
            elif op in (b"BT", b"ET", b"T*"):
                flush()
            stack = []
            i += m.end(); continue
        stack = []
        i += 1
    flush()
    return [x.strip() for x in lines]



def page_order(objs):
    root = None
    for key, body in objs.items():
        if b"/Type/Pages" in body and b"/Kids" not in body:
            root = key
            break
    if root is None:
        for key, body in objs.items():
            if b"/Type/Pages" in body:
                root = key
                break

    def kids_of(key):
        body = objs.get(key, b"")
        kk = re.findall(rb"(\d+) (\d+) R", body.split(b"/Kids")[1].split(b"]")[0])
        return [(int(a), int(b)) for a, b in kk]

    order = []

    def walk(key):
        body = objs.get(key, b"")
        if b"/Kids" in body:
            for k in kids_of(key):
                walk(k)
        else:
            order.append(key)

    walk(root)
    return order


def page_content_refs(objs, page_key):
    body = objs.get(page_key, b"")
    m = re.search(rb"/Contents\s+(\d+)\s+(\d+)\s+R", body)
    if m:
        return [(int(m.group(1)), int(m.group(2)))]
    m = re.search(rb"/Contents\s*\[(.*?)\]", body, re.S)
    if m:
        return [(int(a), int(b)) for a, b in re.findall(rb"(\d+) (\d+) R", m.group(1))]
    return []


def load_pages_v2(path):
    data = open(path, "rb").read()
    objs = get_pdf_objects(data)
    cmaps = build_font_cmaps(objs)
    pages = []
    for pkey in page_order(objs):
        aliases = page_font_aliases(objs, pkey)
        texts = []
        for ckey in page_content_refs(objs, pkey):
            raw = get_stream(objs.get(ckey, b""))
            if raw and (b"TJ" in raw or b"Tj" in raw):
                texts.append(extract_text(raw, aliases, cmaps))
        merged = []
        for t in texts:
            merged.extend(t)
        pages.append(merged)
    return pages


def load_pages(path):
    return load_pages_v2(path)


def load_pages_OLD(path):
    data = open(path, "rb").read()
    streams = []
    for m in re.finditer(rb"stream(.*?)endstream", data, re.S):
        s = m.group(1).lstrip(b"\r\n").rstrip(b"\r\n")
        try:
            d = zlib.decompress(s)
        except Exception:
            continue
        if b"TJ" in d or b"Tj" in d:
            streams.append(d)
    pages = [extract_text(d) for d in streams]
    pages.reverse()  # ใน PDF เรียงหน้าหลังกลับกัน (stream 0 = หน้าสุดท้าย)
    return pages


POS_ONLY = re.compile(r"^(n|v|adj|adv|prep|pron|conj|det|num|phr|exclam|interj|modal|aux|number)\.$")
POS = re.compile(r"(?<![a-zA-Z])(n|v|adj|adv|prep|pron|conj|det|num|phr|exclam|interj|modal|aux|article)\b")
SKIP = re.compile(
    r"^(.*(Oxford University Press).*|\d+ / 12|.*Oxford 3000.*|A1|A2|B1|B2"
    r"|The Oxford 3000 is the list.*|, from A1 to B2 level\.)$"
)


def is_entry(l):
    if SKIP.match(l):
        return False
    if POS.search(l):
        return True
    if re.match(r"^(the|a)[ ,].*article", l):
        return True
    if re.search(r"(?<![a-zA-Z])number$", l):
        return True
    return False


def merge_lines(lines):
    merged = []
    for l in lines:
        if not l:
            continue
        # บรรทัดที่เป็น ',' ต่อท้าย หรือ POS ล้วน (n. / adj. / number) -> ต่อเข้าบรรทัดก่อนหน้า
        if merged and (l.startswith(",") or POS_ONLY.match(l)
                       or (l == "number" and not merged[-1].endswith("number"))):
            sep = " " if (POS_ONLY.match(l) or l == "number") else ""
            merged[-1] += sep + l
        else:
            merged.append(l)
    return merged


def main():
    if not os.path.exists(PDF):
        print("PDF not found:", PDF)
        sys.exit(1)
    pages = load_pages(PDF)

    flat = []; marker_pos = {}
    for pg in range(1, len(pages) + 1):
        for l in pages[pg - 1]:
            if l in ("A1", "A2", "B1", "B2"):
                marker_pos[l] = len(flat)
            flat.append(l)

    bounds = {
        "A1": (marker_pos["A1"], marker_pos["A2"]),
        "A2": (marker_pos["A2"], marker_pos["B1"]),
    }

    result = {}
    for lvl, (a, b) in bounds.items():
        seg = merge_lines(flat[a:b])
        entries = [l for l in seg if is_entry(l)]
        result[lvl] = entries

    print("A1 entries:", len(result["A1"]))
    print("A2 entries:", len(result["A2"]))
    print("TOTAL:", len(result["A1"]) + len(result["A2"]))

    # รายงานบรรทัดที่มี control char (glyph ดึงไม่ครบ) หรือมีวงเล็บ (gloss)
    for lvl in ("A1", "A2"):
        for e in result[lvl]:
            if any(ord(ch) < 32 for ch in e) or "(" in e:
                print("  [%s] %r" % (lvl, e))

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=1)
    print("written:", OUT)


if __name__ == "__main__":
    main()
