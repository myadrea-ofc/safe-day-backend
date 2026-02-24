module.exports = function mustChangePasswordGuard(req, res, next) {
  if (!req.user) return next();

  if (req.user.must_change_password === true) {
    const allowed = ["/change-password", "/profile"];

    if (!allowed.includes(req.path)) {
      return res.status(403).json({
        message: "Anda harus mengganti password terlebih dahulu",
        must_change_password: true,
      });
    }
  }

  next();
};