'use strict';

/**
 * Builds the SFCC-shaped order payload the platform's `sfcc-order.mapping.json` field-mapping template
 * expects. Keep the key names in sync with that template (order_no, creation_date, currency,
 * order_total, customer.email, customer.customer_no, product_items[]).
 */
function build(order) {
    var items = [];
    var it = order.getAllProductLineItems().iterator();
    while (it.hasNext()) {
        var li = it.next();
        items.push({
            sku: li.getProductID(),
            quantity: li.getQuantityValue(),
            price: li.getAdjustedNetPrice().getValue()
        });
    }

    var profile = order.getCustomer() ? order.getCustomer().getProfile() : null;
    var created = order.getCreationDate();

    return {
        order_no: order.getOrderNo(),
        creation_date: created ? created.toISOString() : null,
        currency: order.getCurrencyCode(),
        order_total: order.getTotalGrossPrice().getValue(),
        customer: {
            email: order.getCustomerEmail() || (profile ? profile.getEmail() : null),
            customer_no: profile ? profile.getCustomerNo() : null
        },
        product_items: items
    };
}

module.exports = { build: build };
