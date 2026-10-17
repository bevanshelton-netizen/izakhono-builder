const DEFAULT_LIMITS = Object.freeze({
  FREE: 10,
  STANDARD: 200,
  OWNER: null
});

function resolveMonthlyAllowance(plan, override) {
  if (Number.isInteger(override) && override >= 0) return override;
  return Object.prototype.hasOwnProperty.call(DEFAULT_LIMITS, plan) ? DEFAULT_LIMITS[plan] : 0;
}

function canConsume({ used, allowance, units = 1 }) {
  if (allowance === null) return true;
  return used + units <= allowance;
}

function remaining({ used, allowance }) {
  if (allowance === null) return null;
  return Math.max(0, allowance - used);
}

module.exports = { DEFAULT_LIMITS, resolveMonthlyAllowance, canConsume, remaining };
