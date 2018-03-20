const Capabilities = require('./openeo/capabilities');
const Users = require('./openeo/users');
const Services = require('./openeo/services');

var geeServer = {

	endpoints: {
		capabilities: Capabilities,
		data: require('./openeo/data'),
		processes: require('./openeo/processes'),
		jobs: require('./openeo/jobs'),
		services: Services,
		users: Users,
		processGraphs: require('./openeo/processGraphs')
	},

	server: null,
	serverPort: 8080,

	init() {
		console.log('Initializing openEO Google Earth Engine driver...');
		const { eeAuthenticator } = require('./openeo/gee.js');
		eeAuthenticator.withConsole(() => {
			console.log("GEE Authentication succeeded.");
			this.startServer();
		}, (error) => {
			console.log("GEE Authentication failed: " + error);
			process.exit(1);
		});
	},

	initEndpoints() {
		var initFuncs = [];
		for(var i in this.endpoints) {
			initFuncs.push(this.endpoints[i].init())
		}
		return Promise.all(initFuncs);
	},

	addEndpoint(method, path, callback) {
		Capabilities.addEndpoint(method, path);
		var serverPath = path.replace(/\{([\w]+)\}/g, ":$1");
		if (method === 'delete') {
			method = 'del';
		}
		this.server[method](serverPath, callback);
	},

	startServer() {		
		const restify = require('restify');
		this.server = restify.createServer();
		this.server.pre(this.preflight);
		this.server.use(restify.plugins.queryParser());
		this.server.use(restify.plugins.bodyParser());
		this.server.use(restify.plugins.authorizationParser());
		this.server.use(this.corsHeader);
		this.server.use(Users.checkAuthToken.bind(Users));

		this.initEndpoints().then(() => {
			// Add routes
			for(var i in this.endpoints) {
				this.endpoints[i].routes(this);
			}
			// Start server on port ...
			const port = process.env.PORT || this.serverPort;
			this.server.listen(port, () => {
				var serverUrl = this.server.url.replace('[::]', '127.0.0.1');
				Services.serverUrl = serverUrl;
				console.log('%s listening at %s', this.server.name, serverUrl)
			});
		}).catch((error) => {
			console.log(error);
			process.exit(2);
		});
	},

	corsHeader(req, res, next) {
		if (!req.headers['origin']) {
			return next();
		}

		res.setHeader('access-control-allow-origin', req.headers['origin']);
		res.setHeader('access-control-allow-credentials', 'true');
		return next();
	},

	preflight(req, res, next) {
		if (req.method !== 'OPTIONS') {
			return next();
		}

		res.once('header', () => {
			res.header('access-control-allow-origin', req.headers['origin'])
			res.header('access-control-allow-credentials', 'true')
			res.header('access-control-allow-methods', 'OPTIONS, GET, POST, PATCH, PUT, DELETE');
			res.header('access-control-allow-headers', 'Authorization, Content-Type');
		});

		res.send(204);
	}

};

geeServer.init();