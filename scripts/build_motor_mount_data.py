"""Generate src/proto/demoData/motorMountClosedLoop.js (Closed Loop → "Defects & why", and the
Production Board's Motor Mount cycle time) from the real Motor Mount job files.

Inputs (read-only):
  ShiaanX/Claude output for program sheet/Manufactured parts/Motor Mount/
    Inspection Report/Inspection Report_motor mount.xlsx   batch-1 QC (P1–P2)
    CAM Program/ncprograms/ncprograms/{1st,2nd,3rd} setting/*.tap   batch-1 PowerMill programs
    actual_process.json, override_log.json, MOTOR MOUNT_baseline_accuracy_steps2to5.json
    MOTOR MOUNT_features.json (CAD holes, planes, bounding box)
  G:/My Drive/Closed Loop/Clean Data/Motor Mount_TS/
    Inspection Report_TS/Inspection Report_motor mount.xlsx      batch-2 QC (P1–P9)
    CAM files_TS/*.MPF                                            batch-2 Sinumerik programs (+ programmer times)
Output:
  src/proto/demoData/motorMountClosedLoop.js. Every block carries a `source` path.

Run (needs openpyxl; the `occ` conda env has it), from the repo root:
  "C:/Users/Siddhant Gupta/miniconda3/envs/occ/python.exe" scripts/build_motor_mount_data.py src/proto/demoData/motorMountClosedLoop.js

Nothing is typed in by hand except (a) which drawing callout each inspection row is (read off
`motor mount.pdf`) and (b) the geometric query used to find the toolpaths that cut it. The toolpaths
themselves are found by scanning the G-code against the CAD geometry (see LINKS below).
"""
import json, math, os, re, sys, glob
from collections import defaultdict
import openpyxl

MM = r"C:\Users\Siddhant Gupta\Documents\ShiaanX\Claude output for program sheet\Manufactured parts\Motor Mount"
TS = r"G:\My Drive\Closed Loop\Clean Data\Motor Mount_TS"
REL_MM = "Claude output for program sheet/Manufactured parts/Motor Mount"
REL_TS = "G:/My Drive/Closed Loop/Clean Data/Motor Mount_TS"
RUN1_TAP = os.path.join(MM, "CAM Program", "ncprograms", "ncprograms")
RUN2_MPF = os.path.join(TS, "CAM files_TS")
tok = re.compile(r'([A-Z])([-+]?\d*\.?\d*)')

# ---------------------------------------------------------------- CAD
feat = json.load(open(os.path.join(MM, "MOTOR MOUNT_features.json")))
bb = feat["bounding_box"]
CY = (bb["ymin"] + bb["ymax"]) / 2
holes = {}
for h in feat["holes_detected"]:
    a = h["axis_direction"]
    if abs(a["z"]) < 0.99:
        continue
    k = (round(h["diameter"], 3), round(h["axis_location"]["x"], 2), round(h["axis_location"]["y"], 2))
    holes[k] = h
def holes_of(d):
    return sorted({(k[1], k[2]) for k in holes if abs(k[0] - d) < 1e-3})
planes = defaultdict(float)
for fa in feat["faces"]["faces"]:
    if fa.get("surface_type") != "Plane":
        continue
    n = fa["plane"]["normal"]; o = fa["plane"]["origin"]
    if abs(abs(n["z"]) - 1) < 1e-3:
        planes[(round(o["z"], 2), 1 if n["z"] > 0 else -1)] += fa["area"]
bore161 = [h for h in feat["holes_detected"] if abs(h["diameter"] - 16.1) < 1e-3]

