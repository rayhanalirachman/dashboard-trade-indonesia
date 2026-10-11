"""Bangun data.js untuk dashboard dari ekspor WITS (CSV) dan peta Plotly.

Pemakaian:  python3 tools/build_data.py [path/ke/DataJobID-xxx.csv]
Tanpa argumen, dipakai CSV DataJobID*.csv pertama di folder induk.
Syarat CSV: WITS > Trade Stats > Reporter Indonesia, HS 2 digit, semua partner, tahun 2024 dan 2025.
"""
import csv, glob, json, math, os, sys, urllib.request, collections as C

# kode WITS yang beda dari ISO-3 di peta Plotly, dan negara kecil yang tidak punya poligon di peta 110m
ALIAS = {"ROM": "ROU", "ZAR": "COD", "TMP": "TLS", "SER": "SRB", "SUD": "SDN", "PSE": "PSE"}
POINTS = {"SGP": ([103.8, 1.35], [103.6, 104.1, 1.2, 1.5]), "HKG": ([114.2, 22.3], [113.8, 114.4, 22.15, 22.55]), "BHR": ([50.55, 26.05], [50.4, 50.8, 25.8, 26.3]),
          "MUS": ([57.55, -20.25], [57.3, 57.8, -20.5, -19.95]), "MLT": ([14.4, 35.9], [14.2, 14.6, 35.8, 36.1]), "MDV": ([73.5, 3.2], [72.6, 73.8, -0.7, 7.1])}
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else sorted(glob.glob(os.path.join(ROOT, "DataJobID*.csv")))[0]
TOPO = os.path.join(HERE, "world_110m.json")
OUT = os.path.join(ROOT, "data.js")
if not os.path.exists(TOPO):
    urllib.request.urlretrieve("https://cdn.plot.ly/world_110m.json", TOPO)

ID = dict(CHN="Tiongkok", USA="Amerika Serikat", SGP="Singapura", JPN="Jepang", MYS="Malaysia", IND="India", KOR="Korea Selatan", VNM="Vietnam", THA="Thailand",
  AUS="Australia", PHL="Filipina", TWN="Taiwan", BRA="Brasil", NLD="Belanda", SAU="Arab Saudi", ARE="Uni Emirat Arab", DEU="Jerman", CHE="Swiss", HKG="Hong Kong",
  RUS="Rusia", ITA="Italia", CAN="Kanada", PAK="Pakistan", BGD="Bangladesh", MEX="Meksiko", NGA="Nigeria", FRA="Prancis", GBR="Inggris", ESP="Spanyol", BEL="Belgia",
  EGY="Mesir", TUR="Turki", AGO="Angola", ZAF="Afrika Selatan", QAT="Qatar", NZL="Selandia Baru", ARG="Argentina", OMN="Oman", POL="Polandia", KHM="Kamboja",
  MMR="Myanmar", SWE="Swedia", JOR="Yordania", KEN="Kenya", DZA="Aljazair", KWT="Kuwait", ECU="Ekuador", FIN="Finlandia", PER="Peru", GAB="Gabon", CHL="Chili",
  LKA="Sri Lanka", UKR="Ukraina", EST="Estonia", TGO="Togo", DNK="Denmark", IRQ="Irak", TZA="Tanzania", CIV="Pantai Gading", TMP="Timor Leste", GHA="Ghana",
  BRN="Brunei", DJI="Djibouti", NOR="Norwegia", PNG="Papua Nugini", TUN="Tunisia", GRC="Yunani", AUT="Austria", MHL="Kepulauan Marshall", IRL="Irlandia",
  IRN="Iran", PRK="Korea Utara", ZAR="Kongo (DRK)", COG="Kongo", ETH="Etiopia", SER="Serbia", PSE="Palestina", ISR="Israel", COL="Kolombia", VEN="Venezuela",
  MOZ="Mozambik", MDG="Madagaskar", NPL="Nepal", LAO="Laos", MNG="Mongolia", KAZ="Kazakhstan", UZB="Uzbekistan", ROM="Rumania", HUN="Hungaria", CZE="Ceko",
  PRT="Portugal", ISL="Islandia", BHS="Bahama", GMB="Gambia")
