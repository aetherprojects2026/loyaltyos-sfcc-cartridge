'use strict';

/**
 * HTTP service to the LoyaltyOS Order Ingestion API.
 * Service ID: "loyaltyos.http.ingest" — create it in Business Manager (or import metadata/services.xml).
 * Auth: "Authorization: ApiKey <key>" (the platform's LoyaltyAuth scheme). Switch to an OAuth2 bearer
 * token if you prefer client-credentials — see README.
 * PII is never written to the service log (log messages are suppressed).
 */
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');

function createIngestService() {
    return LocalServiceRegistry.createService('loyaltyos.http.ingest', {
        createRequest: function (svc, payload) {
            var site = Site.getCurrent();
            var endpoint = site.getCustomPreferenceValue('loyaltyOSEndpoint');   // e.g. https://api.tenant.example.com
            var apiKey = site.getCustomPreferenceValue('loyaltyOSApiKey');
            svc.setURL(endpoint + '/api/v1/orders');
            svc.setRequestMethod('POST');
            svc.addHeader('Content-Type', 'application/json');
            svc.addHeader('Authorization', 'ApiKey ' + apiKey);
            return JSON.stringify(payload);
        },
        parseResponse: function (svc, response) {
            return { statusCode: response.statusCode, body: response.text };
        },
        getRequestLogMessage: function () { return ''; },   // suppress — payload contains PII
        getResponseLogMessage: function () { return ''; }
    });
}

module.exports = { createIngestService: createIngestService };
