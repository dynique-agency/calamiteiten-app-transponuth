-- =============================================================================
-- Calamiteiten App Transpo-Nuth — Database Initialisatie Script
-- =============================================================================
-- LET OP: dit script bevat GEEN CREATE DATABASE of USE statement.
-- Verbind van tevoren met de juiste doeldatabase:
--   • Lokaal:      CREATE DATABASE calamiteiten_db; USE calamiteiten_db;
--   • Productie:   verbind direct met 'defaultdb' (Aiven)
--
-- Alle tabelnamen zijn lowercase voor compatibiliteit met Linux MySQL
-- (lower_case_table_names=1 op beheerde MySQL-diensten zoals Aiven).
-- =============================================================================

SET NAMES 'utf8mb4';
SET CHARACTER SET utf8mb4;
SET time_zone = '+01:00';

-- Zet foreign-key-controles tijdelijk uit zodat DROP-volgorde niet uitmaakt
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- BESTAANDE TABELLEN VERWIJDEREN (herinitialisatie-veilig)
-- =============================================================================
DROP TABLE IF EXISTS `audit_log`;
DROP TABLE IF EXISTS `foto`;
DROP TABLE IF EXISTS `calamiteit_plaatsing`;
DROP TABLE IF EXISTS `calamiteit_collega`;
DROP TABLE IF EXISTS `calamiteit_toeslag`;
DROP TABLE IF EXISTS `calamiteit_materieel`;
DROP TABLE IF EXISTS `rekenregel`;
DROP TABLE IF EXISTS `configuratie`;
DROP TABLE IF EXISTS `materieel`;
DROP TABLE IF EXISTS `calamiteit`;
DROP TABLE IF EXISTS `klant`;
DROP TABLE IF EXISTS `gebruiker`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABEL: gebruiker
-- =============================================================================
CREATE TABLE `gebruiker` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `external_id`           VARCHAR(100)    NULL      DEFAULT NULL COMMENT 'YourSoft personeels-ID voor SSO-koppeling',
  `naam`                  VARCHAR(150)    NOT NULL,
  `wachtwoord_hash`       VARCHAR(255)    NOT NULL,
  `rol`                   ENUM('Admin','Medewerker') NOT NULL DEFAULT 'Medewerker',
  `actief`                TINYINT(1)      NOT NULL DEFAULT 1,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_gebruiker_external_id` (`external_id`),
  INDEX `idx_gebruiker_rol` (`rol`),
  INDEX `idx_gebruiker_actief` (`actief`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: klant
-- =============================================================================
CREATE TABLE `klant` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `naam`                  VARCHAR(150)    NOT NULL,
  `adres`                 VARCHAR(255)    NULL      DEFAULT NULL,
  `email_facturatie`      VARCHAR(150)    NULL      DEFAULT NULL,
  `actief`                TINYINT(1)      NOT NULL DEFAULT 1,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_klant_actief` (`actief`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: calamiteit
-- =============================================================================
CREATE TABLE `calamiteit` (
  `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `maker_id`                  INT UNSIGNED    NOT NULL,
  `klant_id`                  INT UNSIGNED    NULL,
  `tijdstip_melding`          DATETIME        NULL      DEFAULT NULL,
  `tijdstip_aanwezig`         DATETIME        NULL      DEFAULT NULL,
  `tijdstip_afgerond`         DATETIME        NULL      DEFAULT NULL,
  `rijksweg`                  VARCHAR(20)     NOT NULL,
  `hmp`                       DECIMAL(8,3)    NOT NULL,
  `omschrijving`              TEXT            NULL,
  `rijbaan_richting`          ENUM('Oplopend','Aflopend') NOT NULL,
  `aantal_stroken`            TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `naam_inspecteur_rws`       VARCHAR(150)    NULL      DEFAULT NULL,
  `restschade`                TINYINT(1)      NOT NULL DEFAULT 0,
  `restschade_omschrijving`   TEXT            NULL      DEFAULT NULL,
  `vervolgactie`              TINYINT(1)      NOT NULL DEFAULT 0,
  `vervolgactie_omschrijving` TEXT            NULL      DEFAULT NULL,
  `checklist_pbm`             TINYINT(1)      NOT NULL DEFAULT 0,
  `checklist_fotos_calamiteit` TINYINT(1)     NOT NULL DEFAULT 0,
  `checklist_fotos_aanpak`    TINYINT(1)      NOT NULL DEFAULT 0,
  `checklist_veilig`          TINYINT(1)      NOT NULL DEFAULT 0,
  `checklist_stortbon`        TINYINT(1)      NOT NULL DEFAULT 0,
  `status`                    ENUM('Concept','Ingezonden') NOT NULL DEFAULT 'Concept',
  `aangemaakt_op`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calamiteit_maker` FOREIGN KEY (`maker_id`) REFERENCES `gebruiker`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_calamiteit_klant` FOREIGN KEY (`klant_id`) REFERENCES `klant`(`id`)     ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_calamiteit_status`   (`status`),
  INDEX `idx_calamiteit_rijksweg` (`rijksweg`),
  INDEX `idx_calamiteit_melding`  (`tijdstip_melding`),
  INDEX `idx_calamiteit_maker`    (`maker_id`),
  INDEX `idx_calamiteit_klant`    (`klant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: materieel
-- =============================================================================
CREATE TABLE `materieel` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `naam`                  VARCHAR(150)    NOT NULL,
  `eenheid`               VARCHAR(50)     NOT NULL,
  `basistarief`           DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `uurtarief`             DECIMAL(10,2)   NOT NULL DEFAULT 0.00,
  `actief`                TINYINT(1)      NOT NULL DEFAULT 1,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_materieel_actief` (`actief`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: configuratie
-- =============================================================================
CREATE TABLE `configuratie` (
  `sleutel`               VARCHAR(100)    NOT NULL,
  `waarde`                VARCHAR(255)    NOT NULL,
  `omschrijving`          VARCHAR(500)    NULL      DEFAULT NULL,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sleutel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: rekenregel
-- =============================================================================
CREATE TABLE `rekenregel` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `scenario_stroken`      TINYINT UNSIGNED NOT NULL,
  `object_naam`           VARCHAR(150)    NOT NULL,
  `offset_hmp`            DECIMAL(8,3)    NOT NULL,
  `volgorde`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_rekenregel_scenario` (`scenario_stroken`),
  UNIQUE KEY `uq_rekenregel_scenario_object` (`scenario_stroken`, `object_naam`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: calamiteit_materieel (koppeltabel met snapshot)
-- =============================================================================
CREATE TABLE `calamiteit_materieel` (
  `calamiteit_id`                     INT UNSIGNED    NOT NULL,
  `materieel_id`                      INT UNSIGNED    NOT NULL,
  `aantal`                            DECIMAL(10,2)   NOT NULL DEFAULT 1.00,
  `gefactureerd_basistarief_snapshot` DECIMAL(10,2)   NOT NULL,
  `gefactureerd_uurtarief_snapshot`   DECIMAL(10,2)   NOT NULL,
  `aangemaakt_op`                     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`calamiteit_id`, `materieel_id`),
  CONSTRAINT `fk_cal_mat_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cal_mat_materieel`  FOREIGN KEY (`materieel_id`)  REFERENCES `materieel`(`id`)  ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_cal_mat_materieel` (`materieel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: calamiteit_toeslag
-- =============================================================================
CREATE TABLE `calamiteit_toeslag` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `naam_toeslag`          VARCHAR(100)    NOT NULL,
  `uurtarief_snapshot`    DECIMAL(10,2)   NOT NULL,
  `aantal_uren`           DECIMAL(6,4)    NOT NULL DEFAULT 0.0000,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cal_toeslag_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_cal_toeslag_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: calamiteit_collega (koppeltabel)
-- =============================================================================
CREATE TABLE `calamiteit_collega` (
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `gebruiker_id`          INT UNSIGNED    NOT NULL,
  PRIMARY KEY (`calamiteit_id`, `gebruiker_id`),
  CONSTRAINT `fk_cal_collega_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cal_collega_gebruiker`  FOREIGN KEY (`gebruiker_id`)  REFERENCES `gebruiker`(`id`)  ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_cal_collega_gebruiker` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: calamiteit_plaatsing
-- =============================================================================
CREATE TABLE `calamiteit_plaatsing` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `object_naam`           VARCHAR(150)    NOT NULL,
  `hmp_positie`           DECIMAL(8,3)    NOT NULL,
  `is_handmatig`          TINYINT(1)      NOT NULL DEFAULT 0,
  `volgorde`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cal_plaatsing_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_cal_plaatsing_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: foto
-- =============================================================================
CREATE TABLE `foto` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `bestandsnaam`          VARCHAR(255)    NOT NULL,
  `pad_url`               VARCHAR(512)    NOT NULL,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_foto_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_foto_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- TABEL: audit_log
-- =============================================================================
CREATE TABLE `audit_log` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gebruiker_id`          INT UNSIGNED    NULL      DEFAULT NULL,
  `actie`                 ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  `tabel_naam`            VARCHAR(100)    NOT NULL,
  `record_id`             VARCHAR(100)    NOT NULL,
  `oude_waarde`           JSON            NULL      DEFAULT NULL,
  `nieuwe_waarde`         JSON            NULL      DEFAULT NULL,
  `tijdstip`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_auditlog_gebruiker` FOREIGN KEY (`gebruiker_id`) REFERENCES `gebruiker`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX `idx_auditlog_tabel`     (`tabel_naam`),
  INDEX `idx_auditlog_gebruiker` (`gebruiker_id`),
  INDEX `idx_auditlog_tijdstip`  (`tijdstip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- SEED DATA: configuratie
-- =============================================================================
INSERT INTO `configuratie` (`sleutel`, `waarde`, `omschrijving`) VALUES
  ('zaterdagtoeslag_uurtarief',  '18.75',  'Toeslag per uur op zaterdagen (00:00-24:00)'),
  ('zondagtoeslag_uurtarief',    '28.25',  'Toeslag per uur op zondagen t/m maandag 06:00'),
  ('min_facturatie_uren',        '4',      'Minimum te factureren uren per calamiteit'),
  ('facturatie_kwartier_factor', '0.0625', 'Factor per extra kwartier boven het minimum');

-- =============================================================================
-- SEED DATA: gebruiker (standaard beheerder — wijzig wachtwoord na eerste login)
-- =============================================================================
INSERT INTO `gebruiker` (`naam`, `wachtwoord_hash`, `rol`, `actief`) VALUES
  ('Beheerder Transpo-Nuth', '$2b$12$placeholderHashVervangMeNaInstallatie000000000000000000000', 'Admin', 1);

-- =============================================================================
-- SEED DATA: klant
-- =============================================================================
INSERT INTO `klant` (`naam`, `adres`, `email_facturatie`, `actief`) VALUES
  ('Strukton', 'Ringwade 37, 3439 LM Nieuwegein', 'facturatie@strukton.nl', 1);

-- =============================================================================
-- SEED DATA: rekenregel (CROW-offsets)
-- =============================================================================
INSERT INTO `rekenregel` (`scenario_stroken`, `object_naam`, `offset_hmp`, `volgorde`) VALUES
  (1, 'Pijlwagen',       0.000, 1),
  (1, 'Afzetting start', 0.050, 2),
  (1, 'Waarschuwing 1',  0.250, 3),
  (1, 'Waarschuwing 2',  0.500, 4),
  (1, 'Waarschuwing 3',  1.000, 5),
  (2, 'Pijlwagen',       0.000, 1),
  (2, 'Afzetting start', 0.050, 2),
  (2, 'Waarschuwing 1',  0.350, 3),
  (2, 'Waarschuwing 2',  0.700, 4),
  (2, 'Waarschuwing 3',  1.400, 5);

-- =============================================================================
-- SEED DATA: materieel
-- =============================================================================
INSERT INTO `materieel` (`naam`, `eenheid`, `basistarief`, `uurtarief`, `actief`) VALUES
  ('Pijlwagen',             'uur',  0.00,  95.00, 1),
  ('Afzetmateriaal set',    'stuk', 75.00,  0.00, 1),
  ('Verkeersregelaar',      'uur',  0.00,  55.00, 1),
  ('Bebordingsvoertuig',    'uur',  0.00,  85.00, 1),
  ('Stortbon verwerking',   'stuk', 45.00,  0.00, 1);

-- =============================================================================
-- EINDE SCRIPT
-- =============================================================================