# Setup frames, inferred from the G-code itself: the hole centres of every Ø2.529/Ø3/Ø3.2 CAD hole
# land on tool-centre paths (and on the TS drill-cycle positions) under X = cadY - cy, Y = cadX; the
# finishing floors of setting 1 sit at Z = -cadZ - 8 (CAD z=0 face -> Z-8.00, z=-8 -> Z0) and of
# setting 2 at Z = cadZ - 12.5 (z=1.5 -> Z-11, z=3.5 -> Z-9, z=5 -> Z-7.5, z=12.5 -> Z0).
FRAME = {
    "top":  {"xy": lambda x, y: (y - CY, x), "z": lambda z: -z - 8.0},
    "flip": {"xy": lambda x, y: (-(y - CY), x), "z": lambda z: z - 12.5},
    # TS setup 2 is flipped about the long axis instead: same XY as setting 1 (its "3 DRILL" cycle sits
    # at X-44.289/-24.288, Y±15 = the CAD Ø3 holes), Z as the PowerMill flip.
    "flipX": {"xy": lambda x, y: (y - CY, x), "z": lambda z: z - 12.5},
}

# ---------------------------------------------------------------- G-code parsing
def parse_sections(fn, split_msg):
    txt = open(fn, errors="ignore").read()
    tdia, ttype = {}, {}
    for t, typ, d in re.findall(r'=> (T\d+) \|\s*([^|]*?)\s*\|\s*D([\d.]+)', txt):
        tdia[t] = float(d); ttype[t] = typ.strip()
    times = {}
    for m in re.finditer(r'MSG\("(.*?)=\s*(\d+):(\d\d):(\d\d)\s*"\)', txt):
        times[m.group(1).strip()] = int(m.group(2)) * 60 + int(m.group(3)) + int(m.group(4)) / 60
    secs = []; cur = None
    hdr = dict((k.strip(), v.strip()) for k, v in re.findall(r'N\d+\(\s*([A-Z .]+?)\s*:(.*?)\)', txt))
    if not split_msg:
        dia = float(re.search(r'([\d.]+)', hdr.get("TOOL DIA.", "0")).group(1))
        cur = {"name": hdr.get("TOOLPATH"), "file": os.path.basename(fn), "dia": dia, "type": hdr.get("TOOL TYPE"),
               "S": [], "F": defaultdict(float), "pts": [], "floors": defaultdict(float), "cutLen": 0.0, "feedMin": 0.0, "drill": []}
        secs.append(cur)
    x = y = z = 0.0; mode = 0; tool = None; feed = 0.0; mcall = False
    for raw in txt.splitlines():
        line = raw.strip()
        mt = re.match(r'(T\d+)\s*;', line)
        if mt: tool = mt.group(1)
        mm = re.match(r'MSG\("(.*?)=', line)
        if split_msg and mm:
            nm = mm.group(1).strip()
            cur = {"name": nm, "file": os.path.basename(fn), "tool": tool, "dia": tdia.get(tool), "type": ttype.get(tool),
                   "programmerMin": times.get(nm), "S": [], "F": defaultdict(float), "pts": [], "floors": defaultdict(float),
                   "cutLen": 0.0, "feedMin": 0.0, "drill": []}
            secs.append(cur); continue
        if line.startswith(";"): continue
        if line.startswith("MCALL CYCLE"): mcall = True; continue
        if line == "MCALL": mcall = False; continue
        line = re.sub(r'CR=[-\d.]+', '', line.split(";")[0])
        if "(" in line: line = line[:line.index("(")]
        w = {}; gs = []
        for k, v in tok.findall(line):
            if v in ("", "+", "-", "."): continue
            if k == "G": gs.append(float(v))
            else: w[k] = float(v)
        for g in gs:
            if g in (0, 1, 2, 3): mode = int(g)
        if cur is not None and "S" in w: cur["S"].append(w["S"])
        if "F" in w: feed = w["F"]
        if 28 in gs or not any(k in w for k in "XYZ"): continue
        nx, ny, nz = w.get("X", x), w.get("Y", y), w.get("Z", z)
        if cur is not None:
            if mcall and mode == 0 and ("X" in w or "Y" in w): cur["drill"].append((nx, ny))
            if mode != 0:
                d = math.dist((x, y, z), (nx, ny, nz))
                cur["cutLen"] += d
                if feed > 0: cur["feedMin"] += d / feed
                cur["F"][feed] += d
                if abs(nz - z) < 1e-6: cur["floors"][round(nz, 2)] += math.dist((x, y), (nx, ny))
                n = max(1, int(math.dist((x, y), (nx, ny)) / 0.25))
                for i in range(n + 1):
                    t = i / n; cur["pts"].append((x + (nx - x) * t, y + (ny - y) * t, z + (nz - z) * t))
        x, y, z = nx, ny, nz
    return secs

