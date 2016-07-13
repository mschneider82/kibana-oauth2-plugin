# Kibana Auth Plugin
An OAuth Plugin for Kibana 4.  It uses [Bell](https://github.com/hapijs/bell) for the OAuth handling.

### Requirements
Kibana 4.4+

### Installation steps
1. Download and unpack [Kibana](https://www.elastic.co/downloads/kibana).
2. From the Kibana root directory, install the plugin with the following command:

```
bin/kibana plugin -i oauth2 -u https://github.com/trevan/oauth2/releases/download/0.1.0/oauth2-0.1.0.zip
```

3. Set the following config options that map to [Bell `server.auth.strategy` options](https://github.com/hapijs/bell/blob/master/API.md):
```
oauth2.password
oauth2.provider
oauth2.clientId
oauth2.clientSecret
```

To get the list of supported providers, see [Bell's documentation](https://github.com/hapijs/bell)

Don't forget to set the SSL key and certificate before deploying to production!

### Issues
Please file issues [here](https://github.com/trevan/oauth2/issues).
