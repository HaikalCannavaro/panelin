/** Contextual, non-modal walkthrough. It never writes to form values or storage. */
const STAGES = ['Pemakaian', 'Lokasi & atap', 'Aktivitas', 'Biaya'];
const CONTROL = 'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), summary, [tabindex="0"]';
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tip = (id, selector, title, description, hint, closest = '.field') => ({id, selector, title, description, hint, closest});

export function walkthroughSteps({step = 0, inputMode = 'kwh', monthlyMode = 'average', mode = 'demo', geo = false, hourlyData = null} = {}) {
  const stages = [
    [
      tip('segment', '.segment-options', 'Mulai dari jenis bangunan', 'Pilih rumah, sekolah, atau UMKM. Pilihan ini memberi jadwal aktivitas awal yang nanti dapat kamu ubah.', 'Pilih yang paling mendekati penggunaan bangunanmu.', null),
      tip('consumption-mode', '[data-action="input-mode"]', 'Pilih data yang kamu punya', 'Angka kWh pada rekening biasanya paling langsung. Jika hanya punya biaya, gunakan komponen energi saja, bukan total tagihan atau nominal token.', 'Mengganti metode tidak berarti angka perkiraannya sudah terverifikasi.', '.mode-picker'),
      tip('year', '#year', 'Tentukan tahun pemakaian', 'Gunakan tahun yang sesuai dengan data listrikmu. Kalender hari kerja dan libur dalam model mengikuti tahun ini.', 'Tanggal libur di langkah Aktivitas harus berada pada tahun yang sama.'),
      tip('period', '#periodMonth', 'Cocokkan bulan rekening', 'Pilih bulan yang mewakili data konsumsi yang kamu masukkan. Ini mencatat asal data, bukan memilih bulan pemasangan.', 'Jika tersedia, data 12 bulan memberi gambaran musiman yang lebih baik.'),
      inputMode === 'charge'
        ? tip('consumption', '#energyCharge', 'Isi biaya energi saja', 'Masukkan rupiah untuk komponen energi selama satu bulan. Aplikasi membaginya dengan tarif Rp/kWh untuk memperkirakan konsumsi.', 'Jangan sertakan pajak, administrasi, biaya tetap, atau saldo token.')
        : tip('consumption', '#monthlyValue', 'Isi pemakaian dalam kWh', 'Cari kWh pemakaian pada rekening atau aplikasi PLN, lalu isi untuk bulan tadi. Angka ini berbeda dari daya langganan dalam VA.', 'Biarkan kosong jika belum tahu. Nol berarti benar-benar tidak ada pemakaian.'),
      tip('tariff', '#tariff', 'Periksa tarif yang dipakai', 'Isi tarif komponen energi dalam Rp/kWh sesuai golongan dan periode rekening. Nilai awal adalah asumsi contoh, bukan tarif resmi yang diperbarui otomatis.', 'Tarif mengubah perkiraan penghematan, bukan jumlah energi surya.'),
      tip('tariff-source', '#tariffGroup', 'Catat golongan dan periode tarif', 'Tulis golongan atau sumber tarif, lalu periode berlakunya pada kolom berikutnya. Catatan ini membantu menjelaskan angka hasil simulasi.', 'Gunakan keterangan dari rekening atau sumber tarif yang kamu periksa.'),
      tip('coverage', '[data-action="monthly-mode"]', 'Pilih cakupan datamu', 'Isi 12 bulan jika punya riwayat lengkap. Jika hanya satu bulan, model bisa memakai nilai yang sama sepanjang tahun dengan persetujuanmu.', 'Konsumsi setiap bulan boleh berbeda; jangan isi nol untuk data yang hilang.', '.mode-picker'),
      monthlyMode === 'full'
        ? tip('months', '.months', 'Lengkapi konsumsi 12 bulan', 'Masukkan kWh Januari sampai Desember. Angka tiap bulan dipertahankan untuk membentuk beban tahunan.', 'Periksa semua bulan sebelum melanjutkan.', null)
        : tip('consent', '[name="consent"]', 'Setujui perkiraan hanya jika sesuai', 'Centang jika kamu memilih memakai konsumsi bulan ini untuk 12 bulan. Sebelas bulan lainnya tetap ditandai sebagai perkiraan.', 'Panduan tidak mencentang persetujuan atau mengisi data untukmu.', '.checkbox-row')
    ],
    [
      tip('roof-shape', '.roof-type-picker', 'Kenali bentuk atap di 3D', 'Pilih bentuk atap, lalu jelajahi ukuran dan susunan panel. Geser rumah untuk memutar; tombol kamera tersedia jika tidak memakai gestur.', 'Gambar adalah ilustrasi, bukan pemeriksaan struktur atau desain pemasangan.', null),
      tip('sun-time', '#sun-minutes', 'Lihat matahari sepanjang hari', 'Geser waktu, lalu sesuaikan tanggal dan zona waktu 3D di bawahnya. Arah cahaya membantu memahami kapan suatu bidang menghadap matahari.', 'Posisi astronomis bukan pengukuran cuaca atau jaminan energi.', null),
      tip('map', '[data-map-pinpoint]', 'Pinpoint lokasi jika kamu mau', 'Aktifkan peta jika setuju dengan pemberitahuannya. Dekati kota, perbesar, lalu ketuk atap atau pasang titik di tengah. Sesuaikan arah depan bangunan pada penggeser setelah peta.', 'Opsional. Tanpa GPS atau pencarian alamat otomatis. Peta OpenStreetMap bukan citra satelit dan koordinat manual tetap tersedia.', null),
      tip('sun-location', '.sun-fields.coordinates', 'Koordinat 3D boleh disesuaikan', 'Jika tahu lintang dan bujur, masukkan lokasinya atau gunakan peta opsional. Nilai awal adalah lokasi contoh, bukan hasil pencarian kotamu.', 'Aktifkan hubungan geografis hanya setelah lokasi dan bentuk atap sesuai.', null),
      tip('heading', '#sun-heading', 'Bangunanmu menghadap ke mana?', 'Atur arah sisi depan yang memiliki pintu: 0° utara, 90° timur, 180° selatan, 270° barat. Ini berbeda dari memutar kamera 3D.', 'Dengan hubungan geografis aktif, arah dan bidang atap memengaruhi estimasi setelah dihitung ulang.', '.roof-range'),
      tip('geo-link', '#geo-enabled', 'Hubungkan data lokasi hanya jika siap', 'Centang setelah lokasi, zona waktu, arah depan, dan bidang atap 3D sudah sesuai. Model lalu memakai perjalanan matahari sepanjang tahun untuk menyesuaikan profil produksi.', 'Opsional. Tanpa ini, simulasi tetap berjalan dengan profil jam sederhana. Koordinat tidak menyediakan data cuaca.', '.checkbox-row'),
      tip('geo-assumptions', '#geo-diffuseFraction', 'Periksa asumsi cahaya tambahan', 'Fraksi difus membagi cahaya langsung dan tersebar. Albedo mewakili pantulan tanah. Rugi tambahan hanya untuk rugi yang belum masuk sumber yield.', 'Nilai awal adalah asumsi skenario. Jangan mengurangi losses yang sama dua kali.', '.fields'),
      tip('city', '#city', 'Beri nama lokasi simulasi', 'Isi kota atau kabupaten, lalu pilih zona waktu model pada kolom di samping. Kamu tidak perlu memasukkan alamat lengkap.', 'Nama lokasi saja tidak menggantikan data produksi surya setempat.'),
      tip('roof-area', '#roofArea', 'Isi area yang benar-benar tersedia', 'Gunakan luas efektif setelah mengurangi hambatan dan ruang yang tidak dapat dipakai. Luas ini membatasi jumlah panel pada perhitungan.', 'Opsional. Kosong berarti belum diketahui, sedangkan nol berarti tidak ada area tersedia.'),
      tip('budget', '#budget', 'Tambahkan batas anggaran jika ada', 'Anggaran membatasi opsi biaya investasi awal. Gunakan total yang siap kamu alokasikan, bukan target penghematan per bulan.', 'Opsional. Kosong berarti tanpa batas anggaran pada eksplorasi.'),
      tip('roof-direction', '#roofTilt', 'Tambahkan kondisi atap bila diketahui', 'Isi kemiringan, arah azimut, dan kondisi bayangan berdasarkan pengamatan atau survei. Utara 0°, timur 90°, selatan 180°, barat 270°.', 'Kolom ini hanya catatan survei. Koreksi energi memakai data atap 3D jika hubungan geografis diaktifkan.'),
      tip('capacity', '#maxKwp', 'Batasi kapasitas yang ingin dijelajahi', 'kWp DC menyatakan kapasitas nominal panel, bukan energi bulanan. Model mencari beberapa opsi sampai batas ini sesuai luas dan anggaran.', 'Tanpa data atap, hasil tetap eksplorasi awal.'),
      tip('solar-source', '[data-action="data-mode"]', 'Pilih dasar produksi energi', 'Gunakan asumsi contoh untuk mencoba alur, atau masukkan yield AC dari sumber yang sesuai lokasi. Sumber lebih baik membuat estimasi lebih relevan, bukan otomatis terverifikasi.', geo ? 'Hubungan geografis aktif: gunakan yield referensi AC horizontal, bukan yield yang sudah dikoreksi ke bidang atap.' : 'Yield AC sudah memperhitungkan rugi sistem menurut sumbernya. Jangan menguranginya dua kali.', '.mode-picker'),
      tip('source-reference', '#sourceName', 'Tuliskan asal data surya', 'Cantumkan nama sumber dan periode dataset pada kolom berikutnya. Pastikan lokasi, orientasi, dan satuan data sesuai dengan skenario yang kamu gunakan.', 'Data manual tidak diperiksa otomatis oleh aplikasi.'),
      tip('yield', '#yield-0', 'Periksa yield setiap bulan', hourlyData?.productionKwhPerKwp ? 'Total bulanan ini mengikuti CSV produksi per jam yang diimpor dan tidak dapat diedit langsung. Lepas seri CSV jika ingin kembali ke yield bulanan.' : 'Satuan kWh/kWp per bulan berarti energi AC bulanan untuk setiap 1 kWp panel. Ini bukan total energi untuk seluruh sistem.', geo ? 'Gunakan referensi bidang horizontal. Arah dan kemiringan akan dikoreksi oleh hubungan geografis.' : mode === 'demo' ? 'Nilai awal adalah asumsi contoh. Ganti sumber bila membutuhkan estimasi lokasi.' : 'Gunakan 12 nilai dari sumber yang konsisten.', '.months'),
      tip('hourly', '#hourly-file', 'Data per jam untuk estimasi lebih rinci', 'Pilih data manual dan isi sumber/periode sebelum impor. CSV perlu setahun lengkap: produksi dalam kWh AC per kWp, beban dalam kWh total bangunan, bukan impor neto PLN.', 'Opsional. Matikan hubungan geografis sebelum mengimpor produksi yang sudah memuat orientasi. Tanpa CSV, data bulanan tetap bisa dipakai.', '.details')
    ],
    [
      tip('days', '.day-picks', 'Pilih hari aktivitas utama', hourlyData?.loadKwh ? 'Beban per jam dari CSV sedang aktif, sehingga jadwal ini tidak mengubah hasil. Lepas data per jam di Lokasi & atap untuk memakai profil jadwal.' : 'Pilih hari saat kegiatan utama berlangsung. Hari lain tetap dapat memakai listrik melalui beban dasar.', 'Jadwal ini menyusun perkiraan beban, bukan mengubah total kWh bulanan.', '.field'),
      tip('start', '#startHour', 'Kapan aktivitas dimulai?', 'Masukkan jam mulai dalam format 24 jam: 8 berarti pukul 08.00. Jam aktif membantu memperkirakan pemakaian saat matahari tersedia.', 'Gunakan pola harian yang paling mewakili bangunanmu.'),
      tip('end', '#endHour', 'Kapan aktivitas selesai?', 'Jam selesai harus setelah jam mulai. Nilai 24 berarti akhir hari; jadwal melewati tengah malam belum didukung.', 'Semakin tepat jadwal, semakin berguna perbandingan pemakaian sendiri.'),
      tip('base-load', '#baseLoad', 'Jangan lupakan beban di luar jam aktif', 'Ini bobot relatif terhadap jam aktif, antara 0 dan 1, untuk peralatan seperti kulkas atau perangkat siaga.', '0,25 berarti bobot seperempat jam aktif, bukan otomatis 25% total energi.'),
      tip('holidays', '#holidays', 'Tambahkan hari tutup bila perlu', 'Gunakan format YYYY-MM-DD dan pisahkan tanggal dengan koma. Tanggal harus sesuai tahun model.', 'Opsional. Kosong berarti tidak ada pengecualian hari libur tambahan.'),
      tip('profile', '.chart-box', 'Periksa ritme pemakaianmu', 'Grafik menunjukkan bobot jam pada hari aktif. Total energi bulanan tetap mengikuti data konsumsi yang kamu isi.', 'Produksi siang yang tidak terpakai tidak dapat menggantikan impor malam pada model tanpa baterai.', '.panel')
    ],
    [
      tip('package', '#capexPerKwp', 'Mulai dari biaya paket sistem', 'Isi harga paket per kWp yang mencakup panel, inverter, struktur, dan pemasangan. Nilai awal adalah asumsi, bukan penawaran vendor.', 'Gunakan penawaran dengan lingkup yang jelas agar biaya tidak dihitung dua kali.'),
      tip('fixed', '#fixedCapex', 'Tambahkan biaya di luar paket', 'Isi hanya biaya tetap yang belum termasuk dalam harga paket, misalnya pekerjaan tambahan yang memang diperlukan.', 'Nol berarti tidak ada biaya tambahan pada asumsi ini.'),
      tip('maintenance', '#annualOpex', 'Perhitungkan pemeliharaan tahunan', 'Masukkan biaya pemeriksaan, pembersihan, atau perawatan tahunan sesuai skenario. Biaya ini mengurangi manfaat kas bersih.', 'Perkiraan penghematan listrik berbeda dari keuntungan bersih.'),
      tip('horizon', '#horizon', 'Tentukan jangka waktu perbandingan', 'Horizon adalah jumlah tahun simulasi keuangan, dari 1 sampai 30. Model memperhitungkan produksi yang menurun sesuai asumsi degradasi.', 'Jangka simulasi bukan janji umur pakai atau garansi peralatan.'),
      tip('replacement', '#replacementYear', 'Rencanakan penggantian inverter', 'Isi tahun penggantian dan biaya penggantian pada kolom di samping. Biaya masuk ke arus kas pada tahun yang ditentukan.', 'Gunakan asumsi dari spesifikasi atau penawaran; penggantian tidak selalu tepat pada tahun contoh.'),
      tip('technical', '#panelWp', 'Parameter lanjutan boleh diperiksa', 'Daya dan luas modul menentukan jumlah panel dan kebutuhan area. Parameter finansial di bawahnya mengatur degradasi, diskonto, dan kenaikan biaya.', 'Angka berbentuk fraksi: 0,005 = 0,5% dan 0,06 = 6%. Periksa spesifikasi sebelum mengganti.', '.fields'),
      tip('saving', '[name="saveEnabled"]', 'Penyimpanan tetap pilihanmu', 'Centang hanya jika ingin menyimpan input di browser ini setelah hitungan berhasil. Data tidak otomatis dikirim kepada vendor.', 'Opsional. Panduan tidak mengubah pilihan penyimpanan.', '.checkbox-row'),
      tip('ready', '.form-footer [type="submit"]', 'Siap menghitung dengan asumsi terbuka', 'Selesaikan panduan, lalu pilih Hitung simulasiku untuk melihat perbandingan energi dan biaya. Kamu tetap bisa kembali mengubah input.', 'Hasil adalah estimasi awal, bukan desain teknis, penawaran harga, atau jaminan penghematan.', '.form-footer')
    ]
  ];
  return stages[step] ?? [];
}

