// dependencies
var express = require('express')
var bodyParser = require('body-parser');
var path = require('path');

// config 
var app = express();
app.use(express.static(path.join(__dirname, 'static')));
app.use('/node_modules', express.static('node_modules'));
app.use(bodyParser.json());

//get config files from server folder
require('./server/config/routes.js')(app);

// listening port
var port = 3000;
var server = app.listen(port, function(){
	console.log('listening on port ', port);
});

//sockets using socket.io

var io = require("socket.io").listen(server);	
io.sockets.on('connection', function(socket){
	console.log("hello we are socket #" , socket.id);
	//score is intially set to 0 because everyone will start the game with 0 points
	socket.score = 0;
	//room variable is to have easy access to the room the socket is connected to 
	var joinedRoom;
	//from the gamestart.html page the user will be put into a room
	socket.on('joinRoom', function(gameRoom){
		socket.join(gameRoom);
		joinedRoom = gameRoom;
		var socketid = socket.id;
	});
	//when a room is created that user becomes the admin of the room and also joins the room
	socket.on('createRoom', function(gameRoom){
		socket.admin = true
		socket.join(gameRoom);
		joinedRoom = gameRoom;
		getGameRooms();
	})
	//set the userName of the connected user. 
	socket.on("setUserName", function(name){
		socket.userName = name;
	});
	//send the scores and names of all users connected.
	socket.on("pointScore", function(socketId){
		io.sockets.connected[socketId].score += 1;
		io.sockets.in(joinedRoom).emit("changeToInProgress", {});
	});
	//change the page of all users connected to the room to the partial of inprogress
	socket.on('resetToInProgress', function(){
		io.sockets.in(joinedRoom).emit("changeToInProgress", {});
	})
	//get an array of all the users and emit out to all the users in the game room 
	socket.on("getUsersInfo", function(){
		getUsersInfo();
	});
	socket.on("disconnect", function(){
		socket.disconnect();
		console.log(socket.id, " disconneted")
	});
	//find all the room that are open for users to log inot
	socket.on('getOpenRooms', function(){
		getGameRooms();
	});
	//the person who wins the buzzer get thier name shown on the screen. 
	socket.on('buzzerWinner', function(winnerSocketId){
		io.sockets.adapter.rooms[joinedRoom].buzzerWinner = io.sockets.connected["/#" + winnerSocketId].userName;
		io.sockets.adapter.rooms[joinedRoom].buzzerWinnerId = "/#" + winnerSocketId;
		io.sockets.in(joinedRoom).emit("changeToPause", {userName: io.sockets.connected["/#" + winnerSocketId].userName, socketId: "/#" + winnerSocketId});
	})
	socket.on("getBuzzerWinner", function(){
		var admin = findAdmin();
		//send the name of the buzzer winner to all the sockets connected to the room
		io.sockets.in(joinedRoom).emit("sendBuzzerWinner", {userName: io.sockets.adapter.rooms[joinedRoom].buzzerWinner, socketId: io.sockets.adapter.rooms[joinedRoom].buzzerWinnerId});
		//send the html to the admin for him to either give a point or restart the buzzer 
		io.sockets.connected[admin].emit('adminButtons', "<button ng-click='pointScore()'>Score Point</button><button ng-click='reset()'>Reset</button>");
	})
	//helper function to get all the game rooms
	var getGameRooms = function(){
		//openrooms is an array that gets all the rooms that have been created 
		var openRooms = [];
		//this loop goes through the rooms and pushes them into the arrary.
		//the if statement since a room is created by socket.io when the user connects and it follows a patter of putting thier socketId for the room. 
		for(var rooms in io.sockets.adapter.rooms){
			if(rooms.substring(0,2) !== "/#"){
				openRooms.push(rooms);
			}
		}
		io.sockets.emit('sendOpenRooms', openRooms);
	}
	//this helper function gets the user info for a table that is displayed for the user. 
	var getUsersInfo = function(){
		//Each user will have thier name and score stored in an array
		var usersInfo = [];
		//socketId of each each will be stored in an array. 
		//This get the socketId of each user connected to a room. 
		var socketId;
		for(socketId in io.sockets.adapter.rooms[joinedRoom].sockets){
			usersInfo.push({userName: io.sockets.connected[socketId].userName, score: io.sockets.connected[socketId].score})
		}
		io.sockets.in(joinedRoom).emit("usersScores", usersInfo);
	}
	//this will return the admin of the room
	var findAdmin = function(){
		var socketId;
		for(socketId in io.sockets.adapter.rooms[joinedRoom].sockets){
			if(io.sockets.connected[socketId].admin){
				return socketId;
			}
		}
		return false;
	}

});