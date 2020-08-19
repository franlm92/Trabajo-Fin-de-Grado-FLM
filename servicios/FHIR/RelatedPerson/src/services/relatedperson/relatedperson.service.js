/*eslint no-unused-vars: "warn"*/

const { VERSIONS } = require('@asymmetrik/node-fhir-server-core').constants;
const { resolveSchema } = require('@asymmetrik/node-fhir-server-core');
const { COLLECTION, CLIENT_DB } = require('../../constants');
const moment = require('moment-timezone');
const globals = require('../../globals');
const jsonpatch = require('fast-json-patch');

const { getUuid } = require('../../utils/uid.util');

const logger = require('@asymmetrik/node-fhir-server-core').loggers.get();

let getRelatedPerson = (base_version) => {
	return require(resolveSchema(base_version, 'RelatedPerson'));};

let getMeta = (base_version) => {
	return require(resolveSchema(base_version, 'Meta'));};


/**
 *
 * @param {*} args
 * @param {*} context
 * @param {*} logger
 */
module.exports.search = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> search');

	let { base_version } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}


	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);
	let RelatedPerson = getRelatedPerson(base_version);

	// Query our collection for this observation
	collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with RelatedPerson.search: ', err);
			return reject(err);
		}

		// RelatedPerson is a relatedperson cursor, pull documents out before resolving
		data.toArray().then((relatedpersons) => {
			relatedpersons.forEach(function(element, i, returnArray) {
				returnArray[i] = new RelatedPerson(element);
			});
			resolve(relatedpersons);
		});
	});
});

module.exports.searchById = (args) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> searchById');

	let { base_version, id } = args;
	let RelatedPerson = getRelatedPerson(base_version);

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, relatedperson) => {
		if (err) {
			logger.error('Error with RelatedPerson.searchById: ', err);
			return reject(err);
		}
		if (relatedperson) {
			resolve(new RelatedPerson(relatedperson));
		}
		resolve();
	});
});

module.exports.create = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> create');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "RelatedPerson"){
		return reject(new Error("ERROR: JSON doesn't below to a RelatedPerson -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version } = args;

	// Grab an instance of our DB and collection (by version)
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);

	// Get current record
	let RelatedPerson = getRelatedPerson(base_version);
	let relatedperson = new RelatedPerson(resource);

	// If no resource ID was provided, generate one.
	let id = getUuid(relatedperson);

	// Create the resource's metadata
	let Meta = getMeta(base_version);
	relatedperson.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});

	// Create the document to be inserted into Mongo
	let doc = JSON.parse(JSON.stringify(relatedperson.toJSON()));
	Object.assign(doc, {id: id});

	// Create a clone of the object without the _id parameter before assigning a value to
	// the _id parameter in the original document
	let history_doc = Object.assign({}, doc);
	Object.assign(doc, {_id: id});

	// Insert our relatedperson record
	collection.insertOne(doc, (err) => {
		if (err) {
			logger.error('Error with RelatedPerson.create: ', err);
			return reject(err);
		}

		// Save the resource to history
		let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);

		// Insert our relatedperson record to history but don't assign _id
		return history_collection.insertOne(history_doc, (err2) => {
			if (err2) {
				logger.error('Error with RelatedPersonHistory.create: ', err2);
				return reject(err2);
			}
			return resolve({ id: doc.id, resource_version: doc.meta.versionId });
		});
	});
});

module.exports.update = (args, { req }) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> update');

	let resource = req.body;

	// Check if the resourceType of the message is correct
	if(resource.resourceType != "RelatedPerson"){
		return reject(new Error("ERROR: JSON doesn't below to a RelatedPerson -> ResourceType of message: " + resource.resourceType))
	}

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with RelatedPerson.searchById: ', err);
			return reject(err);
		}

		let RelatedPerson = getRelatedPerson(base_version);
		let relatedperson = new RelatedPerson(resource);

		if (data && data.meta) {
			let foundRelatedPerson = new RelatedPerson(data);
			let meta = foundRelatedPerson.meta;
			meta.versionId = `${parseInt(foundRelatedPerson.meta.versionId) + 1}`;
			relatedperson.meta = meta;
		} else {
			let Meta = getMeta(base_version);
			relatedperson.meta = new Meta({versionId: '1', lastUpdated: moment.utc().format('YYYY-MM-DDTHH:mm:ssZ')});
		}

		let cleaned = JSON.parse(JSON.stringify(relatedperson));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our relatedperson record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with RelatedPerson.update: ', err2);
				return reject(err2);
			}

			// save to history
			let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);

			let history_relatedperson = Object.assign(cleaned, { id: id });

			// Insert our relatedperson record to history but don't assign _id
			return history_collection.insertOne(history_relatedperson, (err3) => {
				if (err3) {
					logger.error('Error with RelatedPersonHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});

		});
	});
});

