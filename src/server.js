let config;
try {
  config = require("./config");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require("./app");

app.listen(config.port, () => {
  console.log(`DineDesk API listening on port ${config.port}`);
});