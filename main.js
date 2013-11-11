var rpc = require('socket.io-rpc');
var _ = require('lodash');
var model = require('./mr-model');
var lastChangeDate = new Date();

var defIOSetter = function (io) {
	io.set('log level', 1);
	io.set('transports', [ 'websocket']);
	//    io.set('heartbeats', false);  // we would like this, but it does not work like this
};

/**
 *
 * @param server
 * @param app
 * @param {Object} opts
 * @param {Function} opts.ioSetter function for setting up socket io
 * @returns {Function}
 */
module.exports = function (mongoose, server, app, opts) {
	var io = require('socket.io').listen(server);

	app.get('/moonridge-angular-client.js', function (req, res) { //exposed client file
		res.sendfile('/node_modules/moonridge/client/moonridge-angular-client.js');
	});

    if (_.isFunction(opts && opts.ioSetter)) {
        opts.ioSetter(io)
	} else {
		defIOSetter(io);
	}

    rpc.createServer(io, app);

    rpc.expose('Moonridge', {
        getModels: function (cachedDate) {
            if (lastChangeDate > cachedDate) {     // if server was restarted since the cached copy was stored
                var models = mongoose.models;
                return models;
            } else {
                return false;
            }
        }
    });

	io.sockets.on('connection', function (socket) {
        socket.registeredLQs = [];
        socket.on('disconnect', function() {
			//clearing out liveQueries listeners
			var index = socket.registeredLQs.length;
			while(index--) {
				var LQ = socket.registeredLQs[index];
				LQ.removeListener(socket);
			}
		});
	});

	/**
	 *
	 * @returns {MRModel}
	 */
    function regNewModel() {
        lastChangeDate = new Date();
        return model.apply(mongoose, arguments);
    }

    return regNewModel;
};