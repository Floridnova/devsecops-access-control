const bcrypt = require("bcryptjs");

// Invented demo password for ALL seed users. Only used locally and in tests.
const DEMO_PASSWORD = "demo-password-123";
const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);

// Passwords are only ever stored as bcrypt hashes.
const users = [
  { id: 1, name: "Hana Admin", email: "admin@dinedesk.test", role: "admin", branchId: null, active: true },
  { id: 2, name: "Abel Waiter", email: "waiter.bole@dinedesk.test", role: "waiter", branchId: "bole", active: true },
  { id: 3, name: "Selam Cashier", email: "cashier.bole@dinedesk.test", role: "cashier", branchId: "bole", active: true },
  { id: 4, name: "Dawit Manager", email: "manager.bole@dinedesk.test", role: "manager", branchId: "bole", active: true },
  { id: 5, name: "Meron Waiter", email: "waiter.piassa@dinedesk.test", role: "waiter", branchId: "piassa", active: true },
  { id: 6, name: "Yonas Cashier", email: "cashier.piassa@dinedesk.test", role: "cashier", branchId: "piassa", active: true },
  { id: 7, name: "Tigist Manager", email: "manager.piassa@dinedesk.test", role: "manager", branchId: "piassa", active: true },
].map((u) => ({ ...u, passwordHash: hash }));

const orders = [
  { id: 1, branchId: "bole", table: "B1", items: [{ name: "Tibs", quantity: 2, price: 250 }], total: 500, createdBy: 2 },
  { id: 2, branchId: "bole", table: "B4", items: [{ name: "Kitfo", quantity: 1, price: 320 }], total: 320, createdBy: 2 },
  { id: 3, branchId: "piassa", table: "P2", items: [{ name: "Shiro", quantity: 3, price: 120 }], total: 360, createdBy: 5 },
  { id: 4, branchId: "piassa", table: "P7", items: [{ name: "Injera", quantity: 4, price: 40 }], total: 160, createdBy: 5 },
];

let nextOrderId = 5;

function findUserByEmail(email) {
  return users.find((u) => u.email === String(email).toLowerCase()) || null;
}

function findUserById(id) {
  return users.find((u) => String(u.id) === String(id)) || null;
}

function findOrderById(id) {
  return orders.find((o) => String(o.id) === String(id)) || null;
}

function createOrder({ branchId, table, items, createdBy }) {
  const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const order = { id: nextOrderId++, branchId, table, items, total, createdBy };
  orders.push(order);
  return order;
}

module.exports = {
  DEMO_PASSWORD,
  users,
  orders,
  findUserByEmail,
  findUserById,
  findOrderById,
  createOrder,
};