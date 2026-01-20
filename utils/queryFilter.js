function buildScopeFilter(user) {
  let where = "";
  let params = [];
  let idx = 1;

  if (user.role !== "superadmin") {
    where += ` site_id = $${idx++}`;
    params.push(user.site_id);
  }

  if (user.role === "member") {
    where += (where ? " AND " : "") + ` department_id = $${idx++}`;
    params.push(user.department_id);
  }

  return { where, params };
}

module.exports = buildScopeFilter;