# Run 1: PowerMill .tap, one toolpath per file, folders = settings.
run1_tp = []
setting_dirs = {"1st setting": 1, "2nd setting": 2, "3rd setting": 3}
for d, s in setting_dirs.items():
    for fn in sorted(glob.glob(os.path.join(RUN1_TAP, d, "*.tap"))):
        sec = parse_sections(fn, False)[0]; sec["setup"] = s; run1_tp.append(sec)
ap = json.load(open(os.path.join(MM, "actual_process.json")))["actual_process"]
ap_by_file = {r["file"]: r for r in ap}
# Run 2: Sinumerik MPF, toolpaths = MSG sections, files = setups.
run2_tp = []
for s, fn in enumerate(sorted(glob.glob(os.path.join(RUN2_MPF, "*.MPF"))), start=1):
    for sec in parse_sections(fn, True):
        sec["setup"] = s; run2_tp.append(sec)
FRAME_OF = {("run1", 1): "top", ("run1", 2): "flip", ("run2", 1): "top", ("run2", 2): "flipX", ("run2", 3): "top"}
UP_SIDE = {"top": False, "flip": True, "flipX": True}  # True = machines the CAD +z-facing faces
BORE_SETUP = {"run1": 3, "run2": 4}

# ---------------------------------------------------------------- geometric queries
def q_holes(run, tps, d, keep=lambda x, y: True):
    """Toolpaths whose tool fits inside the CAD hole and whose centre path stays inside it at >=1 hole,
    or drill cycles positioned on the hole centre."""
    found = {}
    centres = [c for c in holes_of(d) if keep(*c)]
    for tp in tps:
        fr = FRAME_OF.get((run, tp["setup"]))
        if not fr or not tp["dia"] or tp["dia"] > d + 1e-6: continue
        lim = (d - tp["dia"]) / 2 + 0.05
        hit = 0
        for (hx, hy) in centres:
            gx, gy = FRAME[fr]["xy"](hx, hy)
            if any(math.hypot(px - gx, py - gy) < 0.05 for (px, py) in tp["drill"]) or \
               (lambda inside: len(inside) >= 20 and max(inside) - min(inside) >= 1.0)(
                   [p[2] for p in tp["pts"] if math.hypot(p[0] - gx, p[1] - gy) <= lim]):
                hit += 1
        if hit: found[tp["name"]] = f"{hit} of {len(centres)} CAD Ø{d:g} hole centres"
    return found

def q_floor(run, tps, cad_z, normal):
    found = {}
    for tp in tps:
        fr = FRAME_OF.get((run, tp["setup"]))
        if not fr: continue
        if UP_SIDE[fr] != (normal > 0): continue
        gz = round(FRAME[fr]["z"](cad_z), 2)
        L = sum(v for k, v in tp["floors"].items() if abs(k - gz) <= 0.011)
        if L >= 50 and (tp["type"] or "").upper().replace(" ", "") in ("ENDMILL", "BULLNOSEMILL", "BALLNOSE", "BALLNOSED"):
            found[tp["name"]] = f"{L:.0f} mm of flat cutting at Z{gz:.2f} (CAD z={cad_z:g} face)"
    return found

def q_wall(run, tps, w, up_side):
    """Lower body = CAD y from ymin to -33 (where the Ø16.1 bore body is)."""
    found = {}
    for tp in tps:
        fr = FRAME_OF.get((run, tp["setup"]))
        if not fr or UP_SIDE[fr] != up_side or not tp["dia"]: continue
        x0 = FRAME[fr]["xy"](0, bb["ymin"])[0]; x1 = FRAME[fr]["xy"](0, -33.0)[0]
        lo, hi = min(x0, x1), max(x0, x1)
        R = tp["dia"] / 2
        n = sum(1 for p in tp["pts"] if lo <= p[0] <= hi and abs(abs(p[1]) - (w + R)) <= 0.06)
        if n >= 40: found[tp["name"]] = f"tool centre runs at Y±{w + R:.1f} (wall ±{w:g} + R{R:g}) over the lower body"
    return found

