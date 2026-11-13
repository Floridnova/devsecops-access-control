// ONE function decides whether a user may see a given order.
// Every route that returns an order must call it.
function canAccessOrder(user, order) {
  if (!user || !order) return false;

  // Administrators belong to no branch and may see every order.
  if (user.role === "admin") return true;

  // Everyone else: only their own branch. A user with no branch gets nothing.
  if (!user.branchId) return false;
  return user.branchId === order.branchId;
}

module.exports = { canAccessOrder };