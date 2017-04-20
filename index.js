const hapiAuthCookie = require('hapi-auth-cookie');
const Boom = require('boom');
const Bell = require('bell');
const _ = require('lodash');
const axios = require('axios');

const esRequestInterceptor = require('./server/es_request_interceptor');

module.exports = function (kibana) {
  return new kibana.Plugin({
    require: ['kibana', 'elasticsearch'],

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        cookieName: Joi.string().default('sid'),
        password: Joi.string(),
        sessionTimeout: Joi.number().default(30 * 60 * 1000),
        provider: Joi.string(),
        clientId: Joi.string(),
        redirectUri: Joi.string(),
        forceHttps: Joi.boolean(),
        clientSecret: Joi.string(),
        allowedIndices: Joi.array().items(Joi.string()).single()
      }).default()
    },

    uiExports: {
      chromeNavControls: ['plugins/oauth2/logout_button']
    },

    init: function (server, options) {

      const config = server.config();
      if (config.get('oauth2.password') == null) {
          throw new Error('oauth2.password is required in kibana.yml.');
      }
      if (config.get('oauth2.provider') == null || config.get('oauth2.clientId') == null || config.get('oauth2.clientSecret') == null) {
        throw new Error('Please set oauth2.provider, oauth2.clientId, and oauth2.clientSecret in kibana.yml.');
      }

      server.register([hapiAuthCookie, Bell], function (error) {

        server.auth.strategy('session', 'cookie', 'required', {
            cookie: config.get('oauth2.cookieName'),
            password: config.get('oauth2.password'),
            ttl: config.get('oauth2.sessionTimeout'),
            path: config.get('server.basePath') + '/',
            clearInvalid: true,
            keepAlive: true,
            redirectTo: `${config.get('server.basePath')}/login`,
            isSecure: !!config.get('server.ssl.cert')
        });

        server.auth.strategy(config.get('oauth2.provider'), 'bell', {
          provider: {
              protocol: config.get('oauth2.provider.protocol'),
              auth: config.get('oauth2.provider.auth'),
              token: config.get('oauth2.provider.token'),
            //   scope: config.get('oauth2.provider.scope'),
            //   scopeSeparator: config.get('oauth2.provider.scopeSeparator'),
              profile: (credentials, params, get, callback) => {

                  console.log('credentials: ', credentials);
                  callback(null, {});
              }
          },
          password: config.get('oauth2.password'),
          clientId: config.get('oauth2.clientId'),
          clientSecret: config.get('oauth2.clientSecret'),
          location: config.get('oauth2.redirectUri'),
          isSecure: !!config.get('server.ssl.cert'),
          forceHttps: typeof config.get('oauth2.forceHttps') === 'boolean' ? config.get('oauth2.forceHttps') : undefined,
          scope: config.get('oauth2.provider') === 'github' && config.has('oauth2.allowedOrganizations') ? ['user:email', 'read:org'] : undefined
        });
      });

      server.route({
        method: ['GET', 'POST'],
        path: '/login',
        config: {
          auth: config.get('oauth2.provider')
        },
        handler: function (request, reply) {
          if (!request.auth.isAuthenticated) {
            return reply(Boom.unauthorized('Authentication failed: ' + request.auth.error.message));
          }

          request.auth.session.set(request.auth.credentials);

          return reply.redirect('./');
        }
      });

      server.route({
        method: 'GET',
        path: '/logout',
        handler: function (request, reply) {
          request.auth.session.clear();
          reply.redirect('./');
        }
      });

      if (Array.isArray(config.get('oauth2.allowedIndices'))) {
        esRequestInterceptor(server);
      }
    }
  });
};