def q_length(run, tps, half):
    found = {}
    for tp in tps:
        if FRAME_OF.get((run, tp["setup"])) != "top" or not tp["dia"] or not tp["pts"]: continue
        R = tp["dia"] / 2
        xs = [p[0] for p in tp["pts"]]
        if abs(max(xs) - R - half) <= 0.06 and abs(-min(xs) - R - half) <= 0.06:
            found[tp["name"]] = f"profile pass: tool centre at X±{max(xs):.2f} − R{R:g} = ±{max(xs) - R:.2f}"
    return found

def q_bore(run, tps, d):
    found = {}
    for tp in tps:
        if tp["setup"] != BORE_SETUP[run] or not tp["dia"] or not tp["pts"]: continue
        R = tp["dia"] / 2
        xs = [p[0] for p in tp["pts"]]; ys = [p[1] for p in tp["pts"]]
        r = max(max(xs) - min(xs), max(ys) - min(ys)) / 2
        if abs(r + R - d / 2) <= 0.2:
            found[tp["name"]] = f"circular path r{r:.2f} + R{R:g} = Ø{2 * (r + R):.2f}"
    return found

z_planes = {k: v for k, v in planes.items()}
def cad_plane(z, n):
    assert (z, n) in z_planes, (z, n)
    return z

# Which drawing callout each inspection row is, and how its feature is found. 'cad' = the CAD value of
# the same dimension where it can be computed from the STEP features.
pitch = sorted({abs(x) for (x, y) in holes_of(2.529) if y > 0})
LINKS = {
    1: {"feature": "Ø16.1 bore (horizontal, through the lower body)", "cad": round(bore161[0]["diameter"], 3), "cadBasis": "MOTOR MOUNT_features.json holes_detected: Ø16.1, axis along Y",
        "query": lambda run, tps: q_bore(run, tps, 16.1), "confidence": "high"},
    2: {"feature": "Pitch between the two top corner holes", "cad": round(2 * pitch[0], 3), "cadBasis": f"CAD corner-hole centres at x = ±{pitch[0]:g} → {2 * pitch[0]:g} mm",
        "query": lambda run, tps: q_holes(run, tps, 2.529, lambda x, y: abs(x) > 20), "confidence": "high"},
    3: {"feature": "Overall length", "cad": round(bb["length_y"], 3), "cadBasis": "MOTOR MOUNT_features.json bounding_box.length_y",
        "query": lambda run, tps: q_length(run, tps, bb["length_y"] / 2), "confidence": "high"},
    4: {"feature": "Ø3.2 motor-mounting holes (7, round the centre bore)", "cad": 3.2, "cadBasis": f"{len(holes_of(3.2))} CAD holes Ø3.2",
        "query": lambda run, tps: q_holes(run, tps, 3.2), "confidence": "high"},
    5: {"feature": "Ø3.2 motor-mounting holes (7, round the centre bore)", "cad": 3.2, "cadBasis": f"{len(holes_of(3.2))} CAD holes Ø3.2",
        "query": lambda run, tps: q_holes(run, tps, 3.2), "confidence": "high"},
    6: {"feature": "Corner holes (tapped)", "cad": 2.529, "cadBasis": "4 CAD corner holes Ø2.529 (M3 tap-drill size) at x=±23 / ±21.63",
        "query": lambda run, tps: q_holes(run, tps, 2.529, lambda x, y: abs(x) > 20), "confidence": "high"},
    7: {"feature": "Tab width (12)", "cad": None, "cadBasis": "not computed",
        "query": lambda run, tps: q_wall(run, tps, 6, False), "confidence": "low"},
    8: {"feature": "Ø3 holes in the lower body (4)", "cad": 3.0, "cadBasis": "4 CAD holes Ø3.0 at x=±15, y=-45/-65",
        "query": lambda run, tps: q_holes(run, tps, 3.0), "confidence": "high"},
    9: {"feature": "Lower body width, setting-1 side (18)", "cad": None, "cadBasis": "not computed",
        "query": lambda run, tps: q_wall(run, tps, 9, False), "confidence": "low"},
    10: {"feature": "Lower body width, setting-2 side (22)", "cad": None, "cadBasis": "not computed",
        "query": lambda run, tps: q_wall(run, tps, 11, True), "confidence": "low"},
    11: {"feature": "Plate thickness at the rim (3.5): z=0 face → z=3.5 face", "cad": cad_plane(3.5, 1) - cad_plane(0.0, -1), "cadBasis": "CAD planes z=0 (down) and z=3.5 (up)",
        "query": lambda run, tps: {**q_floor(run, tps, 0.0, -1), **q_floor(run, tps, 3.5, 1)}, "confidence": "medium", "crossSetup": True},
    12: {"feature": "Step height (2): z=1.5 floor → z=3.5 face", "cad": cad_plane(3.5, 1) - cad_plane(1.5, 1), "cadBasis": "CAD planes z=1.5 and z=3.5 (both up)",
        "query": lambda run, tps: {**q_floor(run, tps, 1.5, 1), **q_floor(run, tps, 3.5, 1)}, "confidence": "medium", "crossSetup": False},
    13: {"feature": "Plate thickness (5): z=0 face → z=5 face", "cad": cad_plane(5.0, 1) - cad_plane(0.0, -1), "cadBasis": "CAD planes z=0 (down) and z=5 (up)",
        "query": lambda run, tps: {**q_floor(run, tps, 0.0, -1), **q_floor(run, tps, 5.0, 1)}, "confidence": "medium", "crossSetup": True},
}

