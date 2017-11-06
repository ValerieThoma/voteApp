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
router.get('/', function(req, res, next) {
	if(req.session.name != undefined){
		console.log(`Welcome, ${req.session.name}`);
	}
  	res.render('index', {
  		name: req.session.name
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
					req.session.id = results[0].id;
					req.session.email = results[0].email;
					res.redirect('/');
				}else{
					res.redirect('/login?msg=badPass');
				}
			}
		}
	});
});

module.exports = router;