CH = {"01":"Hewan hidup","02":"Daging","03":"Ikan & hasil laut","04":"Susu, telur, madu","05":"Produk hewani lain","06":"Tanaman hidup & bunga","07":"Sayuran","08":"Buah & kacang",
"09":"Kopi, teh, rempah","10":"Serealia","11":"Produk penggilingan","12":"Biji & buah berminyak","13":"Getah & ekstrak nabati","14":"Bahan anyaman nabati","15":"Lemak & minyak nabati",
"16":"Olahan daging & ikan","17":"Gula & kembang gula","18":"Kakao & cokelat","19":"Olahan serealia & roti","20":"Olahan sayur & buah","21":"Olahan makanan lain","22":"Minuman & cuka",
"23":"Sisa industri makanan & pakan","24":"Tembakau & rokok","25":"Garam, belerang, semen mentah","26":"Bijih logam","27":"Bahan bakar mineral","28":"Kimia anorganik","29":"Kimia organik",
"30":"Farmasi","31":"Pupuk","32":"Pewarna & cat","33":"Parfum & kosmetik","34":"Sabun & lilin","35":"Zat albumin & lem","36":"Bahan peledak","37":"Bahan fotografi","38":"Produk kimia lain",
"39":"Plastik","40":"Karet","41":"Kulit mentah","42":"Barang kulit","43":"Bulu & kulit berbulu","44":"Kayu","45":"Gabus","46":"Anyaman","47":"Pulp kayu","48":"Kertas & karton",
"49":"Buku & barang cetakan","50":"Sutra","51":"Wol","52":"Kapas","53":"Serat tekstil nabati lain","54":"Benang & kain filamen buatan","55":"Serat staple buatan","56":"Wadding & tali",
"57":"Karpet","58":"Kain khusus","59":"Kain dilapisi","60":"Kain rajut","61":"Pakaian rajut","62":"Pakaian bukan rajut","63":"Tekstil jadi lain","64":"Alas kaki","65":"Topi","66":"Payung",
"67":"Bulu unggas olahan","68":"Barang batu & semen","69":"Keramik","70":"Kaca","71":"Mutiara, permata, logam mulia","72":"Besi dan baja","73":"Barang dari besi/baja","74":"Tembaga",
"75":"Nikel","76":"Aluminium","78":"Timbal","79":"Seng","80":"Timah","81":"Logam dasar lain","82":"Perkakas","83":"Barang logam lain","84":"Mesin & peralatan mekanik",
"85":"Mesin & peralatan listrik","86":"Kereta api","87":"Kendaraan","88":"Pesawat","89":"Kapal","90":"Alat optik & medis","91":"Jam","92":"Alat musik","93":"Senjata","94":"Furnitur",
"95":"Mainan & olahraga","96":"Barang manufaktur lain","97":"Karya seni & barang antik","99":"Tidak terklasifikasi"}
REG = {"East Asia & Pacific":"Asia Timur & Pasifik","Europe & Central Asia":"Eropa & Asia Tengah","North America":"Amerika Utara","South Asia":"Asia Selatan",
"Middle East, North Africa, Afghanistan & Pakistan":"Timur Tengah & Afrika Utara","Latin America & Caribbean":"Amerika Latin & Karibia","Sub-Saharan Africa":"Afrika Sub-Sahara","Others":"Lainnya"}


def geom_info(topo):
    """Centroid (ct dari Plotly) dan kotak batas poligon terbesar tiap negara, [lonmin, lonmax, latmin, latmax]."""
    sc, tr = topo["transform"]["scale"], topo["transform"]["translate"]
    arcs = []
    for a in topo["arcs"]:
        x = y = 0; pts = []
        for dx, dy in a:
            x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
        arcs.append(pts)
    def ring(idx):
        pts = []
        for i in idx:
            seg = arcs[i] if i >= 0 else arcs[~i][::-1]
            pts += seg if not pts else seg[1:]
        return pts
    out = {}
    for g in topo["objects"]["countries"]["geometries"]:
        if "id" not in g: continue
        polys = g["arcs"] if g["type"] == "MultiPolygon" else [g["arcs"]]
        best = None
        for p in polys:
            if not p or not p[0]: continue
            r = ring(p[0]); xs = [q[0] for q in r]; ys = [q[1] for q in r]
            area = (max(xs) - min(xs)) * (max(ys) - min(ys))
            if best is None or area > best[0]: best = (area, [min(xs), max(xs), min(ys), max(ys)])
        out[g["id"]] = {"ct": g.get("properties", {}).get("ct"), "bb": [round(z, 1) for z in best[1]] if best else None}
    return out

rows = list(csv.DictReader(open(SRC, encoding="latin-1")))
v = lambda x: float(x["TradeValue in 1000 USD"] or 0) / 1e6   # ribu US$ -> miliar US$
SLOT = {("2025", "Export"): 0, ("2025", "Import"): 1, ("2024", "Export"): 2, ("2024", "Import"): 3}
bad = {"All", "UNS", "IDN"}
geo = geom_info(json.load(open(TOPO)))
C_ = {}; W = C.defaultdict(lambda: [0.0] * 4); tot = [0.0] * 4
for x in rows:
    s = SLOT.get((x["Year"], x["TradeFlowName"]))
    if s is None or x["PartnerISO3"] in bad: continue
    k = x["PartnerISO3"]
    if k == "WLD":
        W[x["ProductCode"]][s] += v(x); tot[s] += v(x); continue
    c = C_.setdefault(k, {"n": x["PartnerName"].strip(), "r": REG.get(x["Partner Region"], x["Partner Region"]), "t": [0.0] * 4, "p": C.defaultdict(lambda: [0.0] * 4)})
    c["t"][s] += v(x); c["p"][x["ProductCode"]][s] += v(x)
rd = lambda a: [round(z, 3) for z in a]
out = {"tot": rd(tot), "w": {k: rd(a) for k, a in W.items()}, "ch": CH, "c": {}}
for k, c in C_.items():
    if sum(c["t"]) <= 0: continue
    iso = ALIAS.get(k, k); g = geo.get(iso) or {}
    if not g.get("ct") and k in POINTS: g = {"ct": POINTS[k][0], "bb": POINTS[k][1]}
    out["c"][k] = {"i": iso, "pt": 0 if geo.get(iso, {}).get("ct") else 1, "n": ID.get(k) or c["n"].split("(")[0].strip(), "r": c["r"], "ll": g.get("ct"), "bb": g.get("bb"), "t": rd(c["t"]), "p": {ch: rd(a) for ch, a in c["p"].items() if sum(a) > 0}}
open(OUT, "w", encoding="utf-8").write("window.D=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";")
top = sorted(out["c"].items(), key=lambda kv: -(kv[1]["t"][0] + kv[1]["t"][1]))
print(len(out["c"]), "partner;", round(os.path.getsize(OUT) / 1024), "KB; total", out["tot"])
print("tanpa geometri peta:", [(k, round(c["t"][0] + c["t"][1], 1)) for k, c in top if not c["ll"]][:12])
print("nama masih Inggris di 40 besar:", [(k, c["n"]) for k, c in top[:40] if k not in ID])
