'use strict';

var Promise = global.Promise || require('promise');
const env = require('env-var');

var express = require('express'),
    exphbs  = require('./lib/express-handlebars'), // "express-handlebars"
    helpers = require('./lib/helpers');

var app = express();

// Create `ExpressHandlebars` instance with a default layout.
var hbs = exphbs.create({
    defaultLayout: 'main',
    helpers      : helpers,

    // Uses multiple partials dirs, templates in "shared/templates/" are shared
    // with the client-side of the app (see below).
    partialsDir: [
        'shared/templates/',
        'views/partials/'
    ]
});

// Register `hbs` as our view engine using its bound `engine()` function.
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

// Middleware to expose the app's shared templates to the cliet-side of the app
// for pages which need them.
function exposeTemplates(req, res, next) {
    // Uses the `ExpressHandlebars` instance to get the get the **precompiled**
    // templates which will be shared with the client-side of the app.
    hbs.getTemplates('shared/templates/', {
        cache      : app.enabled('view cache'),
        precompiled: true
    }).then(function (templates) {
        // RegExp to remove the ".handlebars" extension from the template names.
        var extRegex = new RegExp(hbs.extname + '$');

        // Creates an array of templates which are exposed via
        // `res.locals.templates`.
        templates = Object.keys(templates).map(function (name) {
            return {
                name    : name.replace(extRegex, ''),
                template: templates[name]
            };
        });

        // Exposes the templates during view rendering.
        if (templates.length) {
            res.locals.templates = templates;
        }

        setImmediate(next);
    })
    .catch(next);
}

//mysql vars
const mysqlcreds = {
    "connectionLimit": env.get('DB_CONNECTION_LIMIT').required().asIntPositive(),
    "host": env.get('DB_HOST').required().asString(),
    "user": env.get('DB_USER').required().asString(),
    "password": env.get('DB_PASSW').required().asString(),
    "database": env.get('DB_DATABASE').required().asString()
};
var fs = require('fs');
var mysql = require('mysql');
var pool = mysql.createPool(mysqlcreds);

//nodemailer vars
const nodemailer = require('nodemailer');
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// create reusable transporter object using the default SMTP transport
const emailcreds = {
    "user": env.get('EMAIL_USER').required().asString(),
    "pass": env.get('EMAIL_PASSW').required().asString(),
    "secretkey": env.get('EMAIL_SECRET_KEY').required().asString(),
};
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: emailcreds
});

//recaptcha vars
var request = require('request');
var secretkey = emailcreds.secretkey;

//gzip compression
var compression = require('compression');
app.use(compression());

//favicon vars
var favicon = require('serve-favicon');
app.use(favicon('./public/img/favicon.ico'));

//queries db with query string q, and returns rows or error
var queryDB = function(q){
    return new Promise( function(resolve, reject){
        if(pool)
        {
            pool.getConnection(function(err, connection) {
                if (err) {
                    console.log(err);
                }   
                // Use the connection
                connection.query(q, function (error, rows, fields) {
                    // And done with the connection.
                    connection.release();
            
                    // Handle error after the release.
                    if (error){
                        throw error;
                    }
                    else{
                        resolve(rows);
                    }
                });
            });
        }
        else{
            console.log('Error connecting to the database. Pool not defined.');
        }
    })
}

//slices last character if it's an '/'. Used in generating breadcrumb list
var removeSlash = function(text){
    if(text.charAt(text.length - 1) == '/') {
        text = text.substr(0, text.length - 1);
    }
    return text;
}

var url = (env.get('NODE_ENV').required().asString() == 'production' ? 'https://' : 'http://') + env.get('URL').required().asString();
var sitename = 'Canopy Tent Reviews';

//404 render method
var send404 = function(res){
    res.status(404);
    res.render('404', {
        title: sitename + " | Uh Oh... We can't seem to find what your looking for!",
        description: "Sorry, we can't seem to find the page that you are looking for so we redirected you to our 404 page.",
        img: url + '/img/404.jpg' 
    });
}

