const pool = require('../config/db');

const getListUnit = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name_unit AS label
      FROM list_unit
      ORDER BY name_unit ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error list unit:', err);
    res.status(500).json({ message: 'Gagal ambil list unit' });
  }
};

const getNoLambungByUnit = async (req, res) => {
  try {
    const { unit_id } = req.query;

    if (!unit_id) {
      return res.status(400).json({ message: 'unit_id wajib diisi' });
    }

    const result = await pool.query(`
      SELECT id, no_unit AS label
      FROM no_lambung_unit
      WHERE name_unit_id = $1
      ORDER BY no_unit ASC
    `, [unit_id]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error no lambung unit:', err);
    res.status(500).json({ message: 'Gagal ambil no lambung unit' });
  }
};

const getDepartment = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name_department AS label
      FROM form_department
      ORDER BY name_department ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error department:', err);
    res.status(500).json({ message: 'Gagal ambil department' });
  }
};

const getJabatan = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, jabatan AS label
      FROM form_jabatan
      ORDER BY jabatan ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error jabatan:', err);
    res.status(500).json({ message: 'Gagal ambil jabatan' });
  }
};

const getPerusahaan = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name_perusahaan AS label
      FROM form_perusahaan
      ORDER BY name_perusahaan ASC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error('Error perusahaan:', err);
    res.status(500).json({ message: 'Gagal ambil perusahaan' });
  }
};

module.exports = {
  getListUnit,
  getNoLambungByUnit,
  getDepartment,
  getJabatan,
  getPerusahaan,
};