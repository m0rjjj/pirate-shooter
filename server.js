var express = require('express'); // Express contains some boilerplate to for routing and such
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Serve the index page 
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/index.html');
});

// Listen on port 5000
app.set('port', (process.env.PORT || 5000));
http.listen(app.get('port'), function(){
  console.log('listening on port',app.get('port'));
});

// Tell Socket.io to start accepting connections
// 1 - Keep a dictionary of all the players as key/value 
var players = {};
var bullet_array = [];
io.on('connection', function(socket){
  console.log("New client has connected with id:", socket.id);
  socket.on('new-player', function(state_data){ // Listen for new-player event on this client 
    console.log("New player has state:",state_data);
    // 2 - Add the new player to the dict
    players[socket.id] = state_data;
    // Send an update event
    io.emit('update-players',players);
  }) 

  // Listen for move events and tell all other clients that something has moved 
  socket.on('move-player',function(position_data){
    if(players[socket.id] == undefined) return; // Happens if the server restarts and a client is still connected 
    players[socket.id].x = position_data.x;  
    players[socket.id].y = position_data.y; 
    players[socket.id].angle = position_data.angle; 
    io.emit('update-players',players);
  })
  
  // Listen for shoot-bullet events and add it to our bullet array
  socket.on('shoot-bullet',function(data){
    if(players[socket.id] == undefined) return;
    var new_bullet = data;
    data.owner_id = socket.id; // Attach id of the player to the bullet 
    bullet_array.push(new_bullet);
  });

  socket.on('disconnect',function(){
    // 3- Delete from dict on disconnect
    delete players[socket.id];
    // Send an update event 
  })
})

// Update the bullets 60 times per frame and send updates 
function ServerGameLoop(){
  for(var i=0;i<bullet_array.length;i++){
    var bullet = bullet_array[i];
    bullet.x += bullet.speed_x; 
    bullet.y += bullet.speed_y; 
    
    // Check if this bullet is close enough to hit any player 
    for(var id in players){
      if(bullet.owner_id != id){
        // And your own bullet shouldn't kill you
        var dx = players[id].x - bullet.x; 
        var dy = players[id].y - bullet.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if(dist < 70){
          io.emit('player-hit',id); // Tell everyone this player got hit
        }
      }
    }
    
    // Remove if it goes too far off screen 
    if(bullet.x < -10 || bullet.x > 1000 || bullet.y < -10 || bullet.y > 1000){
        bullet_array.splice(i,1);
        i--;
    }
        
  }
  // Tell everyone where all the bullets are by sending the whole array
  io.emit("bullets-update",bullet_array);
}
 
setInterval(ServerGameLoop, 16);