const _ = require('lodash');

module.exports = function (request, client, config) {
  const allowedIndices = config.get('oauth2.allowedIndices');
  if (allowedIndices.length === 0) {
    return;
  }

  var paths = _.get(request, 'params.paths', '');
  var parts = _(paths).split('/').compact().value();

  if (parts.length < 2) {
    return;
  }

  if (!(parts[0] === 'index-pattern' && parts[1] === '_search')) {
    return;
  }

  return client.search({
    index: config.get('kibana.index'),
    type: 'index-pattern'
  }).then(function (result) {
    var allowed = _.filter(result.hits.hits, function (hit) {
      return allowedIndices.indexOf(hit._id) !== -1;
    });
    result.hits.hits = allowed;
    result.hits.total = allowed.length;
    return result;
  }).catch(function (error) {
    return null;
  });
}
