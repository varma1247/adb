app.post('/files', function(req, res) {
    const path = './uploads/img';
    fs.readdir(path, function(err, items) {
        var size = [];
        items.forEach(function(item) {
            const stats = fs.statSync("./uploads/img/" + item);
            const fileSizeInBytes = stats.size;
            //Convert the file size to megabytes (optional)
            const fileSizeInMegabytes = fileSizeInBytes / 1000000.0;
            size.push(fileSizeInMegabytes);
        })
        console.log(items);
        res.send({ items: items, size: size });
        for (var i = 0; i < items.length; i++) {
            console.log(items[i]);
        }
    });
})
app.post('/image', imgupload.single("imgfile"), function(req, res) {

})
app.post('/room', function(req, res) {
    var room = parseInt(req.body.room);
    mydb.find({ selector: { Room: room } }, function(err, result) {
        console.log(result.docs.length);
        // res.sendFile("uploads/img/" + result.docs[0].Picture, { root: __dirname })
        if (result.docs.length == 0) {
            var geoTz = require('geo-tz')

            geoTz.preCache() // optionally load all features into memory
            console.log(geoTz(36.82554626, -97.50458527)) // ['America/Los_Angeles']
                // geoTz(43.839319, 87.526148) // ['Asia/Shanghai', 'Asia/Urumqi']
            var options = {
                timeZone: geoTz(34.0406667, -117.5121667)[0],
                year: 'numeric',
                month: 'numeric',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric'
            };

            var formatter = new Intl.DateTimeFormat([], options);

            var UTCTime = "2019-12-20T16:19:42.920Z";
            // console.log(new Date(UTCTime).toISOString));

            var localTime = formatter.format(new Date(UTCTime));
            console.log(new Date(localTime).getDate());

            // var lasttime = new Date(localTime).toISOString();
            var currentTime = formatter.format(new Date());
            console.log(currentTime, localTime);
            // console.log(lasttime);
            // var tzwhere = require('tzwhere')
            // tzwhere.init();

            // var whiteHouse = { 'lat': 36.82554626, 'lng': -97.50458527 };

            // // Determine the timezone of the White House
            // console.log(tzwhere.tzNameAt(whiteHouse['lat'], whiteHouse['lng']));

            // // Determine the current offset from UTC, in milliseconds, of the White House's timezone
            // console.log(tzwhere.tzOffsetAt(whiteHouse['lat'], whiteHouse['lng']));
            res.send('norecords')
        } else {
            res.send(result.docs[0]);
        }
    })
})
app.post('/salary', function(req, res) {
    var salary = parseInt(req.body.salary);
    console.log(salary);

    mydb.find({ selector: { Salary: { "$lt": salary } } }, function(err, result) {
        // console.log(result.docs);
        // // res.sendFile("uploads/img/" + result.docs[0].Picture, { root: __dirname })
        // // res.send(result.docs[0].Picture);
        var images = [];
        result.docs.forEach(function(d) {
            if (!d.Picture == '') {
                images.push(d.Picture)
            }
        });
        res.send(images)

    })
})
app.post('/jeesk', function(req, res) {
    var jeesk = req.body.jeesk;
    console.log(jeesk);
    var keywords = {
        keywords: jeesk
    }
    mydb.find({ selector: { Name: "Abhishek" } }, function(err, result) {
        if (err) return console.log(err.message);
        console.log('Find completed: ' + JSON.stringify(result));
        result.docs[0].Name = jeesk
        mydb.insert(result.docs[0], function(err, data) {
            if (err) return console.log(err.message);
            console.log('Insert completed: ' + data);
        });
    });
})
app.post('/points', function(req, res) {
    var point1 = parseInt(req.body.point1);
    var point2 = parseInt(req.body.point2);
    var room = parseInt(req.body.room);
    mydb.find({
        selector: {
            "$and": [{
                    "Points": {
                        "$gt": point1
                    }
                },
                {
                    "Points": {
                        "$lt": point2
                    }
                },
                {
                    "Room": {
                        "$gt": room
                    }
                }
            ]
        }
    }, function(err, result) {
        // console.log(result.docs);
        // // res.sendFile("uploads/img/" + result.docs[0].Picture, { root: __dirname })
        // // res.send(result.docs[0].Picture);
        // var images = [];
        // result.docs.forEach(function(d) {
        //     if (!d.Picture == '') {
        //         images.push(d.Picture)
        //     }
        // });
        // res.send(images)
        console.log(result);

        res.send(result.docs)
    })
})