export const createWalkthroughSession = () => ({active: false, stage: null, id: null, reverse: false, focus: null});

/** Pure placement used by the controller and geometry regression tests. */
export function walkthroughScrollDelta(target, card, viewportHeight, margin = 20) {
  const overlap = target.left < card.right && target.right > card.left;
  const safeBottom = overlap ? Math.max(margin + 60, card.top - margin) : viewportHeight - margin;
  if (target.top < margin || target.bottom > safeBottom) return target.top - margin;
  return 0;
}

export function mountFormHelper(wizard, options = {}, session = createWalkthroughSession()) {
  if (!wizard) { session.active = false; session.focus = null; return () => {}; }
  const doc = wizard.ownerDocument, win = doc.defaultView;
  const form = wizard.querySelector('form');
  if (!form) return () => {};
  const stage = options.step ?? 0;
  const findTarget = item => {
    const element = wizard.querySelector(item.selector);
    return element && (item.closest ? element.closest(item.closest) || element : element);
  };
  const items = walkthroughSteps(options).filter(item => findTarget(item));
  if (options.errors?.length && wizard.querySelector('.notice.error')) items.unshift(tip('validation', '.notice.error', 'Periksa isian sebelum lanjut', 'Ada data yang belum lengkap atau di luar batas. Baca pesan yang disorot, lalu gunakan panduan berikutnya untuk memperbaiki isian.', 'Panduan tetap terbuka. Tidak ada nilai yang diubah otomatis.', null));
  if (!items.length) return () => {};
  const stageChanged = session.stage !== stage;
  let index = stageChanged ? (session.reverse ? items.length - 1 : 0) : Math.max(0, items.findIndex(item => item.id === session.id));
  if (items[0]?.id === 'validation') index = 0;
  session.stage = stage; session.reverse = false;
  let target, controls = [], opened = [], card, resizeObserver, frame = 0, disposed = false;
  const bar = doc.createElement('div');
  bar.className = 'helper-launch-bar';
  bar.innerHTML = '<span><strong>Isi pelan-pelan, kami pandu.</strong><small>Sorot setiap bagian dan pahami kegunaannya.</small></span><button type="button" class="helper-launch" aria-expanded="false" aria-controls="form-helper-card"><span class="helper-spark" aria-hidden="true">✦</span> Bantu isi</button>';
  form.before(bar);
  const launcher = bar.querySelector('button');
  const listeners = [];
  const listen = (node, event, callback, settings) => { node.addEventListener(event, callback, settings); listeners.push(() => node.removeEventListener(event, callback, settings)); };
  const reduced = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const releaseTarget = () => {
    target?.classList.remove('walkthrough-target');
    for (const control of controls) {
      const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'form-helper-description');
      if (ids.length) control.setAttribute('aria-describedby', ids.join(' ')); else control.removeAttribute('aria-describedby');
    }
    controls = [];
    for (const entry of opened) if (!entry.touched && entry.node.isConnected) entry.node.open = false;
    opened = [];
  };
  const ensureTarget = (smooth = true) => {
    if (!card || !target?.isConnected || disposed) return;
    const height = win.visualViewport?.height ?? win.innerHeight;
    const offset = win.visualViewport?.offsetTop ?? 0;
    card.style.bottom = `${Math.max(12, win.innerHeight - height - offset + 12)}px`;
    card.style.maxHeight = `${Math.max(140, Math.min(650, height - 140))}px`;
    const bounds = card.getBoundingClientRect();
    doc.documentElement.style.setProperty('--walkthrough-space', `${bounds.height + 48}px`);
    const delta = walkthroughScrollDelta(target.getBoundingClientRect(), bounds, height);
    if (Math.abs(delta) > 1) win.scrollBy({top: delta, behavior: smooth && !reduced() ? 'smooth' : 'instant'});
  };
  const scheduleTarget = (smooth = true) => {
    win.cancelAnimationFrame(frame);
    frame = win.requestAnimationFrame(() => ensureTarget(smooth));
  };
  const firstControl = () => {
    const candidates = target ? [...(target.matches(CONTROL) ? [target] : []), ...target.querySelectorAll(CONTROL)] : [];
    return candidates.find(node => !node.closest('[hidden], [inert]') && (!node.getClientRects || node.getClientRects().length));
  };
  const close = () => {
    const focusInCard = card?.contains(doc.activeElement);
    session.active = false; session.focus = null;
    releaseTarget(); card?.remove(); card = null;
    resizeObserver?.disconnect();
    launcher.setAttribute('aria-expanded', 'false');
    doc.documentElement.classList.remove('walkthrough-open');
    doc.documentElement.style.removeProperty('--walkthrough-space');
    if (focusInCard) launcher.focus({preventScroll: true});
  };
  const focusInput = () => {
    firstControl()?.focus({preventScroll: true});
    scheduleTarget(false);
  };
  const move = direction => {
    if (index + direction >= 0 && index + direction < items.length) {
      index += direction; show(true); return;
    }
    if (direction < 0 && stage > 0) {
      session.reverse = true;
      wizard.querySelector('[data-action="prev"]')?.click();
    } else if (direction > 0 && stage < 3) {
      // Submit through the app's normal validation. Never fill, consent or calculate.
      form.requestSubmit();
    } else close();
  };
  function show(focusHeading = false) {
    if (disposed) return;
    releaseTarget();
    const item = items[index];
    session.id = item.id; session.active = true;
    target = findTarget(item);
    if (!target) { close(); return; }
    for (let details = target.closest('details'); details; details = details.parentElement?.closest('details')) {
      if (!details.open) { opened.push({node: details, touched: false}); details.open = true; }
    }
    target.classList.add('walkthrough-target');
    controls = [...target.querySelectorAll(CONTROL)];
    if (target.matches(CONTROL)) controls.unshift(target);
    for (const control of controls) {
      const original = control.getAttribute('aria-describedby') || '';
      control.setAttribute('aria-describedby', `${original} form-helper-description`.trim());
    }
    if (!card) {
      card = doc.createElement('section');
      card.id = 'form-helper-card'; card.className = 'form-helper-card';
      card.setAttribute('role', 'region'); card.setAttribute('aria-labelledby', 'form-helper-title');
      doc.body.append(card);
      listen(card, 'click', event => {
        const action = event.target.closest('[data-helper-action]')?.dataset.helperAction;
        if (action === 'close') close();
        else if (action === 'next') move(1);
        else if (action === 'back') move(-1);
        else if (action === 'focus') focusInput();
      });
      if (win.ResizeObserver) { resizeObserver = new win.ResizeObserver(() => { if (card) doc.documentElement.style.setProperty('--walkthrough-space', `${card.getBoundingClientRect().height + 48}px`); }); resizeObserver.observe(card); }
    }
    const last = index === items.length - 1;
    card.innerHTML = `<div class="helper-card-top"><span class="helper-label"><span aria-hidden="true">✦</span> PANDUAN ISIAN</span><button type="button" class="helper-close" data-helper-action="close" aria-label="Tutup panduan">×</button></div><div class="helper-stage">${stage + 1}/4 · ${STAGES[stage]}<span>${index + 1} dari ${items.length}</span></div><div class="helper-progress" aria-hidden="true"><span style="width:${(index + 1) / items.length * 100}%"></span></div><h2 id="form-helper-title" tabindex="-1">${escapeHTML(item.title)}</h2><p id="form-helper-description">${escapeHTML(item.description)}</p><p class="helper-tip">${escapeHTML(item.hint)}</p>${options.errors?.length ? '<p class="helper-error" role="status">Ada isian yang perlu diperiksa. Perbaiki pesan di formulir sebelum melanjutkan.</p>' : ''}${controls.length ? '<button type="button" class="helper-focus" data-helper-action="focus">Ke bagian yang disorot <span aria-hidden="true">↗</span></button>' : ''}<div class="helper-actions"><button type="button" data-helper-action="back" ${index === 0 && stage === 0 ? 'disabled' : ''}>Sebelumnya</button><button type="button" class="helper-next" data-helper-action="next">${last ? (stage === 3 ? 'Selesai' : `Lanjut ke ${STAGES[stage + 1]}`) : 'Berikutnya'} <span aria-hidden="true">→</span></button></div><p class="helper-keyboard">Bisa isi sambil dipandu · Esc untuk menutup</p>`;
    launcher.setAttribute('aria-expanded', 'true');
    doc.documentElement.classList.add('walkthrough-open');
    if (focusHeading) card.querySelector('h2').focus({preventScroll: true});
    scheduleTarget(focusHeading);
  }
  listen(launcher, 'click', () => { if (session.active && card) close(); else show(true); });
  listen(doc, 'keydown', event => { if (session.active && event.key === 'Escape' && !event.isComposing) { event.preventDefault(); close(); } });
  listen(wizard, 'click', event => {
    const summary = event.target.closest('summary');
    if (summary) for (const entry of opened) if (entry.node === summary.parentElement) entry.touched = true;
  });
  listen(win, 'resize', () => { if (session.active) scheduleTarget(false); });
  if (win.visualViewport) listen(win.visualViewport, 'resize', () => { if (session.active) scheduleTarget(false); });
  if (session.active) {
    show(stageChanged || session.focus?.inCard);
    if (!stageChanged && session.focus && !session.focus.inCard) {
      const previous = session.focus;
      const field = previous.id ? doc.getElementById(previous.id) : [...wizard.querySelectorAll(CONTROL)].find(node => (previous.name && node.name === previous.name) || (previous.action && node.dataset.action === previous.action && node.dataset.value === previous.value));
      field?.focus({preventScroll: true});
    }
    session.focus = null;
  }
  return () => {
    if (disposed) return;
    if (session.active) session.focus = {inCard: Boolean(card?.contains(doc.activeElement)), id: doc.activeElement?.id, name: doc.activeElement?.name, action: doc.activeElement?.dataset?.action, value: doc.activeElement?.dataset?.value};
    disposed = true;
    win.cancelAnimationFrame(frame);
    releaseTarget();
    resizeObserver?.disconnect();
    for (const remove of listeners) remove();
    card?.remove(); bar.remove();
    doc.documentElement.classList.remove('walkthrough-open');
    doc.documentElement.style.removeProperty('--walkthrough-space');
  };
}
