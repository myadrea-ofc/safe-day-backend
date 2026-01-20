function siteDepartmentMiddleware(req, res, next) {
  const user = req.user;

  const bodySiteId = req.body.site_id;
  const bodyDepartmentId = req.body.department_id;

  if (!bodySiteId && !bodyDepartmentId) {
    return next();
  }

  if (bodySiteId && bodySiteId !== user.site_id) {
    return res.status(403).json({
      message: "Tidak boleh akses site lain",
    });
  }

  if (bodyDepartmentId && bodyDepartmentId !== user.department_id) {
    return res.status(403).json({
      message: "Tidak boleh akses department lain",
    });
  }

  next();
}

module.exports = siteDepartmentMiddleware;
