const Strategy = require('passport-http-bearer').Strategy;
const request = require('superagent');
const env = require('var');

const https = require('https');

/**
 * Bearer Strategy
 *
 * This strategy will handle requests with BearerTokens.  This is only a template and should be configured to
 * your AuthZ server specifications.
 *
 * Requires ENV variables for introspecting the token
 */
module.exports.strategy = new Strategy(
    function(token, done) {

		if (!env.INTROSPECTION_URL) {
			return done(new Error('Invalid introspection endpoint.'));
		}
	
		request
		.get(env.INTROSPECTION_URL)
		.set('Authorization', 'Bearer ' + token)
		.send()
		.then((introspectionResponse) => {
			const profile = introspectionResponse.body;

			if (introspectionResponse.status == 200){
				// TODO: context could come in many forms, you need to decide how to handle it.
				// it could also be decodedToken.patient etc...
				let { role, name, email } = profile;
				let user = {role, name, email};

				if (env.ROLES_WITH_ACCESS.split(',').includes(user.role)){
					// LoUISE
					let scope, context = null;

					// return scopes and context.  Both required
					return done(null, user, {scope, context});
				}else{
					// default return unauthorized
					return done(new Error('Role ' + user.role + ' has no access'));
				}
			}

			// default return unauthorized
			return done(new Error('Response but not status 200'));
		})
		.catch((error) => {
			// default return unauthorized
			return done(new Error('Invalid token'));
		});
	}
);