# ---------------------------------------------------------------- inspection reports
def num_list(v):
    if v is None: return []
    if isinstance(v, (int, float)): return [float(v)]
    out = []
    for p in str(v).split("/"):
        try: out.append(float(p))
        except ValueError: pass
    return out

def read_report(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    dims = {}
    for ws in wb:
        rows = list(ws.iter_rows(values_only=True))
        hi = next(i for i, r in enumerate(rows) if r[0] == "SL No.")
        pieces_row = rows[hi + 1]
        remark_col = rows[hi].index("Remark")
        pcols = [(i, pieces_row[i]) for i in range(5, remark_col) if pieces_row[i]]
        for r in rows[hi + 2:]:
            if not isinstance(r[0], int): continue
            sl = r[0]
            desc = str(r[1]).replace("\ufffd", "Ø").replace("�", "Ø").strip()
            is_dia = "Ø" in desc
            try: nominal = float(desc.replace("Ø", "").strip())
            except ValueError: nominal = None
            d = dims.setdefault(sl, {"sl": sl, "label": desc, "nominal": nominal, "isDia": is_dia,
                                     "tolPlus": r[2] if isinstance(r[2], (int, float)) else None,
                                     "tolMinus": r[3] if isinstance(r[3], (int, float)) else None,
                                     "instrument": r[4], "remark": (str(r[remark_col]).strip() if r[remark_col] else None),
                                     "readings": {}, "notes": {}})
            # Run-1 sheet has a single P1 header but values in two columns (P1, P2: QTY 02).
            cols = pcols if len(pcols) > 1 else [(5, "P1"), (6, "P2")]
            for i, piece in cols:
                if pieces_row.count(piece) > 1 and r[i] is None: continue
                vals = num_list(r[i])
                if vals: d["readings"][piece] = vals
                elif r[i] is not None: d["notes"][piece] = str(r[i]).strip()
    return [dims[k] for k in sorted(dims)]

run1_dims = read_report(os.path.join(MM, "Inspection Report", "Inspection Report_motor mount.xlsx"))
run2_dims = read_report(os.path.join(TS, "Inspection Report_TS", "Inspection Report_motor mount.xlsx"))

# ---------------------------------------------------------------- toolpath records
override = json.load(open(os.path.join(MM, "override_log.json")))["overrides"]
steps = json.load(open(os.path.join(MM, "MOTOR MOUNT_baseline_accuracy_steps2to5.json")))
param_checks = {}
for s in steps["per_setup_detail"]:
    for pc in s.get("parameter_checks", []):
        param_checks[(s["setup_id"], pc["tool_diameter_mm"])] = pc["checks"]

def main_feed(tp):
    if not tp["F"]: return None
    return max(tp["F"].items(), key=lambda kv: kv[1])[0]

def role_of(run, tp):
    if tp["drill"] or "DRILL" in (tp["name"] or "").upper(): return "drill"
    if run == "run1": return "rough" if float(ap_by_file[tp["file"]]["stock_mm"]) > 0.05 else "finish"
    return "rough" if re.search(r'RF|DYNAMIC|DYAMNIC', tp["name"]) else "finish"

def tp_record(run, tp):
    rec = {"role": role_of(run, tp), "name": tp["name"], "setup": tp["setup"], "toolType": tp["type"], "toolDia": tp["dia"],
           "spindleRpm": (max(set(tp["S"]), key=tp["S"].count) if tp["S"] else None), "mainFeed": main_feed(tp),
           "feedTimeMin": round(tp["feedMin"], 2)}
    if run == "run1":
        a = ap_by_file[tp["file"]]
        rec.update({"file": tp["file"], "toolId": a["tool_id"], "toolLength": a["tool_length_mm"], "stockMm": float(a["stock_mm"]),
                    "spindleRpm": a["spindle_rpm"], "cuttingFeed": a["cutting_feed_mm_min"],
                    "source": f"{REL_MM}/actual_process.json + CAM Program/ncprograms/{list(setting_dirs)[tp['setup'] - 1]}/{tp['file']}"})
        ov = [o for o in override if o["setup"] == tp["setup"] and o.get("tool_diameter_mm") == tp["dia"] and o["type"] in ("rpm_delta", "tool_used_not_predicted") and o["category"] == "milling"]
        rec["overrides"] = [{"type": o["type"], "detail": o["detail"], "predictedRpm": o.get("predicted_rpm"), "actualRpm": o.get("actual_rpm"),
                             "source": f"{REL_MM}/override_log.json"} for o in ov]
        pc = param_checks.get((tp["setup"], tp["dia"]))
        if pc and "feed" in pc:
            rec["cappFeed"] = {"predicted": pc["feed"]["predicted"], "actual": pc["feed"]["actual"], "source": f"{REL_MM}/MOTOR MOUNT_baseline_accuracy_steps2to5.json"}
    else:
        rec.update({"file": tp["file"], "tool": tp.get("tool"), "programmerMin": round(tp["programmerMin"], 2) if tp.get("programmerMin") is not None else None,
                    "isDrillCycle": bool(tp["drill"]), "source": f"{REL_TS}/CAM files_TS/{tp['file']} (MSG \"{tp['name']}\")"})
    return rec

runs_out = []
for run, label, tps, dims, insp_src, cam_src, machine in [
    ("run1", "Batch 1 — PowerMill program, 3 settings", run1_tp, run1_dims, f"{REL_MM}/Inspection Report/Inspection Report_motor mount.xlsx", f"{REL_MM}/CAM Program/ncprograms/", "not recorded"),
    ("run2", "Batch 2 — Sinumerik 828D program, 4 setups (TS machine)", run2_tp, run2_dims, f"{REL_TS}/Inspection Report_TS/Inspection Report_motor mount.xlsx", f"{REL_TS}/CAM files_TS/", "TS (Sinumerik 828D)"),
]:
    links = {}
    for sl, L in LINKS.items():
        found = L["query"](run, tps)
        links[sl] = [{"toolpath": k, "evidence": v} for k, v in found.items()]
    runs_out.append({
        "id": run, "label": label, "machine": machine,
        "inspectionSource": insp_src, "camSource": cam_src,
        "pieces": sorted({p for d in dims for p in d["readings"]} | {p for d in dims for p in d["notes"]}, key=lambda s: int(s[1:])),
        "dims": [{**d, "source": insp_src} for d in dims],
        "toolpaths": [tp_record(run, tp) for tp in tps],
        "links": links,
    })

features = {sl: {"feature": L["feature"], "cad": L["cad"], "cadBasis": L["cadBasis"], "linkConfidence": L["confidence"], "crossSetup": L.get("crossSetup")}
            for sl, L in LINKS.items()}

# Cycle time: the TS programmer's own per-tool times (MPF header, ';time =' lines), per setup.
cycle_setups = []
for s, fn in enumerate(sorted(glob.glob(os.path.join(RUN2_MPF, "*.MPF"))), start=1):
    txt = open(fn, errors="ignore").read()
    mins = sum(int(h) * 60 + int(m) + int(sx) / 60 for h, m, sx in re.findall(r';\s*time\s*=\s*(\d+):(\d\d):(\d\d)', txt))
    cycle_setups.append({"setup": s, "file": os.path.basename(fn), "minutes": round(mins, 2), "source": f"{REL_TS}/CAM files_TS/{os.path.basename(fn)}"})
run1_feed_min = round(sum(tp["feedMin"] for tp in run1_tp), 1)

out = {
    "part": "Motor Mount", "partNumber": "SX_2627_007", "material": "Aluminium (job.json: aluminium_6061; quotation Q_SX_2627_007: Al 6063)",
    "cad": {"source": f"{REL_MM}/MOTOR MOUNT_features.json", "drawing": f"{REL_MM}/motor mount.pdf"},
    "frames": "Setup frames inferred from the G-code: X = cadY − cy, Y = cadX; setting 1 Z = −cadZ − 8, setting 2 Z = cadZ − 12.5 (TS setup 2 is flipped about the long axis: same XY as setting 1). Every Ø2.529/Ø3/Ø3.2 CAD hole centre lands on a tool path or drill-cycle position under this mapping.",
    "telemetry": "No machine telemetry for Motor Mount: neither machine was connected to the closed-loop collector (closed-loop repo krishna_metrics.json has only the two STM/Krishna parts). Operator overrides on the machine are therefore unknown; 'overrides' below are programmer-vs-auto-plan differences from override_log.json.",
    "features": features,
    "runs": runs_out,
    "cycleTime": {
        "programmerMinutesPerPart": round(sum(c["minutes"] for c in cycle_setups), 1),
        "setups": cycle_setups,
        "basis": "Sum of the programmer's per-tool machining times in the TS program headers (';time =' lines, Sinumerik 828D). Excludes load/unload and setup changeovers.",
        "alternative": {"minutes": run1_feed_min, "basis": "Batch-1 PowerMill program: sum of feed-move length ÷ programmed feed over all 20 .tap files (computed, not stated by the programmer; rapids excluded).",
                        "source": f"{REL_MM}/CAM Program/ncprograms/"},
    },
}

js = ("// GENERATED by scripts/build_motor_mount_data.py from the real Motor Mount files — do not edit by hand.\n"
      "// Every block names the file it came from (`source`). Regenerate rather than hand-editing values.\n"
      "// Inspection: local report (batch 1, P1–P2) and the TS report (batch 2, P1–P9). CAM: PowerMill .tap\n"
      "// (batch 1) and Sinumerik MPF (batch 2). Toolpath↔dimension links come from a geometric scan of the\n"
      "// G-code against the CAD features; each link carries its evidence.\n"
      "const MOTOR_MOUNT_CLOSED_LOOP = " + json.dumps(out, indent=1, ensure_ascii=False) + ";\n\nexport default MOTOR_MOUNT_CLOSED_LOOP;\n")
open(sys.argv[1], "w", encoding="utf-8").write(js)
print("written", sys.argv[1], len(js))
print("cycle", out["cycleTime"]["programmerMinutesPerPart"], cycle_setups, "alt", run1_feed_min)
for r in runs_out:
    print("==", r["id"], r["pieces"])
    for sl, l in r["links"].items():
        print("  ", sl, [x["toolpath"] for x in l])
