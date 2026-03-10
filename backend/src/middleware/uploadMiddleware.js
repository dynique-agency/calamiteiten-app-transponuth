'use strict';

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// Zorg dat de upload-map bestaat bij het laden van de module
const UPLOAD_MAP = path.join(process.cwd(), process.env.UPLOAD_MAP || 'uploads');
if (!fs.existsSync(UPLOAD_MAP)) {
  fs.mkdirSync(UPLOAD_MAP, { recursive: true });
}

// Toegestane afbeeldingsformaten
const TOEGESTANE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_GROOTTE_MB   = Number(process.env.MAX_BESTAND_GROOTTE_MB) || 10;

/**
 * Multer disk-storage: unieke bestandsnamen op basis van timestamp + crypto-random.
 * Behoudt de originele extensie voor leesbaarheid.
 */
const opslag = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_MAP),
  filename:    (_req, file, cb) => {
    const uniek   = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const extensie = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `foto_${uniek}${extensie}`);
  },
});

/**
 * Filtert bestanden op MIME-type.
 * Weigert niet-ondersteunde formaten met een duidelijke foutmelding.
 */
function bestandsFilter(_req, file, cb) {
  if (TOEGESTANE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(
      new Error(`Ongeldig bestandsformaat: ${file.mimetype}. Toegestaan: JPEG, PNG, WebP, HEIC.`),
      { statusCode: 415 }
    ));
  }
}

/**
 * Multer-instantie voor foto-uploads.
 * Maximaal 10 bestanden per aanvraag, elk max. MAX_GROOTTE_MB MB.
 */
const uploadFotos = multer({
  storage:  opslag,
  fileFilter: bestandsFilter,
  limits: {
    fileSize: MAX_GROOTTE_MB * 1024 * 1024,
    files:    10,
  },
});

/**
 * Multer-instantie voor CSV-import (opgeslagen in memory, niet op schijf).
 */
const uploadCSV = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Alleen CSV-bestanden zijn toegestaan.'), { statusCode: 415 }));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5 MB CSV
});

module.exports = { uploadFotos, uploadCSV, UPLOAD_MAP };
