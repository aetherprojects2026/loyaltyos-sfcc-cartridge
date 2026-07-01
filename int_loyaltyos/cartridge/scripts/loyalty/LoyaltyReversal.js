'use strict';

var Transaction = require('dw/system/Transaction');
var Logger = require('dw/system/Logger').getLogger('loyaltyos', 'reversal');
var Service = require('*/cartridge/scripts/services/loyaltyOSService');

var TYPE_VOID = 'void';
var TYPE_REFUND = 'refund';

var STATUS_EXPORTED = 'EXPORTED';
var STATUS_FAILED = 'FAILED';

function setStatus(order, status) {
    Transaction.wrap(function () { order.custom.loyaltyReversalStatus = status; });
}

/**
 * Sum the amount refunded on an order across its refunded invoices.
 * INTEGRATION: confirm the invoice/amount source against your SFCC order/payment model. This uses
 * dw.order.Invoice with STATUS_MANUAL/refund semantics via getGrandTotal on refund-type invoices; some
 * implementations track refunds on payment transactions instead.
 */
function refundedAmount(order) {
    var total = 0;
    var invoices = order.getInvoices ? order.getInvoices().iterator() : null;
    if (!invoices) { return 0; }
    while (invoices.hasNext()) {
        var inv = invoices.next();
        // A credit/refund invoice carries a negative or refund-typed grand total depending on config.
        if (inv.getType && inv.getType() === require('dw/order/Invoice').TYPE_RETURN) {
            var gt = inv.getGrandTotal();
            if (gt) { total += Math.abs(gt.getValue()); }
        }
    }
    return total;
}

/**
 * Build the reversal payload the platform reversal API expects, from an SFCC Order.
 * `type` is 'void' (full cancellation) or 'refund' (proportional refund). For a refund the caller may
 * pass an explicit amount; otherwise it is derived from the order's refund invoices.
 * Returns null when a refund has no positive amount (nothing to reverse).
 */
function buildPayload(order, type, explicitAmount) {
    var payload = {
        order_no: order.getOrderNo(),
        type: type,
        reason: 'sfcc:' + type
    };

    if (type === TYPE_REFUND) {
        var amount = (typeof explicitAmount === 'number') ? explicitAmount : refundedAmount(order);
        if (!amount || amount <= 0) { return null; }
        payload.amount = amount;
        payload.currency = order.getCurrencyCode();
    }

    return payload;
}

/**
 * Export a single reversal to LoyaltyOS. The platform keys reversals to the original order_no and is
 * idempotent, so re-exporting is safe. Returns true on success (or on a no-op refund with no amount).
 */
function exportReversal(order, type, explicitAmount) {
    var payload = buildPayload(order, type, explicitAmount);
    if (!payload) {
        Logger.info('No reversible amount for {0}; marking exported (no-op).', order.getOrderNo());
        setStatus(order, STATUS_EXPORTED);
        return true;
    }

    try {
        var result = Service.createReversalService().call(payload);
        var http = result && result.object;
        if (result.status === 'OK' && http && http.statusCode >= 200 && http.statusCode < 300) {
            setStatus(order, STATUS_EXPORTED);
            return true;
        }
        Logger.error('LoyaltyOS reversal failed for {0} ({1}): svc={2} http={3}',
            order.getOrderNo(), type, result ? result.status : 'n/a', http ? http.statusCode : 'n/a');
        setStatus(order, STATUS_FAILED);
        return false;
    } catch (e) {
        Logger.error('LoyaltyOS reversal exception for {0} ({1}): {2}', order.getOrderNo(), type, e.message);
        setStatus(order, STATUS_FAILED);
        return false;
    }
}

module.exports = {
    TYPE_VOID: TYPE_VOID,
    TYPE_REFUND: TYPE_REFUND,
    buildPayload: buildPayload,
    exportReversal: exportReversal
};