//query string for getting blog posts
var getBlogPostQueryString = function(index_in, resultsperpage_in){
    return "(SELECT * FROM BLOGPOSTS WHERE (`RANK` < " + index_in + ") ORDER BY `RANK` DESC LIMIT " + resultsperpage_in + ") "
    + "UNION ALL "
    + "(SELECT * FROM BLOGPOSTS WHERE (`RANK` >= " + index_in + ") ORDER BY `RANK` DESC LIMIT " + resultsperpage_in + ") "
    + "LIMIT " + resultsperpage_in;
}

//function to trim string and add elipse
var trimAndAddElipssis = function(rows_in, length_in){
    for (var key in rows_in) {
        var string = rows_in[key].TITLE;
        rows_in[key].TITLE = string.length > length_in ? string.substring(0, length_in - 3) + "..." : string.substring(0, length_in);
    }
}

//middleware to redirect www to non-www
function wwwRedirect(req, res, next) {
    if (req.headers.host && req.headers.host.slice(0, 4) === 'www.') {
        var newHost = req.headers.host.slice(4);
        return res.redirect(301, req.protocol + '://' + newHost + req.originalUrl);
    }
    next();
};
app.use(wwwRedirect);

//middleware to redirect trailing slash
app.use(function(req, res, next) {
    if (req.path.substr(-1) == '/' && req.path.length > 1) {
        var query = req.url.slice(req.path.length);
        res.redirect(301, req.path.slice(0, -1) + query);
    } else {
        next();
    }
});

var getBreadCrumbList = function(arr){
    var text = '[{"@context": "https://schema.org","@type": "BreadcrumbList","itemListElement": [';
    for(var i = 0; i < arr.length; i++)
    {
        text += '{"@type": "ListItem","position": ' + (i + 1) + ',"name": "' + arr[i].name + '","item": "' + url + removeSlash(arr[i].path) + '"}';
        if((i+1) < arr.length)
        {
            text +=',';
        }
    }
    text += ']}]';

    return text;
}


var getProductType = function(pt_path, res){
    var sencondHalf = (pt_path ? "= '" + pt_path + "'" : "IS NULL");
    var q_productTypes = "SELECT * FROM PRODUCTTYPES WHERE URL " + sencondHalf;
    var revs;

    queryDB(q_productTypes)
    .then(function(rows){
        if(rows.length == 1)
        {
            var pt = rows[0];
            if(pt != null)
            {
                var q_reviews = "SELECT * FROM COMPARISON WHERE PRODUCTTYPE = '" + pt.ID + "' ORDER BY RANK ASC";
                queryDB(q_reviews)
                .then(function(rows){
                    
                    //get last 4 blog posts for side widget
                    var resultsperpage = 5;
                    var q_blogposts = getBlogPostQueryString( 1, resultsperpage);

                    queryDB(q_blogposts)
                    .then(function(blogrows){
                        
                        //handle trimming and ellipsis
                        trimAndAddElipssis(blogrows, 28);

                        //generate breadcrumb list
                        var arr = [{"name": pt.TITLE, "path": ("/" + pt_path)}];
                        var bc = getBreadCrumbList(arr)
                        
                        //render page
                        revs = rows;
                        res.render('reviews', {
                            title: pt.METATITLE,
                            secondarytitle: pt.METATITLESECONDARY,
                            description: pt.METADESC,
                            secondarydesc: pt.METADESCSECONDARY,
                            img: url + pt.PICTURE,
                            reviews: revs,
                            producttype: pt,
                            blogposts: blogrows,
                            breadcrumblist : bc
                        });
                    })
                    .catch(function(error){
                        console.log(error);
                        send404(res);
                    })


                    

                })
                .catch(function(error){
                    console.log(error);
                    send404(res);
                })              
            }
            else{
                send404(res);
            }
        }
        else{
            send404(res);
        }
    })
    .catch(function(error){
        console.log(error);
        send404(res);
    })
}

