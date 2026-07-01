'use strict';

var Transaction = require('dw/system/Transaction');
var Site = require('dw/system/Site');

/**
 * OPTIONAL real-time path for OCAPI/SCAPI-created orders: mark the order for export so the next job run
 * picks it up promptly. Storefront (SFRA) checkout is covered by the job's creationDate scan, so this
 * hook is not required — it just reduces latency for headless order creation.
 * Registered via hooks.json as dw.ocapi.shop.order.afterPOST.
 */
function afterPOST(order) {
    if (!Site.getCurrent().getCustomPreferenceValue('loyaltyOSEnabled')) { return; }
    Transaction.wrap(function () {
        if (!order.custom.loyaltyExportStatus) {
            order.custom.loyaltyExportStatus = 'NOT_EXPORTED';
        }
    });
}

module.exports = { afterPOST: afterPOST };
