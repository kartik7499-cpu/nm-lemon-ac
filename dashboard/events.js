const { EventEmitter } = require("events");

const dashboardEvents = new EventEmitter();
const catchLogs = [];
const MAX_CATCH_LOGS = 200;

function addCatchLog(message) {
  const item = {
    message,
    timestamp: Date.now(),
  };
  catchLogs.push(item);
  if (catchLogs.length > MAX_CATCH_LOGS) {
    catchLogs.splice(0, catchLogs.length - MAX_CATCH_LOGS);
  }
  dashboardEvents.emit("catchLog", item);
}

function getRecentCatchLogs(limit = 50) {
  return catchLogs.slice(-Math.max(1, Math.min(200, Number(limit) || 50)));
}

module.exports = {
  dashboardEvents,
  addCatchLog,
  getRecentCatchLogs,
};