//get home page
app.get('/', function (req, res) {

    var revs;
    var q_reviews = 
        `SELECT COMPARISON.*, PRODUCTTYPES.TITLE, PRODUCTTYPES.URL
        FROM COMPARISON
        INNER JOIN PRODUCTTYPES
        ON COMPARISON.PRODUCTTYPE=PRODUCTTYPES.ID
        WHERE COMPARISON.HOMEPAGEKEYWORD IS NOT NULL
        ORDER BY COMPARISON.HOMEPAGERANK ASC;`;

    queryDB(q_reviews)
    .then(function(rows){
        
        //get last 4 blog posts for side widget
        var resultsperpage = 5;
        var q_blogposts = getBlogPostQueryString( 1, resultsperpage);

        queryDB(q_blogposts)
        .then(function(blogrows){
            
            //handle trimming and ellipsis
            trimAndAddElipssis(blogrows, 28);
            
            //render page
            revs = rows;
            res.render('home', {
                reviews: revs,
                blogposts: blogrows,
                url: url,
                sitename: sitename
            });
        })
        .catch(function(error){
            console.log(error);
            send404(res);
        })
    })
    .catch(function(error){
        console.log(error);
        send404(res);
    })              
});

//get product pages
app.get(['/best-10x10-canopy',
         '/best-beach-tents',
         '/best-baby-beach-tents',
         '/best-pop-up-gazebo',
         '/best-waterproof-tent-for-rain',
         '/best-beach-canopy',
         '/best-10x20-pop-up-canopy',
         '/best-12x12-canopy-tent',
         '/best-20x20-tent'], function (req, res) {
    var path = req.path;
    if(path.length >= 1){
        path = path.substr(1);
    }
    else{
        path = '';
    }
    getProductType(path, res);
});

//get brands page
app.get('/contact', function (req, res) {
    var status = req.query.status || 'new';

    //generate breadcrumb list
    var arr = [{"name": "Contact Us", "path": req.path}];
    var bc = getBreadCrumbList(arr)

    res.render('contact', {
        title: sitename + ' | Contact Us',
        description: 'Contact us with any questions so we can help you pick out the best canopy tent for your needs.',
        img: url + '/img/best-pop-up-canopy.jpg',
        status: status,
        breadcrumblist: bc
    });  
});

//get disclaimer page
app.get('/disclaimer', function (req, res) {

    //generate breadcrumb list
    var arr = [{"name": "Disclaimer", "path": req.path}];
    var bc = getBreadCrumbList(arr)

    res.render('disclaimer', {
        title: sitename + ' | Disclaimer and Disclosure',
        description: 'Please read our disclaimer information. If you have any questions or concerns, feel free to reach out to us!',
        breadcrumblist: bc
    });  
});

//send email
app.post("/submit-message", function (req, res) {
    var status = 'success';

    var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" 
                        + secretkey 
                        + "&response=" 
                        + req.body['g-recaptcha-response'] + "&remoteip=" 
                        + req.connection.remoteAddress;

    request(verificationUrl,function(error,response,body) {
        body = JSON.parse(body);
        if(body.success !== undefined && !body.success) {
            console.log('Failed to verify captcha.');
            status = 'failure';
        }
        //captcha validated successfully

        //route vars
        var first_name = req.body.first_name || '',
            last_name = req.body.last_name || '',
            email = req.body.email || '',
            city = req.body.city || '',
            state = req.body.state || '',
            subject = req.body.subject || '',
            message = req.body.message || '';

        // setup email data with unicode symbols
        let mailOptions = {
            from: email, // sender address
            to: emailcreds.user, // list of receivers
            subject: first_name + " " + last_name + " - " + subject, // Subject line
            text: first_name + "\n" + last_name + "\n" + city + "\n" + state + "\n" + email + "\n" + message // plain text body
        };

        // send mail with defined transport object
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                status = 'failure';
            }
            res.redirect('/contact?status=' + status);
        });
    });
});

