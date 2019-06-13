var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')
var multer = require('multer')
var csvtojson = require('csvtojson');
var fs = require('fs')
var DateDiff = require('date-diff');
const geolib = require('geolib');
var tzlookup = require("tz-lookup");
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

let mydb, cloudant;
var vendor; // Because the MongoDB and Cloudant use different API commands, we
// have to check which command should be used based on the database
// vendor.
var dbName = 'mydb';

// Separate functions are provided for inserting/retrieving content from
// MongoDB and Cloudant databases. These functions must be prefixed by a
// value that may be assigned to the 'vendor' variable, such as 'mongodb' or
// 'cloudant' (i.e., 'cloudantInsertOne' and 'mongodbInsertOne')

var insertOne = {};
var getAll = {};

insertOne.cloudant = function(doc, response) {
    mydb.insert(doc, function(err, body, header) {
        if (err) {
            console.log('[mydb.insert] ', err.message);
            response.send("Error");
            return;
        }
        doc._id = body.id;
        response.send(doc);
    });
}

getAll.cloudant = function(response) {
    var names = [];
    mydb.list({ include_docs: true }, function(err, body) {
        if (!err) {
            body.rows.forEach(function(row) {
                if (row.doc.name)
                    names.push(row.doc.name);
            });
            response.json(names);
        }
    });
    //return names;
}

let collectionName = 'mycollection'; // MongoDB requires a collection name.

insertOne.mongodb = function(doc, response) {
    mydb.collection(collectionName).insertOne(doc, function(err, body, header) {
        if (err) {
            console.log('[mydb.insertOne] ', err.message);
            response.send("Error");
            return;
        }
        doc._id = body.id;
        response.send(doc);
    });
}

getAll.mongodb = function(response) {
    var names = [];
    mydb.collection(collectionName).find({}, { fields: { _id: 0, count: 0 } }).toArray(function(err, result) {
        if (!err) {
            result.forEach(function(row) {
                names.push(row.name);
            });
            response.json(names);
        }
    });
}

/* Endpoint to greet and add a new visitor to database.
 * Send a POST request to localhost:3000/api/visitors with body
 * {
 *   "name": "Bob"
 * }
 */
