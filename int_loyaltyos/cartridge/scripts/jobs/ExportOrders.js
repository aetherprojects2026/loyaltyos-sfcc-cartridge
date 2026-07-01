'use strict';

var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');
var Logger = require('dw/system/Logger').getLogger('loyaltyos', 'export');
var LoyaltyExport = require('*/cartridge/scripts/loyalty/LoyaltyExport');

/**
 * Job step (custom.LoyaltyOS.ExportOrders): export orders not yet sent to LoyaltyOS.
 * Reliable regardless of checkout path; the platform dedupes by order_no so overlap is harmless.
 * Configure the schedule + lookback in Business Manager (Administration > Operations > Jobs).
 */
function run(parameters) {
    if (!Site.getCurrent().getCustomPreferenceValue('loyaltyOSEnabled')) {
        return new Status(Status.OK, 'DISABLED', 'LoyaltyOS export is disabled for this site.');
    }

    var lookbackHours = (parameters && parameters.LookbackHours) ? Number(parameters.LookbackHours) : 72;
    var since = new Date(Date.now() - (lookbackHours * 3600 * 1000));

    var orders = OrderMgr.searchOrders(
        'creationDate >= {0} AND (custom.loyaltyExportStatus = NULL OR custom.loyaltyExportStatus != {1})',
        'creationDate asc',
        since,
        'EXPORTED'
    );

    var ok = 0, fail = 0;
    try {
        while (orders.hasNext()) {
            var order = orders.next();
            if (order.getStatus().getValue() === Order.ORDER_STATUS_FAILED) { continue; }
            if (LoyaltyExport.exportOrder(order)) { ok++; } else { fail++; }
        }
    } finally {
        orders.close();
    }

    Logger.info('LoyaltyOS export complete: {0} ok, {1} failed', ok, fail);
    return new Status(Status.OK, 'OK', 'Exported ' + ok + ' order(s); ' + fail + ' failed.');
}

module.exports = { run: run };
