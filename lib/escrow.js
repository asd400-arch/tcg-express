// Escrow amounts for refunds.
//
// process_bid_acceptance holds the full job price in express_transactions.total_amount but only
// debits the customer total_amount − coupon_discount (the voucher part is TCG-funded, and the RPC
// writes the discount it applied back to express_jobs.coupon_discount). Refunds must therefore
// return what the customer actually paid, never the voucher part.

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

function totalOf(txn, job) {
  return parseFloat(txn?.total_amount ?? job?.final_amount) || 0;
}

/** What the customer paid into escrow for this job. */
export function customerPaidAmount(txn, job) {
  const coupon = Math.max(0, parseFloat(job?.coupon_discount) || 0);
  return r2(Math.max(0, totalOf(txn, job) - coupon));
}

/**
 * Refund due to the customer when the driver ends up with `driverAmount` of the job price
 * (before commission). The voucher is used up first, so the customer gets back
 * min(what they paid, price − driverAmount).
 */
export function customerRefundAfter(txn, job, driverAmount) {
  const paid = customerPaidAmount(txn, job);
  return r2(Math.max(0, Math.min(paid, totalOf(txn, job) - (Number(driverAmount) || 0))));
}
