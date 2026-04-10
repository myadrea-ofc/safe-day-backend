const express = require('express');
const router = express.Router();

const {
  getListUnit,
  getNoLambungByUnit,
  getDepartment,
  getJabatan,
  getPerusahaan,
} = require('../controllers/dropdown.controller');

router.get('/list-unit', getListUnit);
router.get('/no-lambung-unit', getNoLambungByUnit);
router.get('/department', getDepartment);
router.get('/jabatan', getJabatan);
router.get('/perusahaan', getPerusahaan);

module.exports = router;