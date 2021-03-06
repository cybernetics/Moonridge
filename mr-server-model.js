var exposeMethods = require('./mr-rpc-methods');
var EventEmitter = require("events").EventEmitter;
var debug = require('debug')('moonridge:server');
var _ = require('lodash');
var mongoose = require('mongoose');

/**
 * @param {String} name
 * @param {Schema} schema NOTE: don't use these properties on your schemas: '$$hashKey', '__id', '__v', those names are
 * reserved for angular and Mongoose
 * @param {Object} opts
 * @param {Boolean} opts.readOnly will expose only find and sub/pub methods
 * @param {Object} opts.permissions should look something like:
 																permissions: {
																	C: 1,
																	R: 0,
																	U: 5,
																	D: 5
																}
 * @param {Object} opts.statics will extend the mongoose schema.statics so that you can call this function on your model
 * @param {Function} opts.schemaInit gives you opportunity to use schema before mongoose model is instantiated
 * @returns {Object}
 */
module.exports = function moonridgeModel(name, schema, opts) {
	opts = opts || {};

	_.assign(schema, {owner: {type: mongoose.Schema.Types.ObjectId, ref: 'user'}});   //users own all other entities
	//mongoose schema
	var mgSchema = new mongoose.Schema(schema);

	if (opts.statics) {
		_.extend(mgSchema.statics, opts.statics);
	}

	if (opts.schemaInit) {
		debug('running schemaInit for ' + name);
		opts.schemaInit(mgSchema);
	}

	var paths = mgSchema.paths;
	var pathPermissions = {};
	for (var prop in paths) {
		if (paths[prop].options) {
			var perm = paths[prop].options.permissions; // looks like {R: 10, W: 20}
			if (perm) {
				pathPermissions[prop] = perm;
			}
		}
	}
	mgSchema.pathPermissions = pathPermissions; // prepared object for handling access control

	var newDocs = [];
	mgSchema.pre('save', function(next) {
		if (this.isNew) {
			newDocs.push(this._id);
		}
		next();
	});

	// Hook `save` post method called after creation/update
	mgSchema.post('save', function postSave(doc) {
		var indexInNewDocs = newDocs.indexOf(doc._id);
		if (indexInNewDocs !== -1) {
			newDocs.splice(indexInNewDocs, 1);
			mgSchema.emit('create', doc);
		} else {
			mgSchema.emit('update', doc);
		}
		return true;
	});


	mgSchema.post('remove', function postRemove(doc) {
		mgSchema.emit('remove', doc);
	});

	var model = mongoose.model(name, mgSchema);
	var exposeCallback = exposeMethods(model, mgSchema, opts);

	//these two methods are possible to use and your LQ will refresh accordingly, it is not possible with
	var originalFindByIdAndUpdate = model.findByIdAndUpdate;
	var originalFindByIdAndRemove = model.findByIdAndRemove;

	_.assign(model, {
		findByIdAndUpdate: function() {
			var args = arguments;
			return originalFindByIdAndUpdate.apply(model, args).then(function(result) {
				mgSchema.emit('update', args[0]);
				return result;
			});
		},
		findByIdAndRemove: function() {
			var args = arguments;
			return originalFindByIdAndRemove.apply(model, args).then(function(result) {
				mgSchema.emit('remove', args[0]);
				return result;
			});
		},
		schemaInit: opts.schemaInit,
		moonridgeSchema: schema,
		_exposeCallback: exposeCallback
	});

	return model;

};