'use strict';
const qtoolsGen = require('qtools');
const qtools = new qtoolsGen(module);

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

const permissionMasterGen = require('permission-master');

//START OF moduleFunction() ============================================================

var moduleFunction = function(args) {

	qtools.validateProperties({
		subject: args || {},
		targetScope: this, //will add listed items to targetScope
		propList: [
			{
				name: 'config',
				optional: false
			},
			{
				name: 'apiManager',
				optional: true
			},
			{
				name: 'initCallback',
				optional: false
			}
		]
	});
	
	qtools.validateProperties({
		subject: this.config || {},
		targetScope: this, //will add listed items to targetScope
		propList: [
			{
				name: 'webInit',
				optional: false
			}
		]
	});
	
	qtools.validateProperties({
		subject: this.config.webInit || {},
		targetScope: this, //will add listed items to targetScope
		propList: [
			{
				name: 'port',
				optional: false
			},
			{
				name: 'name',
				optional: false
			},
			{
				name: 'htmlFilePath',
				optional: true
			}
		]
	});

	this.permissionMaster = new permissionMasterGen(args);

	//LOCAL FUNCTIONS ====================================

	
	const listPaths=()=>{
				console.log("\nexpress.route path list (at startAll) =========================\n");
			this.router._router.stack.forEach((item) => {
				console.log(item.regexp);
			});
			console.log("\nEND express.route =========================\n");

};

	//METHODS AND PROPERTIES ====================================

	this.shutdown = (message, callback) => {
		callback('', message);
	}

	//START SERVER =======================================================
	
	const expressRoutesErrorHandler=(err, req, res, next)=>{
			err=err?err:{};
			if ((!err.code || typeof (+err.code) != 'number') && (!err.statusCode || typeof (+err.statusCode) != 'number')){
				err.code=500;
			}
			if (err.errorObject){
				err.errorText=err.errorObject;
			}
			
			const miscInconsistencyNeedsCleanup=(err.errorText && err.errorText.errorText) || err.message;
			
			const foundErrorText=miscInconsistencyNeedsCleanup || err.errorText; //use err.errorText from now on
			
			if (isNaN(err.code || err.statusCode)){
				err.code=500;
			}
			res.status(err.code || err.statusCode).send({errorSource:'web-init', errorText:(foundErrorText || 'unexpected error')});
		};

	this.startServer = () => {

		app.use(expressRoutesErrorHandler);

		const server = app.listen(this.port);

		server.on('listening', ()=>{
			var address = server.address();
			var url = 'http://' + (address.address === '::' ?
				'localhost' : address.address) + ':' + address.port;
				
			qtools.message(`${this.name} SERVER starting on ${url}\nat ${new Date().toLocaleDateString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			})} `);
		});

	}

	//SET UP SERVER =======================================================

	app.use(bodyParser.urlencoded({
		extended: true
	}))
	app.use(bodyParser.json())
	
	app.use(cookieParser('', {decode:JSON.parse}))
	
	app.use((req, res, next) => {
		if (typeof (this.transactionCount) == 'undefined') {
			this.transactionCount = 0;
		}
		this.transactionCount++;
		//	console.log("transaction# " + this.transactionCount + " =======================\n");
		next();
	});

	app.use((req, res, next) => {
		const headers = {};
		for (var i in req.headers) {
			var element = req.headers[i];
			if (!(i.match(/^x-/) || i.match(/^host/))) {
				headers[i] = element;
			}
		}
		req.headers = headers;
		next();
	});
// 	app.use((req, res, next) => {
// 		console.log(`req.path= ${req.path}`);
// 		next();
// 	});

	const unpackRequest = (req, res, next) => {
		/*to accomodate the token, the transfer format is:
			{
				data://whatever the data source wants,
				token://whatever the security system wants
			}
		*/

		if (req.cookies && req.cookies.token){
			req.token = req.cookies.token;
		}

		if (req.query) {
			if (req.query.token) {
				req.token = req.query.token;
			}
			delete req.query.token;
			req.query = Object.assign({}, req.query, req.query.data);
		}
		if (req.body) {
			if (req.body.token) {
				req.token = req.body.token;
			}
			delete req.body.token;
			if (req.body.data){
				req.body = req.body.data;
			}
		}

			if (req.body && req.body.token){
			delete req.body.token;
			}
		next();
	};
	
	if(this.config.webInit.htmlFilePath){
		app.use(express.static(this.config.webInit.htmlFilePath));
	}

	app.use(unpackRequest, this.permissionMaster.checkPath);
	

	let route;
	let method;
	
	route = new RegExp('/ping$');
	method='get';
	this.permissionMaster.addRoute(method, route, 'all');
	app[method](route, (req, res, next)=>{
		res.send(`webInit() says, ${this.config.webInit.name} is up and running at ${req.path}`);
	})

	//INITIALIZATION ====================================
	if (this.apiManager){
		this.apiManager.registerApi('listPaths', listPaths);
	}

	this.router = app;
	this.initCallback();

	return this;
};			

//END OF moduleFunction() ============================================================

module.exports = moduleFunction;
//module.exports = new moduleFunction();