//get brands page
app.get('/brands', function (req, res) {
    var id = req.params.id;
    var q = "SELECT * FROM BRANDS";
    queryDB(q).
    then(function(rows){
        if(rows.length > 0)
        {
            //generate breadcrumb list
            var arr = [{"name": "Brands", "path": req.path}];
            var bc = getBreadCrumbList(arr)

            res.render('brands', {
                title: sitename + ' | Best Canopy Tent Brands',
                description: "From safety to affordability, we compare the best canopy tent brands on the market so that you can find the right model for your needs.",
                brands: rows,
                breadcrumblist: bc
            });
        }
        else{
            send404(res);
        }
    })
    .catch(function(error){
        console.log(error);
        send404(res);
    })
});

//get buying guide page - page is hard-coded
app.get('/canopy-tent-buying-guide', function (req, res) {
    
    //generate breadcrumb list
    var arr = [{"name": "Buying Guide", "path": req.path}];
    var bc = getBreadCrumbList(arr)

    res.render('buying-guide', {
        title: sitename + ' | Best Canopy Tent Buying Guide',
        description: 'This complete canopy tent buying guide will help you pick out the right frame and canopy so that you can find the best canopy tent for your situation.',
        breadcrumblist: bc
    });
});

//get page with list of blog posts
app.get('/blog', function(req, res){
    var page = parseInt(req.query.page) || 1;
    var q = "SELECT * FROM BLOGPOSTS ORDER BY 'RANK' DESC";

    queryDB(q)
    .then(function(rows){
        if(rows.length > 0)
        {
            rows.sort(function (a, b) {return b.RANK - a.RANK;});
            var resultsperpage = 10;
            var neededpages = Math.ceil(rows.length / resultsperpage);
            var pages_array = [...Array(neededpages).keys()].map(function(item) { 
                return item + 1; 
            });;

            //protect against a higher page than number of posts
            if(page > neededpages)
            {
                page = 1;
            }

            //put together the right set of posts to return
            var start = (page - 1) * resultsperpage;
            rows = rows.slice(start, (start + resultsperpage));
            
            //generate breadcrumb list
            var arr = [{"name": "Blog", "path": req.path}];
            var bc = getBreadCrumbList(arr);

            //get sidenav categories
            const categories_set = new Set();
            queryDB(q).
            then(function(rows2){

                if(rows2.length > 0)
                {
                    // get all the unique categories and create a set out of them
                    rows2.forEach(function(item, index) {
                        let cats = item.CATEGORY.split(",");
                        cats.forEach(function(cat,index2){
                            categories_set.add(cat);
                        });
                    });
                }
                //render
                res.render('blog', {
                    title: sitename + ' | Blog',
                    description: 'Check out ' + sitename + ', news, stories, testimonies, and a lot more on our blog.',
                    img: url + '/img/Blog_Background.jpg',
                    blogposts: rows,
                    pages: pages_array,
                    path: "/blog",
                    url: url + "/blog",
                    next_page: ((page < neededpages) ? (page + 1) : neededpages),
                    previous_page: ((page > 1) ? (page - 1) : 1),
                    selected_page: page,
                    breadcrumblist: bc,
                    categories: Array.from(categories_set),
                    category: ''
                });
            })
            .catch(function(error){
                console.log(error);
            })
            
        }
        else{
            send404(res);
        }
    })
    .catch(function(error){
        console.log(error);
        send404(res);
    })
});

