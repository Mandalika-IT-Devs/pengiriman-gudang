# Semua pembulatan dan buffer memakai aritmetika bilangan bulat

Status: accepted (2026-10-08)

Di JavaScript, `Math.ceil(10 * 1.1)` menghasilkan 12, bukan 11, karena `10 * 1.1 = 11.000000000000002`. Karena itu, pembagian dengan pembulatan ke atas dan penerapan buffer hanya dilakukan lewat satu modul angka di domain, dengan input bilangan bulat dan buffer dalam persen bulat: `⌈x × (100 + persen) / 100⌉` dihitung secara integer. Lint menolak `Math.ceil`, `Math.round`, dan `Math.floor` di luar modul itu. Kasus jebakannya ada di `tests/golden/jumlah-kirim.json`.
