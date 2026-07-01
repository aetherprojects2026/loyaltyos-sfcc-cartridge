'use strict';

var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger').getLogger('loyaltyos', 'export');
var Service = require('*/cartridge/scripts/services/loyaltyOSService');
var Payload = require('*/cartridge/scripts/loyalty/OrderPayload');

var STATUS_EXPORTED = 'EXPORTED';
var STATUS_FAILED = 'FAILED';

function setStatus(order, status) {
    Transaction.wrap(function () { order.custom.loyaltyExportStatus = status; });
}

/**
 * Export a single order to LoyaltyOS. The platform is idempotent by order_no, so re-exporting is safe.
 * Returns true on success.
 */
function exportOrder(order) {
    try {
        var result = Service.createIngestService().call(Payload.build(order));
        var http = result && result.object;
        if (result.status === 'OK' && http && http.statusCode >= 200 && http.statusCode < 300) {
            setStatus(order, STATUS_EXPORTED);
            return true;
        }
        Logger.error('LoyaltyOS export failed for {0}: svc={1} http={2}',
            order.getOrderNo(), result ? result.status : 'n/a', http ? http.statusCode : 'n/a');
        setStatus(order, STATUS_FAILED);
        return false;
    } catch (e) {
        Logger.error('LoyaltyOS export exception for {0}: {1}', order.getOrderNo(), e.message);
        setStatus(order, STATUS_FAILED);
        return false;
    }
}

module.exports = { exportOrder: exportOrder };
