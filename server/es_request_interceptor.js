const _ = require('lodash');

const kibanaIndexInterceptor = require('./lib/kibana_index_interceptor');

module.exports = function (server) {
  const config = server.config();
  server.ext('onPreAuth', function (request, reply) {
    if (_.get(request, 'route.realm.plugin', '') === 'elasticsearch') {
      if (request.method === 'post' || request.method === 'put') {
        request.route.settings.payload.output = 'data';
      }
    }
    return reply.continue();
  });

  server.ext('onPreHandler', function (request, reply) {
    var result;
    if (_.get(request, 'route.realm.plugin', '') === 'elasticsearch') {
      switch (_.get(request, 'route.path', '')) {
        case '/elasticsearch/{paths*}':
          break;
        case '/elasticsearch/_mget':
          break;
        case '/elasticsearch/{index}/_search':
          break;
        case '/elasticsearch/{index}/_field_stats':
          break;
        case '/elasticsearch/_msearch':
          break;
        case '/elasticsearch/_search/scroll':
          break;
        case '/elasticsearch/' + config.get('kibana.index') + '/{paths*}':
          result = kibanaIndexInterceptor(request, server.plugins.elasticsearch.client, config);
          break;
      }
    }
    return Promise.resolve(result).then(function (result) {
      if (result) {
        return reply(result);
      } else {
        return reply.continue();
      }
    });
  });
}