$("#allfdiv").on('click', "#allfnames", function() {
    $.ajax({
        url: "/files",
        type: "POST",
        data: {
            allfiles: "allfiles"
        },
        success: function(data) {
            console.log(data.size);

            if (!data.items.length == 0) {
                $("#allfiles").html('');
                data.items.forEach(d => {
                    $("#allfiles").append("<h4 class='text-center'>" + d + "</h4>");
                });
                data.size.forEach(d => {
                    $("#allsizes").append("<h4 class='text-center'>" + d + "</h4>");
                });
            } else {
                $("#allfiles").html('');
                $("body").append("<h4 class='text-center'>No files</h4>");
            }
        }
    })
})







$("#imgdiv").on("change", "#imgfile", function(e) {
    // var fileName = e.target.files[0].name;
    // console.log(fileName);
    var file = e.target.files[0];
    var formData = new FormData();
    formData.append("imgfile", file)
    $.ajax({
        url: '/image',
        contentType: false,
        processData: false,
        data: formData,
        type: 'post',
        success: function(data) {
            if (data) {
                $("#error").html('');
                $("#error").text("File uploaded successfully")

            }
        },
        error: function(data) {
            if (data.status == 500) {
                $("#error").html('');
                $("#error").text("File already exists")

            };

        }

    });
})
$("#isdiv").on('click', '#imgsearch', function() {
    var name = $("#studentname").val();
    $.ajax({
        url: "/imagesearch",
        type: "POST",
        data: {
            name: name
        },
        success: function(msg) {
            console.log(msg);
        }
    });
})
$("#roomdiv").on('click', '#roombutton', function() {
    var room = $("#roomno").val();
    $.ajax({
        url: "/room",
        type: "POST",
        data: {
            room: room
        },
        success: function(msg) {
            // 
            // $('#roomimg').attr('src', "http://localhost:3000/images/" + msg)
            if (msg == 'norecords') {
                $('tbody').html('');
                $("tbody").append("<tr><td></td><td>No Data Available</td><td></td></tr>")

            } else {
                $('tbody').html('');
                $("tbody").append("<tr><td>" + msg.Favorite + "</td><td>" + msg.Name + "</td><td><img style='width:60px; height:60px' src='http://localhost:3000/images/" + msg.Picture + "'></td></tr>")
            }
        },
        error: function(data) {
            $("#error").html('');
            $("#error").text("No matching records")
        }
    });
})
$("#salarydiv").on('click', '#salarybutton', function() {
    var salary = $("#salary").val();
    $.ajax({
        url: "/salary",
        type: "POST",
        data: {
            salary: salary
        },
        success: function(data) {
            $('#images').html('');
            if (data.length == 0) {
                $("#error").html('');
                $("#error").text("No Images")
            } else {
                $("#error").html('');
                data.forEach(function(d) {
                    $('#images').append("<img src='http://localhost:3000/images/" + d + "'>")
                })
            }
        }
    });
})
$("#jeeskdiv").on('click', '#jeeskbutton', function() {
    var jeesk = $("#jeesk").val();
    $.ajax({
        url: "/jeesk",
        type: "POST",
        data: {
            jeesk: jeesk
        },
        success: function(data) {

        }
    });
})
$("#pointsdiv").on('click', '#pointsbutton', function() {
    var point1 = $("#point1").val();
    var point2 = $("#point2").val();
    var room = $("#room").val();
    $.ajax({
        url: "/points",
        type: "POST",
        data: {
            point1: point1,
            point2: point2,
            room: room
        },
        success: function(data) {
            $('tbody').html('');
            data.forEach(function(msg) {

                $("tbody").append("<tr><td>" + msg.State + "</td><td>" + msg.Name + "</td><td><img style='width:60px; height:60px' src='http://localhost:3000/images/" + msg.Picture + "'></td></tr>")
            })

        }
    });
})
$("tr").on('click', 'td', function() {
$("#jeeskdiv").show();


})
});
47.7016667
    -
    114.2146667
19.4175
    -
    155.6125

{ latitude: 71.4234018018018, longitude: -144.80168918918912 } { latitude: 71.4234018018018, longitude: -142.9998873873873 } { latitude: 69.6216, longitude: -144.80168918918912 } { latitude: 69.6216, longitude: -142.9998873873873 }

2019 - 05 - 08 T19: 32: 21.598 Z