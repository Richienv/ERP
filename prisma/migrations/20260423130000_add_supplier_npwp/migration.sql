-- H6: Add NPWP (Nomor Pokok Wajib Pajak) to suppliers.
-- Indonesian tax law requires vendor NPWP on e-Faktur and PPh 23
-- bukti potong. Format: 15 digits (legacy) or 16 digits (new NIK-based).
ALTER TABLE "suppliers" ADD COLUMN "npwp" TEXT;
