-- Instalasi yang sudah memiliki Pemegang Saham (produksi, moneychanger lokal) dianggap sudah
-- disiapkan, sehingga wizard tidak pernah muncul di sana. Instalasi tanpa Pemegang Saham tidak
-- mendapat baris apa pun dan karena itu wajib melewati wizard berpenjaga kode penyiapan.
INSERT INTO `app_installation` (`id`, `setupCompletedAt`)
SELECT 1, UTC_TIMESTAMP() FROM DUAL
WHERE EXISTS (SELECT 1 FROM `users` WHERE `role` = 'SHAREHOLDER');
