'use strict';

/**
 * HTTP services to the LoyaltyOS APIs.
 *
 * - createIngestService()   -> Order Ingestion API   (POST {endpoint}/api/v1/orders)
 * - createReversalService() -> Order Reversal API     (POST {endpoint}/api/v1/orders/reversals)
 *
 * Service IDs: "loyaltyos.http.ingest" and "loyaltyos.http.reversal" — create them in Business Manager
 * (or import metadata/services.xml).
 * Auth: "Authorization: ApiKey <key>" (the platform's LoyaltyAuth scheme). Switch to an OAuth2 bearer
 * token if you prefer client-credentials — see README.
 * PII is never written to the service log (log messages are suppressed).
 */
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');

function endpointAndKey() {
    var site = Site.getCurrent();
    return {
        endpoint: site.getCustomPreferenceValue('loyaltyOSEndpoint'),   // e.g. https://api.tenant.example.com
        apiKey: site.getCustomPreferenceValue('loyaltyOSApiKey')
    };
}

function createIngestService() {
    return LocalServiceRegistry.createService('loyaltyos.http.ingest', {
        createRequest: function (svc, payload) {
            var cfg = endpointAndKey();
            svc.setURL(cfg.endpoint + '/api/v1/orders');
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('Authorization', 'ApiKey ' + cfg.apiKey);
            return JSON.stringify(payload);
        },
        parseResponse: function (svc, response) {
            return { statusCode: response.statusCode, body: response.text };
        },
        getRequestLogMessage: function () { return ''; },   // suppress — payload contains PII
        getResponseLogMessage: function () { return ''; }
    });
}

function createReversalService() {
    return LocalServiceRegistry.createService('loyaltyos.http.reversal', {
        createRequest: function (svc, payload) {
            var cfg = endpointAndKey();
            // INTEGRATION: confirm the platform reversal endpoint path + shape (see CONTRACTS-TO-CONFIRM S4).
            //   void   : { order_no, type: "void",   reason }
            //   refund : { order_no, type: "refund", amount, currency, reason }  (proportional refund)
            // Assumed a single reversals endpoint that switches on `type`; the platform may instead expose
            // separate /void and /refund routes keyed by order_no.
            svc.setURL(cfg.endpoint + '/api/v1/orders/reversals');
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('Authorization', 'ApiKey ' + cfg.apiKey);
            return JSON.stringify(payload);
        },
        parseResponse: function (svc, response) {
            return { statusCode: response.statusCode, body: response.text };
        },
        getRequestLogMessage: function () { return ''; },
        getResponseLogMessage: function () { return ''; }
    });
}

module.exports = {
    createIngestService: createIngestService,
    createReversalService: createReversalService
};