//get blog article
app.get('/blog/:id', function (req, res) {
    var id = req.params.id || '';
    if(id == ''){
        send404(res);
    }
    else{
        var q2 = "SELECT * FROM BLOGPOSTS WHERE POSTID = '" + id + "' LIMIT 1";
    
        queryDB(q2)
        .then(function(rows){
            if(rows.length == 1)
            {
                var blogpost_in = rows[0];
    
                //get last 4 blog posts for side widget
                var resultsperpage = 4;
                q2 = getBlogPostQueryString( blogpost_in.RANK, resultsperpage);
    
                queryDB(q2)
                .then(function(blogrows){
                    
                    //handle trimming and ellipsis
                    trimAndAddElipssis(blogrows, 28);

                    //generate breadcrumb list
                    var arr = [{"name": "Blog", "path": "/blog"}, {"name": blogpost_in.TITLE, "path": req.path}];
                    var bc = getBreadCrumbList(arr)
                    var categories = blogpost_in.CATEGORY.split(',')
                    res.render('blogpost', {
                        title: blogpost_in.TITLE,
                        description: blogpost_in.SUBTITLE,
                        img: url + blogpost_in.BACKGROUNDIMGURL,
                        latestblogs: blogrows,
                        blogpost: blogpost_in,
                        breadcrumblist: bc,
                        categories: categories
                    });
                })
                .catch(function(error){
                    console.log(error);
                    send404(res);
                })
            }
            else{
                send404(res);
            }
        })
        .catch(function(error){
            console.log(error);
            send404(res);
        })        
    }
});

//get category
app.get('/category/:category', function (req, res) {
    var page = parseInt(req.query.page) || 1;
    var category = req.params.category || '';
    if(category == ''){
        send404(res);
    }
    else{
        var q2 = "SELECT * FROM BLOGPOSTS WHERE CATEGORY LIKE '%" + category + "%'";
    
        queryDB(q2)
        .then(function(rows){
            if(rows.length > 0)
            {
                rows.sort(function (a, b) {return b.RANK - a.RANK;});
                var resultsperpage = 10;
                var neededpages = Math.ceil(rows.length / resultsperpage);
                var pages_array = [...Array(neededpages).keys()].map(function(item) { 
                    return item + 1; 
                });;
    
                //protect against a higher page than number of posts
                if(page > neededpages)
                {
                    page = 1;
                }
    
                //put together the right set of posts to return
                var start = (page - 1) * resultsperpage;
                rows = rows.slice(start, (start + resultsperpage));
                
                //generate breadcrumb list
                var arr = [{"name": "categories", "path": "/category"}, {"name": category, "path": req.path}];
                var bc = getBreadCrumbList(arr)
                var q = "SELECT CATEGORY FROM BLOGPOSTS";
                
                //get sidenav categories
                const categories_set = new Set();
                queryDB(q).
                then(function(rows2){

                    if(rows2.length > 0)
                    {
                        // get all the unique categories and create a set out of them
                        rows2.forEach(function(item, index) {
                            let cats = item.CATEGORY.split(",");
                            cats.forEach(function(cat,index2){
                                categories_set.add(cat);
                            });
                        });
                    }

                    //render
                    res.render('blog', {
                        title: sitename + ' | Category / ' + category,
                        description: 'Check out ' + category + ' related reviews, news, stories, testimonies',
                        img: url + '/img/Blog_Background.jpg',
                        blogposts: rows,
                        pages: pages_array,
                        path: "/category/" + category,
                        url: url + "/category/",
                        next_page: ((page < neededpages) ? (page + 1) : neededpages),
                        previous_page: ((page > 1) ? (page - 1) : 1),
                        selected_page: page,
                        breadcrumblist: bc,
                        categories: Array.from(categories_set),
                        category: category
                    })
                })
                .catch(function(error){
                    console.log(error);
                })
            }
            else{
                send404(res);
            }
        })
        .catch(function(error){
            console.log(error);
            send404(res);
        })      
    }
});

//public directory
app.use(express.static('public/'));

//catch-all 404 route
app.use(function(req, res, next) {
    send404(res);
});

var port = process.env.PORT || 8081;
app.listen(port, function () {
    console.log(sitename + ' listening on: ' + port);
});
