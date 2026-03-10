-- =============================================================================
-- Calamiteiten App Transpo-Nuth — Database Initialisatie Script
-- Versie: 1.0.0
-- Gebaseerd op: ERD / Data Dictionary (sectie 3.1 van de projectregels)
-- Tekenset: utf8mb4 (volledige Unicode + emoji-ondersteuning)
-- =============================================================================

SET NAMES 'utf8mb4';
SET CHARACTER SET utf8mb4;
SET time_zone = '+01:00';

-- Zet foreign-key-controles tijdelijk uit zodat DROP-volgorde niet uitmaakt
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- DATABASE
-- =============================================================================
CREATE DATABASE IF NOT EXISTS `calamiteiten_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `calamiteiten_db`;

-- =============================================================================
-- BESTAANDE TABELLEN VERWIJDEREN (herinitialisatie-veilig)
-- =============================================================================
DROP TABLE IF EXISTS `Audit_Log`;
DROP TABLE IF EXISTS `Foto`;
DROP TABLE IF EXISTS `Calamiteit_Plaatsing`;
DROP TABLE IF EXISTS `Calamiteit_Collega`;
DROP TABLE IF EXISTS `Calamiteit_Toeslag`;
DROP TABLE IF EXISTS `Calamiteit_Materieel`;
DROP TABLE IF EXISTS `Rekenregel`;
DROP TABLE IF EXISTS `Configuratie`;
DROP TABLE IF EXISTS `Materieel`;
DROP TABLE IF EXISTS `Calamiteit`;
DROP TABLE IF EXISTS `Klant`;
DROP TABLE IF EXISTS `Gebruiker`;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- TABEL: Gebruiker
-- Medewerkers en admins van Transpo-Nuth.
-- external_id: koppeling met YourSoft personeelssysteem (toekomstige SSO).
-- =============================================================================
CREATE TABLE `Gebruiker` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Gebruikers van de applicatie (Admins en Medewerkers Buitendienst)';

-- =============================================================================
-- TABEL: Klant
-- Opdrachtgevers zoals Strukton, Rijkswaterstaat, etc.
-- =============================================================================
CREATE TABLE `Klant` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `naam`                  VARCHAR(150)    NOT NULL,
  `adres`                 VARCHAR(255)    NULL      DEFAULT NULL,
  `email_facturatie`      VARCHAR(150)    NULL      DEFAULT NULL,
  `actief`                TINYINT(1)      NOT NULL DEFAULT 1,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_klant_actief` (`actief`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Opdrachtgevers / klanten van Transpo-Nuth';

-- =============================================================================
-- TABEL: Calamiteit
-- Kern-entiteit: één geregistreerde calamiteit op de rijksweg.
-- =============================================================================
CREATE TABLE `Calamiteit` (
  `id`                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `maker_id`                  INT UNSIGNED    NOT NULL  COMMENT 'Medewerker die de calamiteit aanmaakte',
  `klant_id`                  INT UNSIGNED    NULL      COMMENT 'Opdrachtgevende klant (NULL = onbekende opdrachtgever)',
  `tijdstip_melding`          DATETIME        NULL      DEFAULT NULL COMMENT 'Moment van de melding',
  `tijdstip_aanwezig`         DATETIME        NULL      DEFAULT NULL COMMENT 'Moment dat ploeg aanwezig was op locatie',
  `tijdstip_afgerond`         DATETIME        NULL      DEFAULT NULL COMMENT 'Moment dat calamiteit afgerond was',
  `rijksweg`                  VARCHAR(20)     NOT NULL  COMMENT 'Bijv. A2, N280',
  `hmp`                       DECIMAL(8,3)    NOT NULL  COMMENT 'Hectometerpaal startpositie (3 decimalen)',
  `omschrijving`              TEXT            NULL      COMMENT 'Vrije omschrijving van de calamiteit',
  `rijbaan_richting`          ENUM('Oplopend','Aflopend') NOT NULL COMMENT 'Rijrichting voor CROW-berekening',
  `aantal_stroken`            TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1 of 2 rijstroken afgezet',
  `naam_inspecteur_rws`       VARCHAR(150)    NULL      DEFAULT NULL COMMENT 'Naam van de RWS-inspecteur ter plaatse',
  `restschade`                TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Is er restschade geconstateerd?',
  `restschade_omschrijving`   TEXT            NULL      DEFAULT NULL,
  `vervolgactie`              TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Vereist een vervolgactie',
  `vervolgactie_omschrijving` TEXT            NULL      DEFAULT NULL COMMENT 'Wat de vervolgactie inhoudt',
  `checklist_pbm`             TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'PBM correct gebruikt?',
  `checklist_fotos_calamiteit` TINYINT(1)     NOT NULL DEFAULT 0 COMMENT 'Foto calamiteit gemaakt?',
  `checklist_fotos_aanpak`    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Foto aanpak gemaakt?',
  `checklist_veilig`          TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Situatie veilig afgezet?',
  `checklist_stortbon`        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Stortbon ontvangen?',
  `status`                    ENUM('Concept','Ingezonden') NOT NULL DEFAULT 'Concept',
  `aangemaakt_op`             DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_calamiteit_maker`  FOREIGN KEY (`maker_id`) REFERENCES `Gebruiker`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_calamiteit_klant`  FOREIGN KEY (`klant_id`) REFERENCES `Klant`(`id`)     ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_calamiteit_status`       (`status`),
  INDEX `idx_calamiteit_rijksweg`     (`rijksweg`),
  INDEX `idx_calamiteit_melding`      (`tijdstip_melding`),
  INDEX `idx_calamiteit_maker`        (`maker_id`),
  INDEX `idx_calamiteit_klant`        (`klant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hoofd-entiteit: een calamiteit / wegafzetting op de rijksweg';

-- =============================================================================
-- TABEL: Materieel
-- Stamdata: voertuigen, materialen en hulpmiddelen met tarieven.
-- =============================================================================
CREATE TABLE `Materieel` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `naam`                  VARCHAR(150)    NOT NULL,
  `eenheid`               VARCHAR(50)     NOT NULL  COMMENT 'Bijv. uur, stuk, dag',
  `basistarief`           DECIMAL(10,2)   NOT NULL DEFAULT 0.00 COMMENT 'Vast basistarief per eenheid',
  `uurtarief`             DECIMAL(10,2)   NOT NULL DEFAULT 0.00 COMMENT 'Uurtarief (0 indien niet van toepassing)',
  `actief`                TINYINT(1)      NOT NULL DEFAULT 1,
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_materieel_actief` (`actief`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Stamdata: materieel met vaste tarieven';

-- =============================================================================
-- TABEL: Configuratie
-- Sleutel-waarde-paren voor systeeminstellingen (weekend-toeslagen etc.).
-- =============================================================================
CREATE TABLE `Configuratie` (
  `sleutel`               VARCHAR(100)    NOT NULL  COMMENT 'Unieke configuratiesleutel',
  `waarde`                VARCHAR(255)    NOT NULL,
  `omschrijving`          VARCHAR(500)    NULL      DEFAULT NULL,
  `gewijzigd_op`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sleutel`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Systeemconfiguratie: weekend-toeslagen en overige instellingen';

-- =============================================================================
-- TABEL: Rekenregel
-- CROW-rekenregels: per scenario (1 of 2 stroken) de HMP-offsets per object.
-- =============================================================================
CREATE TABLE `Rekenregel` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `scenario_stroken`      TINYINT UNSIGNED NOT NULL COMMENT '1 of 2 rijstroken',
  `object_naam`           VARCHAR(150)    NOT NULL  COMMENT 'Bijv. Waarschuwing 1, Pijlwagen',
  `offset_hmp`            DECIMAL(8,3)    NOT NULL  COMMENT 'Offset in km t.o.v. startpositie (altijd positief; richting bepaalt optellen/aftrekken)',
  `volgorde`              SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Weergavevolgorde in de UI',
  PRIMARY KEY (`id`),
  INDEX `idx_rekenregel_scenario` (`scenario_stroken`),
  UNIQUE KEY `uq_rekenregel_scenario_object` (`scenario_stroken`, `object_naam`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='CROW-rekenregels: HMP-offsets per object per scenario';

-- =============================================================================
-- TABEL: Calamiteit_Materieel (koppeltabel met SNAPSHOT)
-- Koppelt materieel aan een calamiteit en bevriest de tarieven op het moment
-- van opslaan zodat toekomstige tariefswijzigingen historische data niet raken.
-- =============================================================================
CREATE TABLE `Calamiteit_Materieel` (
  `calamiteit_id`                     INT UNSIGNED    NOT NULL,
  `materieel_id`                      INT UNSIGNED    NOT NULL,
  `aantal`                            DECIMAL(10,2)   NOT NULL DEFAULT 1.00 COMMENT 'Aantal eenheden ingezet',
  `gefactureerd_basistarief_snapshot` DECIMAL(10,2)   NOT NULL COMMENT 'Snapshot basistarief op moment van opslaan',
  `gefactureerd_uurtarief_snapshot`   DECIMAL(10,2)   NOT NULL COMMENT 'Snapshot uurtarief op moment van opslaan',
  `aangemaakt_op`                     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`calamiteit_id`, `materieel_id`),
  CONSTRAINT `fk_cal_mat_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `Calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cal_mat_materieel`  FOREIGN KEY (`materieel_id`)  REFERENCES `Materieel`(`id`)  ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_cal_mat_materieel` (`materieel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Koppeltabel: ingezet materieel per calamiteit (incl. tarief-snapshot)';

-- =============================================================================
-- TABEL: Calamiteit_Toeslag
-- Toeslagen (weekend, nacht etc.) per calamiteit met bevroren uurtarief.
-- =============================================================================
CREATE TABLE `Calamiteit_Toeslag` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `naam_toeslag`          VARCHAR(100)    NOT NULL  COMMENT 'Bijv. Zaterdagtoeslag, Zondagtoeslag',
  `uurtarief_snapshot`    DECIMAL(10,2)   NOT NULL  COMMENT 'Snapshot toeslag-uurtarief op moment van opslaan',
  `aantal_uren`           DECIMAL(6,4)    NOT NULL  DEFAULT 0.0000 COMMENT 'Berekend aantal toeslaguren (Strukton-factor)',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cal_toeslag_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `Calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_cal_toeslag_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Toeslagen per calamiteit met snapshot-tarief';

-- =============================================================================
-- TABEL: Calamiteit_Collega (koppeltabel)
-- Koppelt meerdere collega-medewerkers aan één calamiteit.
-- =============================================================================
CREATE TABLE `Calamiteit_Collega` (
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `gebruiker_id`          INT UNSIGNED    NOT NULL,
  PRIMARY KEY (`calamiteit_id`, `gebruiker_id`),
  CONSTRAINT `fk_cal_collega_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `Calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_cal_collega_gebruiker`  FOREIGN KEY (`gebruiker_id`)  REFERENCES `Gebruiker`(`id`)  ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX `idx_cal_collega_gebruiker` (`gebruiker_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Koppeltabel: betrokken collega-medewerkers per calamiteit';

-- =============================================================================
-- TABEL: Calamiteit_Plaatsing
-- Definitieve CROW-plaatsingen per calamiteit, inclusief handmatige overrides.
-- =============================================================================
CREATE TABLE `Calamiteit_Plaatsing` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `object_naam`           VARCHAR(150)    NOT NULL  COMMENT 'Bijv. Waarschuwing 1, Pijlwagen',
  `hmp_positie`           DECIMAL(8,3)    NOT NULL  COMMENT 'Definitieve HMP-positie (berekend of handmatig overschreven)',
  `is_handmatig`          TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = handmatig overschreven door medewerker',
  `volgorde`              SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_cal_plaatsing_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `Calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_cal_plaatsing_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Definitieve CROW-objectplaatsingen per calamiteit (incl. overrides)';

-- =============================================================================
-- TABEL: Foto
-- Foto's gekoppeld aan een calamiteit (bestandsnaam + pad/URL).
-- =============================================================================
CREATE TABLE `Foto` (
  `id`                    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `calamiteit_id`         INT UNSIGNED    NOT NULL,
  `bestandsnaam`          VARCHAR(255)    NOT NULL,
  `pad_url`               VARCHAR(512)    NOT NULL  COMMENT 'Relatief serverpad of volledige URL',
  `aangemaakt_op`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_foto_calamiteit` FOREIGN KEY (`calamiteit_id`) REFERENCES `Calamiteit`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX `idx_foto_calamiteit` (`calamiteit_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Foto-bijlagen per calamiteit';

-- =============================================================================
-- TABEL: Audit_Log
-- Registreert elke mutatie op stamdata (gebruikers, tarieven, rekenregels).
-- oude_waarde / nieuwe_waarde worden opgeslagen als JSON-string.
-- =============================================================================
CREATE TABLE `Audit_Log` (
  `id`                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `gebruiker_id`          INT UNSIGNED    NULL      DEFAULT NULL COMMENT 'NULL indien systeem-actie',
  `actie`                 ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  `tabel_naam`            VARCHAR(100)    NOT NULL,
  `record_id`             VARCHAR(100)    NOT NULL  COMMENT 'PK-waarde van het gewijzigde record',
  `oude_waarde`           JSON            NULL      DEFAULT NULL COMMENT 'Vorige toestand (JSON)',
  `nieuwe_waarde`         JSON            NULL      DEFAULT NULL COMMENT 'Nieuwe toestand (JSON)',
  `tijdstip`              DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_auditlog_gebruiker` FOREIGN KEY (`gebruiker_id`) REFERENCES `Gebruiker`(`id`) ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX `idx_auditlog_tabel`       (`tabel_naam`),
  INDEX `idx_auditlog_gebruiker`   (`gebruiker_id`),
  INDEX `idx_auditlog_tijdstip`    (`tijdstip`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Audit-log: elke CREATE/UPDATE/DELETE op stamdata-tabellen';

-- =============================================================================
-- SEED DATA: Configuratie (weekend-toeslagen conform business rules)
-- Zaterdag: +€18,75/uur | Zondag t/m maandag 06:00: +€28,25/uur
-- =============================================================================
INSERT INTO `Configuratie` (`sleutel`, `waarde`, `omschrijving`) VALUES
  ('zaterdagtoeslag_uurtarief',  '18.75',  'Toeslag per uur op zaterdagen (00:00–24:00), conform Strukton-contract'),
  ('zondagtoeslag_uurtarief',    '28.25',  'Toeslag per uur op zondagen t/m maandag 06:00, conform Strukton-contract'),
  ('min_facturatie_uren',        '4',      'Minimum te factureren uren per calamiteit (Strukton 4-uurs-regel)'),
  ('facturatie_kwartier_factor', '0.0625', 'Factor per extra kwartier boven het minimum (1/16 = 0,0625)');

-- =============================================================================
-- SEED DATA: Standaard Admin-gebruiker
-- Wachtwoord: 'admin123' — WIJZIG DIT DIRECT NA EERSTE LOGIN!
-- Hash gegenereerd met bcrypt (salt rounds: 12)
-- =============================================================================
INSERT INTO `Gebruiker` (`naam`, `wachtwoord_hash`, `rol`, `actief`) VALUES
  ('Beheerder Transpo-Nuth', '$2b$12$placeholderHashVervangMeNaInstallatie000000000000000000000', 'Admin', 1);

-- =============================================================================
-- SEED DATA: Voorbeeldklant
-- =============================================================================
INSERT INTO `Klant` (`naam`, `adres`, `email_facturatie`, `actief`) VALUES
  ('Strukton', 'Ringwade 37, 3439 LM Nieuwegein', 'facturatie@strukton.nl', 1);

-- =============================================================================
-- SEED DATA: Basis CROW-rekenregels (scenario 1 strook)
-- Offsets zijn indicatief — pas aan op basis van de actuele CROW-richtlijnen.
-- =============================================================================
INSERT INTO `Rekenregel` (`scenario_stroken`, `object_naam`, `offset_hmp`, `volgorde`) VALUES
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
-- SEED DATA: Basis materieel met standaardtarieven
-- =============================================================================
INSERT INTO `Materieel` (`naam`, `eenheid`, `basistarief`, `uurtarief`, `actief`) VALUES
  ('Pijlwagen',             'uur',  0.00,  95.00, 1),
  ('Afzetmateriaal set',    'stuk', 75.00,  0.00, 1),
  ('Verkeersregelaar',      'uur',  0.00,  55.00, 1),
  ('Bebordingsvoertuig',    'uur',  0.00,  85.00, 1),
  ('Stortbon verwerking',   'stuk', 45.00,  0.00, 1);

-- =============================================================================
-- EINDE SCRIPT
-- =============================================================================