module.exports.remove = (args, context) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> remove');

	let { base_version, id } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);
	// Delete our relatedperson record
	collection.deleteOne({ id: id }, (err, _) => {
		if (err) {
			logger.error('Error with RelatedPerson.remove');
			return reject({
				// Must be 405 (Method Not Allowed) or 409 (Conflict)
				// 405 if you do not want to allow the delete
				// 409 if you can't delete because of referential
				// integrity or some other reason
				code: 409,
				message: err.message
			});
		}

		// delete history as well.  You can chose to save history.  Up to you
		let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);
		return history_collection.deleteMany({ id: id }, (err2) => {
			if (err2) {
				logger.error('Error with RelatedPerson.remove');
				return reject({
					// Must be 405 (Method Not Allowed) or 409 (Conflict)
					// 405 if you do not want to allow the delete
					// 409 if you can't delete because of referential
					// integrity or some other reason
					code: 409,
					message: err2.message
				});
			}

			return resolve({ deleted: _.result && _.result.n });
		});

	});
});

module.exports.searchByVersionId = (args, context) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> searchByVersionId');

	let { base_version, id, version_id } = args;

	let RelatedPerson = getRelatedPerson(base_version);

	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);

	// Query our collection for this observation
	history_collection.findOne({ id: id.toString(), 'meta.versionId': `${version_id}` }, (err, relatedperson) => {
		if (err) {
			logger.error('Error with RelatedPerson.searchByVersionId: ', err);
			return reject(err);
		}

		if (relatedperson) {
			resolve(new RelatedPerson(relatedperson));
		}

		resolve();

	});
});

module.exports.history = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> history');

	// Common search params
	let { base_version } = args;

	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);
	let RelatedPerson = getRelatedPerson(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with RelatedPerson.history: ', err);
			return reject(err);
		}

		// RelatedPerson is a relatedperson cursor, pull documents out before resolving
		data.toArray().then((relatedpersons) => {
			relatedpersons.forEach(function(element, i, returnArray) {
				returnArray[i] = new RelatedPerson(element);
			});
			resolve(relatedpersons);
		});
	});
});

module.exports.historyById = (args, { req }, context) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> historyById');

	let { base_version, id } = args;
	let query = {};

	if (base_version === VERSIONS['4_0_0']) {
		query = req.query;
	}

	query.id = `${id}`;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);
	let RelatedPerson = getRelatedPerson(base_version);

	// Query our collection for this observation
	history_collection.find(query, (err, data) => {
		if (err) {
			logger.error('Error with RelatedPerson.historyById: ', err);
			return reject(err);
		}

		// RelatedPerson is a relatedperson cursor, pull documents out before resolving
		data.toArray().then((relatedpersons) => {
			relatedpersons.forEach(function(element, i, returnArray) {
				returnArray[i] = new RelatedPerson(element);
			});
			resolve(relatedpersons);
		});
	});
});

module.exports.patch = (args, context) => new Promise((resolve, reject) => {
	logger.info('RelatedPerson >>> patch'); // Should this say update (instead of patch) because the end result is that of an update, not a patch

	let { base_version, id, patchContent } = args;

	// Grab an instance of our DB and collection
	let db = globals.get(CLIENT_DB);
	let collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}`);

	// Get current record
	// Query our collection for this observation
	collection.findOne({ id: id.toString() }, (err, data) => {
		if (err) {
			logger.error('Error with RelatedPerson.searchById: ', err);
			return reject(err);
		}

		// Validate the patch
		let errors = jsonpatch.validate(patchContent, data);
		if (errors && Object.keys(errors).length > 0) {
			logger.error('Error with patch contents');
			return reject(errors);
		}
		// Make the changes indicated in the patch
		let resource = jsonpatch.applyPatch(data, patchContent).newDocument;

		let RelatedPerson = getRelatedPerson(base_version);
		let relatedperson = new RelatedPerson(resource);

		if (data && data.meta) {
			let foundRelatedPerson = new RelatedPerson(data);
			let meta = foundRelatedPerson.meta;
			meta.versionId = `${parseInt(foundRelatedPerson.meta.versionId) + 1}`;
			relatedperson.meta = meta;
		} else {
			return reject('Unable to patch resource. Missing either data or metadata.');
		}

		// Same as update from this point on
		let cleaned = JSON.parse(JSON.stringify(relatedperson));
		let doc = Object.assign(cleaned, { _id: id });

		// Insert/update our relatedperson record
		collection.findOneAndUpdate({ id: id }, { $set: doc }, { upsert: true }, (err2, res) => {
			if (err2) {
				logger.error('Error with RelatedPerson.update: ', err2);
				return reject(err2);
			}

			// Save to history
			let history_collection = db.collection(`${COLLECTION.RELATEDPERSON}_${base_version}_History`);
			let history_relatedperson = Object.assign(cleaned, { _id: id + cleaned.meta.versionId });

			// Insert our relatedPerson record to history but don't assign _id
			return history_collection.insertOne(history_relatedperson, (err3) => {
				if (err3) {
					logger.error('Error with RelatedPersonHistory.create: ', err3);
					return reject(err3);
				}

				return resolve({ id: doc.id, created: res.lastErrorObject && !res.lastErrorObject.updatedExisting, resource_version: doc.meta.versionId });
			});
		});
	});
});
