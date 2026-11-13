// Each role maps to a list of named permissions.
const ROLE_PERMISSIONS = Object.freeze({
  waiter: ["orders:create", "orders:read"],
  cashier: ["orders:read", "payments:create"],
  manager: ["orders:read", "reports:read"],
  admin: ["users:manage", "orders:read", "reports:read"],
});

// Deny by default: an unknown role gets an empty list.
// hasOwnProperty stops odd role values like "constructor" or "__proto__".
function getPermissions(role) {
  if (typeof role !== "string") return [];
  if (!Object.prototype.hasOwnProperty.call(ROLE_PERMISSIONS, role)) return [];
  return ROLE_PERMISSIONS[role];
}

function hasPermission(role, permission) {
  return getPermissions(role).includes(permission);
}

module.exports = { ROLE_PERMISSIONS, getPermissions, hasPermission };