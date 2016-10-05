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
        allowedIndices: Joi.array().items(Joi.string()).single(),
        allowedDomains: Joi.alternatives().when('provider', {
          is: 'google',
          then: Joi.array().items(Joi.string()),
          otherwise: Joi.any().forbidden()
        }),
        allowedOrganizations: Joi.alternatives().when('provider', {
          is: 'github',
          then: Joi.array().items(Joi.string()),
          otherwise: Joi.any().forbidden()
        })
      }).default()
    },

    uiExports: {
      chromeNavControls: ['plugins/oauth2/logout_button']
    },

    init: function (server, options) {
      const config = server.config();
      if (config.get('oauth2.password') == null) throw new Error('oauth2.password is required in kibana.yml.');
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
          provider: config.get('oauth2.provider'),
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

          var allowedIndices = config.get('oauth2.allowedDomains');
          if (allowedIndices && allowedIndices.length) {
            if (allowedIndices.indexOf(_.get(request.auth.credentials, 'profile.raw.domain')) === -1) {
              return reply(Boom.forbidden('Domain not allowed'));
            }
          }

          if (config.has('oauth2.allowedOrganizations')) {
            const allowedOrganizations = config.get('oauth2.allowedOrganizations');
            const token = _.get(request.auth.credentials, 'token');
            axios.get('https://api.github.com/user/orgs', {
              headers: { 'Authorization': 'token ' + token }
            }).then(function(response) {
              const organizations = response.data.map((org) => org.login);
              for (let organization of organizations) {
                if (allowedOrganizations.indexOf(organization) !== -1) {
                  request.auth.session.set(request.auth.credentials);
                  return reply.redirect('./');
                }
              }
              return reply(Boom.forbidden('None of the user\'s organization is allowed'));
            }).catch(function (error) {
              return reply(Boom.unauthorized('Unable to verify the user\'s organizations'));
            });
            return;
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