app.post("/api/visitors", function(request, response) {
    var userName = request.body.name;
    var doc = { "name": userName };
    if (!mydb) {
        console.log("No database.");
        response.send(doc);
        return;
    }
    insertOne[vendor](doc, response);
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function(request, response) {
    var names = [];
    if (!mydb) {
        response.json(names);
        return;
    }
    getAll[vendor](response);
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
    vcapLocal = require('./vcap-local.json');
    console.log("Loaded local VCAP", vcapLocal);
} catch (e) {}

const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services['compose-for-mongodb'] || appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/)) {
    // Load the MongoDB library.
    var MongoClient = require('mongodb').MongoClient;

    dbName = 'mydb';

    // Initialize database with credentials
    if (appEnv.services['compose-for-mongodb']) {
        MongoClient.connect(appEnv.services['compose-for-mongodb'][0].credentials.uri, null, function(err, db) {
            if (err) {
                console.log(err);
            } else {
                mydb = db.db(dbName);
                console.log("Created database: " + dbName);
            }
        });
    } else {
        // user-provided service with 'mongodb' in its name
        MongoClient.connect(appEnv.getService(/.*[Mm][Oo][Nn][Gg][Oo].*/).credentials.uri, null,
            function(err, db) {
                if (err) {
                    console.log(err);
                } else {
                    mydb = db.db(dbName);
                    console.log("Created database: " + dbName);
                }
            }
        );
    }

    vendor = 'mongodb';
} else if (appEnv.services['cloudantNoSQLDB'] || appEnv.getService(/[Cc][Ll][Oo][Uu][Dd][Aa][Nn][Tt]/)) {
    // Load the Cloudant library.
    var Cloudant = require('@cloudant/cloudant');

    // Initialize database with credentials
    if (appEnv.services['cloudantNoSQLDB']) {
        // CF service named 'cloudantNoSQLDB'
        cloudant = Cloudant(appEnv.services['cloudantNoSQLDB'][0].credentials);
    } else {
        // user-provided service with 'cloudant' in its name
        cloudant = Cloudant(appEnv.getService(/cloudant/).credentials);
    }
} else if (process.env.CLOUDANT_URL) {
    cloudant = Cloudant(process.env.CLOUDANT_URL);
}
if (cloudant) {
    //database name
    dbName = 'mydb';

    // Create a new "mydb" database.
    cloudant.db.create(dbName, function(err, data) {
        if (!err) //err if database doesn't already exists
            console.log("Created database: " + dbName);
    });

    // Specify the database we are going to use (mydb)...
    mydb = cloudant.db.use(dbName);

    vendor = 'cloudant';
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));
app.use('/images', express.static(__dirname + '/uploads/img'));
var storage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (fs.existsSync("uploads/" + file.originalname)) {
            cb(new Error('File already exists'), false)
        }
        cb(null, 'uploads/')
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
})
var imgstorage = multer.diskStorage({
    destination: function(req, file, cb) {
        if (fs.existsSync("uploads/img/" + file.originalname)) {
            cb(new Error('File already exists'), false)
        }
        cb(null, 'uploads/img')
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
})
var upload = multer({ storage: storage })
var imgupload = multer({ storage: imgstorage })
    // app.use('/csv', function(req, res, next) {
    //     try {
    //         if (fs.existsSync("uploads/" + req.file.originalname)) {
    //             console.log("fileexists");

//         } else {
//             next();
//         }
//     } catch (err) {
//         console.error(err)
//     }
// })
app.post('/csv', upload.single("csvfile"), function(req, res) {
    var alldata;
    req.file.filename = req.file.originalname;
    csvtojson().fromFile(req.file.path).then(source => {
        console.log(source);
        source.forEach(function(s) {
            s.mag = parseFloat(s.mag);
            s.depth = parseFloat(s.depth);
            if (s.mag < 0) {
                s.mag = 0;
            }


        })
        alldata = { docs: source }
        mydb.bulk(alldata, function(err, body, header) {
            if (err) {
                console.log('[mydb.insert] ', err.message);
                // res.send("Error");
                return;
            }
            source._id = body.id;
            // res.send("csvsuccess")

        });

        res.send(source);
    })

})
app.post('/mag', function(req, res) {
    var mag = parseFloat(req.body.mag);
    var mag1 = parseFloat(req.body.mag1);
    console.log(mag);
    mydb.find({
        selector: {
            "$and": [{
                    "mag": {
                        "$gt": mag
                    }
                },
                {
                    "mag": {
                        "$lt": mag1
                    }
                },
            ]
        },
    }, function(err, result) {
        console.log(result.docs);
        res.send(result.docs)
    })
})
app.post('/selectmag', function(req, res) {
    var minmag = parseFloat(req.body.minmag);
    var maxmag = parseFloat(req.body.maxmag);
    var startdate = req.body.startdate;
    var enddate = req.body.enddate;
    // console.log(mag);
    console.log(minmag + " " + maxmag);
    mydb.find({
        selector: {
            "$and": [{
                    "mag": {
                        "$gt": minmag
                    }
                },
                {
                    "mag": {
                        "$lt": maxmag
                    }
                },
            ]
        },
        "fields": [
            "place",
            "latitude",
            "longitude",
            "mag",
            "time"
        ],
    }, function(err, result) {
        var docs = []
        if (!result.docs.length == 0) {
            result.docs.forEach(function(r) {
                if (new DateDiff(new Date(startdate), new Date(r.time)).days() < 0 && new DateDiff(new Date(enddate), new Date(r.time)).days() > 0) {
                    docs.push(r)
                }
            })
        }
        // var diff = new DateDiff(new Date(), new Date(result.docs[10].time))
        console.log(docs);

        res.send(docs)
    })
})
app.post('/latlong', function(req, res) {
    var lat = parseFloat(req.body.lat);
    var long = parseFloat(req.body.long);
    var radius = parseFloat(req.body.radius) * 1000;
    var coords = { latitude: lat, longitude: long }
    console.log(lat);
    mydb.find({
        selector: {}
    }, function(err, result) {
        var points = []
        result.docs.forEach(function(d) {
            if (geolib.isPointWithinRadius(coords, { latitude: d.latitude, longitude: d.longitude }, radius)) {
                points.push(d)
            }
        })
        console.log(points);
        res.send(points)
    })
})
app.post('/', function(req, res) {

    mydb.find({
        selector: {},
    }, function(err, result) {
        var max = [];
        console.log(result.docs);
        // res.send({ length: result.docs.length })
        result.docs.forEach(function(d) {
            max.push(d.mag)
        });
        var magmax = Math.max(...max);
        var region = result.docs[max.indexOf(magmax)];
        res.send({ count: result.docs.length, quake: region })
    })
})
app.post('/bounds', function(req, res) {
    var firstlat = parseFloat(req.body.firstlat);
    var firstlong = parseFloat(req.body.firstlong);
    var secondlat = parseFloat(req.body.secondlat);
    var secondlong = parseFloat(req.body.secondlong);
    var grid = parseFloat(req.body.grid);
    // var coords = { latitude: lat, longitude: long }
    // console.log(lat);
    mydb.find({
        selector: {}
    }, function(err, result) {
        var points = []
        var coords = []
        var count = 0
            // result.docs.forEach(function(d) {
            //     if (geolib.isPointInPolygon({ latitude: d.latitude, longitude: d.longitude }, [
            //             { latitude: 65.87878, longitude: -150.57159459459456 },
            //             { latitude: 65.87878, longitude: -148.76979279279274 },
            //             { latitude: 67.68058180180181, longitude: -150.57159459459456 },
            //             { latitude: 67.68058180180181, longitude: -148.76979279279274 },
            //         ])) {
            //         count += 1;
            //     };
            // })
            // console.log(count);
        var point1 = { latitude: firstlat, longitude: firstlong };
        var point2 = { latitude: firstlat, longitude: secondlong };
        var point3 = { latitude: secondlat, longitude: firstlong };
        var point4 = { latitude: secondlat, longitude: secondlong };
        result.docs.forEach(function(d) {
            if (geolib.isPointInPolygon({ latitude: d.latitude, longitude: d.longitude }, [
                    point1,
                    point2,
                    point3,
                    point4
                ])) {
                points.push(d)
            };
        })
        res.send(points)

        // for (let fc = firstlat; fc + grid / 111 < secondlat; fc = fc + grid / 111) {
        //     for (let sc = firstlong; sc + grid / 111 < secondlong; sc = sc + grid / 111) {
        //         var count = 0;
        //         var point1 = { latitude: fc, longitude: sc };
        //         var point2 = { latitude: fc, longitude: sc + grid / 111 };
        //         var point3 = { latitude: fc + grid / 111, longitude: sc };
        //         var point4 = { latitude: fc + grid / 111, longitude: sc + grid / 111 };
        //         console.log(point1);
        //         console.log(point2);
        //         console.log(point3);
        //         console.log(point4);
        //         result.docs.forEach(function(d) {
        //             if (geolib.isPointInPolygon({ latitude: d.latitude, longitude: d.longitude }, [
        //                     point1,
        //                     point2,
        //                     point3,
        //                     point4
        //                 ])) {
        //                 count += 1;
        //             };
        //         })
        //         coords.push({ point1: point1, point2: point2, point3: point3, point4: point4 })
        //         points.push(count)

        //     }

        // }

        // console.log(points);
        // console.log(coords);
        // console.log(Math.max(...points));
        // console.log(points.indexOf(Math.max(...points)));
        // var max = Math.max(...points);
        // var region = coords[points.indexOf(max)];
        // res.send({
        //     max: max,
        //     region: region
        // })
    })
})
app.post('/etime', function(req, res) {
    console.log(tzlookup(28.610001, 77.230003));
    var aestTime = new Date().toLocaleString("en-US", { timeZone: tzlookup(28.610001, 77.230003) });
    aestTime = new Date(aestTime);
    console.log('AEST time: ' + aestTime.toLocaleString())
        // mydb.find({
        //     selector: {}
        // }, function(err, result) {
        //     var points = []
        //     result.docs.forEach(function(d) {

    //     })
    //     console.log(points);
    //     res.send(points)
    // })
    mydb.find({
        selector: {}
    }, function(err, result) {
        var points = []
        var i = 0
        var daycount = 0;
        var nightcount = 0;
        result.docs.forEach(function(d) {
                console.log(tzlookup(d.latitude, d.longitude));
                i += 1
                console.log(i)
                    // var aestTime = new Date().toLocaleString("en-US", { timeZone: tzlookup(d.latitude, d.longitude) });
                var localtime = new Date(d.time);
                localtime.setMinutes(localtime.getMinutes() + d.longitude * 4)
                var hours = localtime.getHours();
                if ((hours >= 22 && hours <= 24) || (hours >= 0 && hours <= 2)) {
                    nightcount += 1;
                } else {
                    daycount += 1;
                }
                // if ((localtime >= 20 && localtime <= 24) || (localtime >= 0 && localtime <= 6)) {
                //     nightcount += 1;
                // } else {
                //     daycount += 1
                // }

            })
            // console.log(points);
        res.send({ daycount: daycount, nightcount: nightcount })
    })
})
var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});