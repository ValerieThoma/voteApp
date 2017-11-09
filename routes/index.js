var express = require('express');
var router = express.Router();
var fs = require('fs');
var mysql = require('mysql');
var config = require('../config/config.js');
var bcrypt = require('bcrypt-nodejs');
var multer = require('multer');
var uploadDir = multer({
	dest: 'public/images'
});
var nameOfFileField = uploadDir.single('imageToUpload');
var connection = mysql.createConnection(config.db);
connection.connect((error)=>{
	if(error){
		throw error;
	}
});
// **************************************************************************************
/* GET home page. */
router.get('/', function(req, res, next){
	if(req.session.name === undefined){   //if the user is NOT logged in 
		res.redirect('/login?msg=mustlogin') // send them to the login page
		return;
	}
	const getBands = new Promise((resolve,reject)=>{ // promise requires resolve and reject
		var selectSpecificBands = `
			SELECT * FROM bands WHERE id NOT IN(
				SELECT imageID FROM votes WHERE userId = ?
				);
		`;
		connection.query(selectSpecificBands,[req.session.uid],(error, results, fields)=>{  // calling our query
			if(error){  // checking for errors
				reject(error)
			}else{
				if(results.length == 0){
					resolve("done");
				}else{

				}var rand = Math.floor(Math.random() * results.length);
				resolve(results[rand]);
			}
				
	  	});
	})

	getBands.then((bandObj)=>{
		if(bandObj == "done"){
			res.redirect('/standings?msg=finished');
		}else{
			res.render('index', {
			name: req.session.name,
			band: bandObj
			// loggedIn: true
			});  
		}	
	});
	getBands.catch((error)=>{
		res.json(error);
	});
});

router.get('/register',function(req, res, next){
	res.render('register',{});
});

router.post('/registerProcess',(req,res,next)=>{
	// res.json(req.body);
	var name = req.body.name;
	var email = req.body.email;
	var password = req.body.password;
	const selectQuery = `SELECT * FROM users WHERE email =?;`;
	connection.query(selectQuery,[email],(error,results)=>{
		if(results.length != 0){
			res.redirect('/register?msg=registered');
		}else{
			var hash = bcrypt.hashSync(password);
			var insertQuery = `INSERT INTO users (name, email, password) VALUES (?,?,?);`;
			connection.query(insertQuery, [name,email,hash],(error)=>{
				if(error){
					throw error;
				}else{
					res.redirect('/?msg=registered');
				}
			});
		}
	});
});

router.get('/login', (req,res, next)=>{
	res.render('login', {});
});

router.post('/loginProcess',(req, res, next)=>{
	// res.json(req.body);
	var email = req.body.email;
	var password = req.body.password;
	var selectQuery	 = `SELECT * FROM users WHERE email =?;`;
	connection.query(selectQuery, [email],(error, results)=>{
		if(error){
			throw error;
		}else{
			if(results.length == 0){
				res.redirect('/login?msg=badRobot');
			}else{
				var passwordsMatch = bcrypt.compareSync(password, results[0].password);
				if (passwordsMatch){
					req.session.name = results[0].name;
					req.session.uid = results[0].id;
					req.session.email = results[0].email;
					res.redirect('/');
				}else{
					res.redirect('/login?msg=badPass');
				}
			}
		}
	}); 
});

router.get('/logout', (req,res)=>{
	req.session.destroy();
	res.redirect('/login');
});

router.get('/vote/:direction/:bandId', (req,res)=>{
	// res.json(req.params);
	var bandId = req.params.bandId;
	var direction = req.params.direction;
	var insertVoteQuery = `INSERT INTO votes (imageID, voteDirection, userId) VALUES (?,?,?);`;
	connection.query(insertVoteQuery,[bandId, direction,req.session.uid],(error, results)=>{
		if (error){
			throw error;
		}else{
			res.redirect('/');
		}
	});
});

router.get('/standings', (req,res)=>{
	const standingsQuery = `
		SELECT bands.title,bands.imageUrl,votes.imageID, SUM(IF(voteDirection='up',1,0)) as upVotes, 
		    SUM(IF(voteDirection='down',1,0)) as downVotes, 
		    SUM(IF(voteDirection='up',2,-1)) as total FROM votes
    		INNER JOIN bands on votes.imageID = bands.id
    		GROUP BY imageID ORDER BY total desc;
	`;
		connection.query(standingsQuery,(error, results)=>{
		results.map((band,i)=>{  // moving the standings logic to the controller, getting it out of the views!
			if(band.upVotes / (band.upVotes + band.downVotes) >.8 ){
				results[i].cls = "top-rated best";
			}else if(band.upVotes / (band.upVotes + band.downVotes) <= .5 ){
				results[i].cls = "worst-rated";
			}else{
				results[i].cls = "middle";
			}
		});
		if(error){
			throw error;
		}else{
			res.render('standings',{
				standingsResults: results
			});
		}
	});
});

router.get('/uploadBand', (req, res)=>{
	res.render('upload');
});


router.post('/formSubmit', nameOfFileField, (req, res)=>{
	console.log(req.file);
	console.log(req.body);
	var tmpPath = req.file.path;
	var targetPath = `public/images/${req.file.originalname}`;
	fs.readFile(tmpPath,(error, fileContents)=>{
		if(error){
			throw error;
		}
		fs.writeFile(targetPath,fileContents,(error)=>{
			if (error){
				throw error;
			}
			var insertQuery = `
				INSERT INTO bands (imageUrl, title) 
					VALUES
					(?,?);`
			connection.query(insertQuery,[req.file.originalname,req.body.bandName],(dbError,results)=>{
				if(dbError){
					throw dbError;
				}
				res.redirect('/')
			})
		})
	});
	// res.json(req.body);
});
router.get('/users', (req, res, next)=>{
	if(req.session.name === undefined){
		// goodbye.
		res.redirect('/login');
	}else{
		var name = req.session.name;
		var email = req.session.email;
		res.render('users',{
			name: name,
			email: email
		});
	}
});

router.post('/userProcess',(req,res,next)=>{
	var name = req.body.name;
	var email = req.body.email;
	var password = req.body.password;

	if ((email == "") || (name == "")){
		res.redirect('/users?msg=emptyEmail');
		return;
	}

	// var selectQuery = `Check if email is already in DB.`

	if(password == ""){
		var updateQuery = `UPDATE users SET 
			name = ?, 
			email = ? 
			WHERE id = ?;`;
		var queryParams = [name,email,req.session.uid];
	}else{
		var updateQuery = `UPDATE users SET 
			name = ?, 
			email = ?,
			password = ?
			WHERE id = ?;`;
		var hash = bcrypt.hashSync(password);
		var queryParams = [name,email,hash,req.session.uid];
	}
	connection.query(updateQuery,queryParams,(error, results)=>{
		if(error){
			throw error;
		}
		res.redirect('/')
	})

});


module.exports = router;
