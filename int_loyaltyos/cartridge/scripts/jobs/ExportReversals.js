'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger').getLogger('loyaltyos', 'reversal');
var LoyaltyReversal = require('*/cartridge/scripts/loyalty/LoyaltyReversal');

/**
 * Job step (custom.LoyaltyOS.ExportReversals): export cancel/refund reversals to LoyaltyOS.
 *
 * Scans orders within a lookback window that either:
 *   - became CANCELLED (full void), or
 *   - carry a refund (partial/proportional refund),
 * and whose reversal has not yet been exported (custom.loyaltyReversalStatus != EXPORTED).
 *
 * The platform keys reversals to the original order_no and is idempotent, so overlap is harmless.
 * Configure schedule + lookback in Business Manager (Administration > Operations > Jobs).
 */
function run(parameters) {
    if (!Site.getCurrent().getCustomPreferenceValue('loyaltyOSEnabled')) {
        return new Status(Status.OK, 'DISABLED', 'LoyaltyOS export is disabled for this site.');
    }

    var lookbackHours = (parameters && parameters.LookbackHours) ? Number(parameters.LookbackHours) : 72;
    var since = new Date(Date.now() - (lookbackHours * 3600 * 1000));

    // INTEGRATION: confirm the search predicate for "has a refund since lookback" against your order model.
    // We approximate refunds via lastModified within the window; the reversal builder derives the amount
    // from refund invoices and no-ops when there is nothing to reverse.
    var orders = OrderMgr.searchOrders(
        'lastModified >= {0} AND (custom.loyaltyReversalStatus = NULL OR custom.loyaltyReversalStatus != {1})',
        'lastModified asc',
        since,
        'EXPORTED'
    );

    var voided = 0, refunded = 0, skipped = 0, fail = 0;
    try {
        while (orders.hasNext()) {
            var order = orders.next();

            if (order.getStatus().getValue() === Order.ORDER_STATUS_CANCELLED) {
                if (LoyaltyReversal.exportReversal(order, LoyaltyReversal.TYPE_VOID)) { voided++; } else { fail++; }
                continue;
            }

            // Not cancelled: attempt a proportional refund reversal. buildPayload/exportReversal
            // no-op (and mark EXPORTED) when the order has no positive refunded amount.
            var payload = LoyaltyReversal.buildPayload(order, LoyaltyReversal.TYPE_REFUND);
            if (!payload) { skipped++; continue; }

            if (LoyaltyReversal.exportReversal(order, LoyaltyReversal.TYPE_REFUND)) { refunded++; } else { fail++; }
        }
    } finally {
        orders.close();
    }

    Logger.info('LoyaltyOS reversal export complete: {0} voided, {1} refunded, {2} skipped, {3} failed',
        voided, refunded, skipped, fail);
    return new Status(Status.OK, 'OK',
        'Reversals: ' + voided + ' voided, ' + refunded + ' refunded, ' + skipped + ' skipped, ' + fail + ' failed.');
}

module.exports = { run: run };
