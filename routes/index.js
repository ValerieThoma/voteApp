var express = require('express');
var router = express.Router();
var mysql = require('mysql');
var config = require('../config/config.js');
var bcrypt = require('bcrypt-nodejs');
var connection = mysql.createConnection(config.db);
connection.connect((error)=>{
	if(error){
		throw error;
	}
});

/* GET home page. */
router.get('/', function(req, res, next){
	if(req.session.name === undefined){
		res.redirect('/login?msg=mustlogin')
		return;
	}
	const getBands = new Promise((resolve,reject)=>{ ///promise requires resolve and reject
		// var selectQuery = `SELECT * FROM bands;`;
		var selectSpecificBands = `
			SELECT * FROM bands WHERE id NOT IN(
				SELECT imageID FROM votes WHERE userId = ?
				);
		`;
		connection.query(selectSpecificBands,[req.session.uid],(error, results, fields)=>{
			if(error){
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
		SELECT bands.title,bands.imageUrl,votes.imageID, SUM(IF(voteDirection='up',1,0)) as upVotes, SUM(IF(voteDirection='down',1,0)) as downVotes, SUM(IF(voteDirection='up',1,-1)) as total FROM votes
    		INNER JOIN bands on votes.imageID = bands.id
    		GROUP BY imageID;
	`;
	connection.query(standingsQuery, (error, results)=>{
		if(error){
			throw error;
		}else{
			res.render('standings',{
				standingsResults: results
			})
		}
	});

});

module.exports = router;
