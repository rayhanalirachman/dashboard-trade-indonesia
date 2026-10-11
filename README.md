# Dashboard Perdagangan Indonesia

Ekspor dan impor Indonesia 2025 dibanding 2024, global dan per negara mitra.
Sumber data: [WITS](https://wits.worldbank.org) (World Bank), produk HS 2 digit, nilai dalam US$ miliar.

Situs statis murni: `index.html` + `app.js` + `data.js`. Peta memakai Plotly.js dari CDN, tanpa server dan tanpa build.

## Lihat di komputer

```bash
python3 -m http.server 8000
```

Buka http://localhost:8000. Membuka `index.html` langsung dari Finder juga bisa, tetapi sebagian browser memblokir peta dari `file://`.

## Perbarui data

1. Unduh CSV dari WITS: Trade Stats, reporter Indonesia, HS 2 digit, semua partner, tahun yang dibandingkan.
2. Taruh `DataJobID-….csv` di folder ini, lalu jalankan:

```bash
python3 tools/build_data.py
```

Skrip membuat ulang `data.js`. Kalau tahun datanya berganti, ubah juga label "2025" dan "2024" di `index.html` dan `app.js`, serta `SLOT` di `tools/build_data.py`.

## Deploy ke GitHub Pages

Repositori > Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/ (root)`.
