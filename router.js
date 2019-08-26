// Basic-Router: a simple API server that interacts with a Sia node and acts as a remote proxy. Allows interacting
// with a remote Sia node in an authenticated fashion
// Author: Salva Herrera (keops_cc@outlook.com)

// USER-DEFINED VARIABLES:
// Authentication key for the communication with the router. Change the default key to avoid security breaches!
var routerAuthKey = "keops"
// Modules that the Sia node will start up. Check the Sia documentation for details
var siaModules = "cghrtw"


// Dependencies
var fs = require('fs');
var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var sia = require('sia.js');
var Path = require('path')
var os = require('os')

var app = express();


// Launches a Sia daemon
function startSia(restarts) {
    const child_process = require('child_process');
    var workerProcess = child_process.spawn('./siad', ["M", siaModules, "--authenticate-api=false", "--sia-directory", "/sia-data"]);  
    workerProcess.stdout.on('data', function (data) {  
        console.log(">>>> siad: " + data);  
    });  
    workerProcess.stderr.on('data', function (data) {
        //console.log('//// STDERR: ' + data);  
    });  
    workerProcess.on('close', function (code) {  
        console.log('//// Siad process exited with code ' + code);
        restarts++
        console.log('//// Restarting Siad (attempt: ' + restarts + ') (' + readableTime() + '):')
        startSia(restarts)
    }); 
}
startSia(0)


function readableTime() {
    var date = new Date();
    var year    = date.getFullYear();
    var month   = date.getMonth();
    var day     = date.getDay();
    var hour    = date.getHours();
    var minute  = date.getMinutes();
    var seconds = date.getSeconds();
    var readable = day + "/" + month + "/" + year + " - " + hour + ":" + minute + ":" + seconds
    return readable
}


// API authentication for each daemon
// Sia
function siaApiPassword() {
    // Gets the Sia API Password from disk
    let configPath
    switch (process.platform) {
        case 'win32':
            configPath = Path.join(process.env.LOCALAPPDATA, 'Sia')
            break
        case 'darwin':
            configPath = Path.join(
                os.homedir(),
                'Library',
                'Application Support',
                'Sia'
            )
            break
        default:
            configPath = Path.join(os.homedir(), '.sia')
    }
    const pass = fs.readFileSync(Path.join(configPath, 'apipassword')).toString().trim()
    return pass || ''
}

// In this current version of the router, password authentication for the Sia API is not required as we have disabled it (Sia is only accessed locally),
// But the abive function can be enabled if the API password is enabled
//var apiPassword = siaApiPassword()
var apiPassword = ""
const siaBasicAuth = `:${apiPassword}@${'localhost:9980'}`



// Routes for the API
// =============================

var router = express.Router(); // get an instance of the express Router

router.use(bodyParser.urlencoded({extended: false}))
router.use(bodyParser.json())
router.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
router.use(bodyParser.json({limit: '50mb', extended: true}));


// This prevents CORS issues:
router.use((req,res,next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );

    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET', 'POST')
        return res.status(200).json({})
    }

    next();
})

// Test route to make sure everything is working 
router.get('/test', function(req, res) {
    res.json({ message: "Test successful!!"});   
});


// Route for accessing daemons
router.route('/daemon')
.post(function(req, res) {
    var wrapper = req.body.wrapper
    var ip = req.body.ip
    var call = req.body.call
    var clientAuthkey = req.body.authkey

    if (clientAuthkey != routerAuthKey) {
        // Incorrect authentication
        res.status(500).send('Wrong authentication key')
        console.log("Unauthenticated request")
    
    } else {
        if (wrapper == "sia") {
            sia.connect(ip)
            .then((siad) => { 
                siad.call(call).then((api) =>  {
                    res.json(api);
                    //console.log(wrapper + " - " + call + " - success")
                }).catch((err) => { // Errors of connection to daemon
                    console.log("**** Error retrieving call " + call + "from " + ip)
                    res.status(500).send('Something broke!')
                }) 
            }).catch((err) => { // Errors of connection to daemon
                console.log("**** Error connecting to " + ip)
                res.status(500).send('Something broke!')
            })
        } else {
            console.log("Wrapper not recognized")
            res.status(500).send("Wrapper not recognized")
        }
    }
});

// Route for POST calls. It is a different route as they require further parameters
router.route('/daemon_post')
.post(function(req, res) {

    var wrapper = req.body.wrapper
    var ip = req.body.ip
    var call = req.body.call
    var clientAuthkey = req.body.authkey
    var options = req.body.options
    var qs = req.body.qs
    

    if (clientAuthkey != routerAuthKey) {
        // Incorrect authentication
        res.status(500).send('Wrong authentication key')
        console.log("Unauthenticated request")
    
    } else {
        if (wrapper == "sia") {
            sia.call(siaBasicAuth, {
                url: call,
                method: "POST",
                body: options,
                qs: qs
            })
            .then((API) => {
                res.json(API);
                console.log(wrapper + " - POST " + call + " - success")
            })
            .catch((err) => { // Errors of connection to daemon
                console.log("**** Error with POST call connecting to " + ip)
                res.status(500).send('Something broke!')
                //console.log(err)
            })
        
        } else {
            console.log("Wrapper not recognized")
            res.status(500).send("Wrapper not recognized")
        }
    }

});


// All the routes will be prefixed with /navigator-api
app.use('/', router);
var httpServer = http.createServer(app);
port = 3500
httpServer.listen(port);

console.log("----------------------------------------------")
console.log('+ Remote daemon connector listening on: ' + port + " +") 
console.log("----------------------------------------------")
console.log("AUTHENTICATION KEY: " + routerAuthKey)
