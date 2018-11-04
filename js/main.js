var app;
$(document).ready(function(){
  app = new GrandFinale($('#viz'));
})
var GrandFinale = function($el){
  var _this = this;
  this.tourIncVal = 0.01;
  this.isPlaylist = false;
  this.cancelCameraTrack = false;
  this.$el = $el;
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 );
  this.clientID = '9c1d801461f8c38a5ccd153c281cf3f0'; //for soundcloud
  this.soundCloudStream = {},
  this.streamPlaylistIndex = 0;
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  
  this.context = new AudioContext();
  this.tuna = new Tuna(this.context);
  this.effects = {};
  this.effects.bitcrusher = new this.tuna.Bitcrusher({
    bits: 2,          //1 to 16
    normfreq: 0.1,    //0 to 1
    bufferSize: 4096  //256 to 16384
  });
  this.effects.phaser = new this.tuna.Phaser({
      rate: 1.2,                     //0.01 to 8 is a decent range, but higher values are possible
      depth: 0.3,                    //0 to 1
      feedback: 0.2,                 //0 to 1+
      stereoPhase: 30,               //0 to 180
      baseModulationFrequency: 700,  //500 to 1500
      bypass: 0
  });
  this.effects.pingPongDelay = new this.tuna.PingPongDelay({
      wetLevel: 0.5, //0 to 1
      feedback: 0.3, //0 to 1
      delayTimeLeft: 150, //1 to 10000 (milliseconds)
      delayTimeRight: 200 //1 to 10000 (milliseconds)
  });
  this.effects.moog = new this.tuna.MoogFilter({
      cutoff: 0.065,    //0 to 1
      resonance: 3.5,   //0 to 4
      bufferSize: 4096  //256 to 16384
  });
  this.effects.wahwah = new this.tuna.WahWah({
      automode: true,                //true/false
      baseFrequency: 0.5,            //0 to 1
      excursionOctaves: 2,           //1 to 6
      sweep: 0.2,                    //0 to 1
      resonance: 10,                 //1 to 100
      sensitivity: 0.5,              //-1 to 1
      bypass: 0
  });
  this.effects.tremolo = new this.tuna.Tremolo({
      intensity: 0.3,    //0 to 1
      rate: 4,         //0.001 to 8
      stereoPhase: 0,    //0 to 180
      bypass: 0
  });
  this.effects.delay = new this.tuna.Delay({
    feedback: 0.45,    //0 to 1+
    delayTime: 150,    //1 to 10000 milliseconds
    wetLevel: 0.25,    //0 to 1+
    dryLevel: 1,       //0 to 1+
    cutoff: 2000,      //cutoff frequency of the built in lowpass-filter. 20 to 22050
    bypass: 0
  });
  this.effects.overdrive = new this.tuna.Overdrive({
    outputGain: 0.5,         //0 to 1+
    drive: 0.7,              //0 to 1
    curveAmount: 1,          //0 to 1
    algorithmIndex: 0,       //0 to 5, selects one of our drive algorithms
    bypass: 0
  });
  this.effects.compressor = new this.tuna.Compressor({
    threshold: -1,    //-100 to 0
    makeupGain: 1,     //0 and up (in decibels)
    attack: 1,         //0 to 1000
    release: 0,        //0 to 3000
    ratio: 4,          //1 to 20
    knee: 5,           //0 to 40
    automakeup: true,  //true/false
    bypass: 0
  });
  this.effects.convolver = new this.tuna.Convolver({
    highCut: 22050,                         //20 to 22050
    lowCut: 20,                             //20 to 22050
    dryLevel: 1,                            //0 to 1+
    wetLevel: 1,                            //0 to 1+
    level: 1,                               //0 to 1+, adjusts total output of both wet and dry
    impulse: "impulses/impulse_rev.wav",    //the path to your impulse response
    bypass: 0
}); 

  this.activeEffect = 'wahwah';
  /*this.cabinet = new tuna.Cabinet({
      makeupGain: 1,                                 //0 to 20
      impulsePath: "impulses/impulse_guitar.wav",    //path to your speaker impulse
      bypass: 0
  });*/

  /*this.input = this.context.createGain();
  this.output = this.context.createGain();
  this.input.connect(this.effects[_this.activeEffect]);
  this.effects[_this.activeEffect].connect(this.output);
  this.output.connect(this.context.destination)*/
  this.useAllFrequencies = false;
  this.reverseFrequencies = true;
  /*currentTrack,
  streamUrl;*/
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize( window.innerWidth, window.innerHeight );
  this.$el[0].appendChild( this.renderer.domElement );
  this.controls = new THREE.TrackballControls(this.camera, this.renderer.domElement);
  var z = Math.sqrt(Math.pow(1024*1.5,2),Math.pow(1024*1.5,2))
  this.camera.position.setX(-512);
  this.camera.position.setY(-512);
  this.camera.position.setZ(z);
  
  this.camera.lookAt(new THREE.Vector3(-512,-512,0));
  this.controls.target.set(-512,-512,0);
  /*this.renderer.render(this.scene,this.camera);*/
  $.get('data/cassini2.json',function(data){
    _this.setupParticles(data);
    _this.initDatGui();
    if(typeof SC != "undefined"){
    //soundcloud API is here...
    _this.player = document.getElementById('soundcloudPlayer');
    _this.player.crossOrigin = "anonymous";
    SC.initialize({
      client_id: _this.clientID
    });
    var defaultTrack = 'https://soundcloud.com/alexsmith540/sets/saturn';//'https://soundcloud.com/psbhq/the-other-side-public-service-broadcasting';
    var track_url = window.location.hash != '' ? ( window.location.hash.indexOf('http') >= 0 ? window.location.hash.substring(1) : 'https://soundcloud.com/'+window.location.hash.substring(1) ) : defaultTrack;
    _this.resolveTrack(track_url);
    console.log('trackurl',track_url);
    //listener for next songs
    $('#soundcloudPlayer').bind('ended',function(e){
      console.log('song ended!')
      if(_this.soundCloudStream.kind == 'playlist'){
        _this.streamPlaylistIndex++;
        if(typeof _this.soundCloudStream.tracks[_this.streamPlaylistIndex] == "undefined"){
          _this.streamPlaylistIndex = 0; 
        }
        if(typeof _this.soundCloudStream.tracks[_this.streamPlaylistIndex] != "undefined"){
          currentTrack = _this.soundCloudStream.tracks[_this.streamPlaylistIndex];
          track_url = _this.soundCloudStream.tracks[_this.streamPlaylistIndex].stream_url;
          console.log('and new trackurl',track_url);
          _this.player.setAttribute('src',track_url+'?client_id='+_this.clientID);
          setTimeout(function(){
            _this.player.currentTime = 0;
            _this.player.play();
          },5000);
        }
      }
      else{
        setTimeout(function(){
          _this.player.currentTime = 0;
          _this.player.play();
        },5000)
        
      }
      _this.setUIMeta();
    });
    
  }
  })
  this.saturnIcosGroup = new THREE.Object3D();
  var icos = new THREE.IcosahedronGeometry(256,1);
  var mesh = new THREE.Mesh(icos,new THREE.MeshBasicMaterial({wireframe:true,color:0x00a0fe,transparent:true,opacity:0.35}));
  this.saturnIcosahedron = mesh;
  mesh.scale.set(1.01,1.01,1.01)
  this.saturnShadeIcos = new THREE.Mesh(icos,new THREE.MeshBasicMaterial({color:0x003555,transparent:true,opacity:0.7}))
  this.saturnIcosGroup.position.setX(-512);
  this.saturnIcosGroup.position.setY(-512);
  this.saturnIcosGroup.add(mesh);
  this.saturnIcosGroup.add(this.saturnShadeIcos)
  this.scene.add(this.saturnIcosGroup);
  this.animate();
  this.initFlatFrequency();
}
GrandFinale.prototype.initFlatFrequency = function(){
  this.flatSVG = d3.select('.flatFrequency svg')
    .attr('width',$('.flatFrequency').width())
    .attr('height',$('.flatFrequency').height());
  this.flatSVG.append('g')
    .classed('lineGroup',true);
  this.flatSVGXScale = d3.scaleLinear()
    .domain([0,1024])
    .range([0,$('.flatFrequency').width()]);
  this.flatSVGYScale = d3.scaleLinear()
    .domain([0,1024])
    .range([$('.flatFrequency').height()*0.05,$('.flatFrequency').height()*0.95]);
}
GrandFinale.prototype.resolveTrack = function(track_url){
  var _this = this;
  SC.get('/resolve', { url: track_url }, function(sound,err) {

    console.log('resolved track',sound,err);
    if(sound == null && err){
      //error loading track
      if(err.message){
        if(err.message.indexOf('403') >= 0){
          alert('Uh-oh: This SoundCloud Artist does not permit Data API Sharing. Try Another Song.')
        }
        else{
          alert('ERROR LOADING SOUNDCLOUD RESOURCE');
        }
      }
    }
    if (sound.errors) {
        
        //errorCallback();
        console.log('trackurl',track_url )
        console.error('error',sound.errors);
        //alert('error finding track')
    } else {
        if(sound.kind=="playlist"){
          _this.soundCloudStream = sound;
          _this.currentTrack = sound;
          _this.isPlaylist = true;
          _this.streamUrl = function(){
              return sound.tracks[_this.streamPlaylistIndex].stream_url + '?client_id=' + _this.clientID;
          }
          _this.player.setAttribute('src', _this.streamUrl());
          _this.finishedLoading(_this.player);
          _this.setUIMeta();
        }else{
          _this.soundCloudStream = sound;
          _this.currentTrack = sound;
          _this.isPlaylist = false;
          _this.streamUrl = function(){ return sound.stream_url + '?client_id=' + _this.clientID; };
          _this.player.setAttribute('src', _this.streamUrl());
          _this.finishedLoading(_this.player);
          console.log('success making sound!',sound);

          _this.setUIMeta();
          
        }
    }
  });
}
GrandFinale.prototype.setUIMeta = function(){
  //stub, where we display song meta info.
  var _this = this;
  var streamIndex = this.streamPlaylistIndex || 0;
  var currentTrack = this.isPlaylist ? this.currentTrack.tracks[streamIndex] : this.currentTrack;
  var linkTrack = $('<a class="trackTitle" href="'+currentTrack.permalink_url+'" target="_blank">'+currentTrack.title+'</a>')
  var linkArtist = $('<a class="trackArtist" href="'+currentTrack.user.permalink_url+'" target="_blank">'+currentTrack.user.username+'</a>')
  $('.nowPlaying .trackName').html(linkTrack);
  $('.nowPlaying .trackName').append(' | ');
  $('.nowPlaying .trackName').append(linkArtist);
  //$('.nowPlaying .trackURL input').val(currentTrack.permalink_url)
  var duration = currentTrack.duration/1000;
  var m = Math.floor(duration/60);
  if(m < 10){
    m = '0'+m;
  }
  var ds = Math.floor(duration % 60);
  if(ds < 10){
    ds = '0'+ds;
  }
  $('.nowPlaying .duration').html(m+':'+ds)
  var nowPlayingTime = this.player.currentTime;
  var currentlyPaused = this.player.paused;
  /*if(currentlyPaused){
    $('.nowPlaying .playPause').html('play').addClass('isPaused');
  }
  else{
    $('.nowPlaying .playPause').html('pause').removeClass('isPaused');
  }*/
  $('.nowPlaying .playPause').off('click').on('click',function(){
    if(_this.player.paused){
      _this.player.play();
      
      setTimeout(function(){_this.startTour();},10000);
      $(this).html('pause').removeClass('isPaused')
      startTO();
    }
    else{
      _this.player.pause();
      $(this).html('play').addClass('isPaused')
      _this.cancelCameraTrack = true;
      clearTO()
    }
  });
  $('.trackURL .go').off('click').on('click',function(){
    if($('.trackURL input').val() != ''){
      window.location.hash = '';
      window.location.href = '/#'+$('.trackURL input').val();
      window.location.reload();
    }
  });
  function startTO(){
    clearTO();
    _this.uiTimer = setInterval(function(){
      var val = _this.player.currentTime;
      var s = Math.floor(val);
      var perc = s / duration;
      perc = Math.floor(perc * 100);
      var percAdd = perc+1 > 100 ? 100 : perc+1;
      var bsString = 'linear-gradient(to right, rgba(255,255,255,0.5) 0%,rgba(255,255,255,0.5) '+(perc)+'%,rgba(255,255,255,0) '+(perc)+'%,rgba(255,255,255,0) 100%)'
      $('.nowPlaying .currentBar').css('background',bsString);
      var m = 0;
      var s = Math.floor(val % 60);
      if(s < 10){
        s = '0'+s;
      }
      if(val > 60){
        m = Math.floor(val / 60);
        if(m < 10){
          m = '0'+m;
        } 
      }
      $('.nowPlaying .currentTime').html(m+':'+s)

    },1000);
  }
  function clearTO(){
    if(typeof _this.uiTimer != "undefined"){
      clearInterval(_this.uiTimer);
    }
  }

}
//_sourceList = [];
GrandFinale.prototype.finishedLoading = function(bufferList) {
  var _this = this;

  if(typeof _this.sourceList == "undefined"){
    this._sourceList = [];
  }
  if(typeof this.analyser == "undefined") {
    this.analyser = this.context.createAnalyser();
  }
  if(typeof SC == "undefined"){
    bufferList.map(function(x,i){
      var src = _this.context.createBufferSource()
      src.loop = false;
      src.buffer = x;
      src.connect(_this.analyser);
      _this._sourceList.push(src);
    })
    //circ = new RadialFreqViz($('#circleViz'),analyser);
    console.log('done loading')
  }
  else{
    var stream = _this.context.createMediaElementSource(bufferList);
    stream.connect(_this.analyser)
    //circ = new RadialFreqViz($('#circleViz'),analyser);
  }
  
  _this.analyser.connect(_this.context.destination);
  //_this.analyser.connect(_this.input);
  _this.freqDomain = new Uint8Array(this.analyser.frequencyBinCount);
  //_this.analyser.getByteFrequencyData(_this.freqDomain);
  _this.analyser.getByteTimeDomainData(_this.freqDomain);
  _this.start();
}
GrandFinale.prototype.start = function(){
  var _this = this;
  /*var i = 0.0;
  var z = Math.sqrt(Math.pow(512,2),Math.pow(512,2))
  var cameraStart = this.camera.position.clone();
  var cameraEnd = new THREE.Vector3(-z,-z,0);
  this.camera.lookAt(new THREE.Vector3(0,0,0));
  go();

  function go(){
    i += 0.1;
    
    if(i < 1.0){
    window.requestAnimationFrame(function(){
      go();
    });
    }
    if(i >= 1.0){
      i = 1.0;
      //_this.camera.up.set(0,0,1);
    }
    var newPos = cameraStart.lerp(cameraEnd,i);
    console.log('new pos',newPos,cameraStart);
    _this.camera.position.set(newPos.x,newPos.y,newPos.z);//newPos;

  }*/
  this.updateUniforms = true;
  this.updateUniformsValue = -0.0001;
  //this.camera.position.set(z,z,0);
  //this.camera.lookAt(new THREE.Vector3(0,0,0));
}
//[156.6856930266215, -1594.432482988632, 53.75143577306444]
//[-512,-512,0]
GrandFinale.prototype.startCameraTrack = function(points){
  //points being a pair of position and target for the camera
  var _this = this;
  this.camera.up.set(0,0,1);
  var pointI = 0;
  //var inc = this.tourIncVal;
  var toVal = 0;
  var posIn = this.camera.position.clone();
  var posOut = points[pointI].position.clone();
  var targetIn = this.controls.target.clone();
  var targetOut = points[pointI].target.clone();
  points.push({position:posIn.clone(),target:targetIn.clone()}); //so we loop back to start
  var len = points.length;
  console.log('posin',posIn);
  increment();
  function increment(){
    //console.log('inc',toVal);
    toVal += _this.tourIncVal;
    if(toVal >= 1){
      //increment to next point
      pointI = typeof points[pointI+1] == "undefined" ? 0 : pointI+1;
      toVal = 0;
      console.log('pointi is now',pointI,points.length)
      posOut = points[pointI].position.clone();
      targetOut = points[pointI].target.clone();
      posIn = _this.camera.position.clone();
      targetIn = _this.controls.target.clone();
    }
    var lerpedPos = posIn.clone().lerp(posOut,toVal);
    var lerpedTarget = targetIn.clone().lerp(targetOut,toVal);
    _this.camera.position.set(lerpedPos.x,lerpedPos.y,lerpedPos.z);
    _this.controls.target.set(lerpedTarget.x,lerpedTarget.y,lerpedTarget.z);
    if(_this.cancelCameraTrack){
      _this.cancelCameraTrack = false;
      return false;
    }
    window.requestAnimationFrame(function(){
      increment();
    });

  }
}
GrandFinale.prototype.setupParticles = function(data){
  var _this = this;
  this.uniforms = {
    color:     { value: new THREE.Color( 0xffffff ) },
    amplitude: { value: 0.0},
    texture:   { value: new THREE.TextureLoader().load( "img/spark0.png" ) },
    zeroTexture: { value: new THREE.TextureLoader().load( "img/zero.png")},
    oneTexture: { value: new THREE.TextureLoader().load( "img/one.png")},
    
    ringColor: {value: new THREE.Vector3(0.996078431372549,0,0.820299884659746)},
    isRingLinear:{value:false},
    isRing:{value:true},
    isSpherical: {value:false}
  };
  var color = new THREE.Color();
  color.r = this.uniforms.ringColor.value.x;
  color.g = this.uniforms.ringColor.value.y;
  color.b = this.uniforms.ringColor.value.z;
  this.saturnIcosahedron.material.color = color;
  var shaderMaterial = new THREE.ShaderMaterial( {
    uniforms:       this.uniforms,
    vertexShader:   document.getElementById( 'vertexshader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
    blending:       THREE.AdditiveBlending,
    depthTest:      false,
    transparent:    true
  });
  var f = 1024;
  var particles = f*f;
  this.pointGeometry = new THREE.BufferGeometry();
  var positions = new Float32Array( particles * 3 );
  var flatPositions = new Float32Array( particles * 3 );
  var sphericalPositions = new Float32Array( particles * 3 );
  var ringPositions = new Float32Array(particles * 3);
  var colors = new Float32Array( particles * 3 );
  var sizes = new Float32Array( particles );
  var alpha = new Float32Array(particles);
  var character = new Float32Array(particles);
  var color = new THREE.Color();
  var frequencies = new Float32Array(particles);
  //$.get('data/cassini1.json',function(data){
  var radiusScale = d3.scaleLinear()
    .range([512,1024])
    .domain([0,1024]);
  var degreeScale = d3.scaleLinear()
    .range([0,Math.PI*2])
    .domain([0,1024]);
  data.data.reverse().map(function(row,i){
    row.map(function(cell,j){
      var lat = i / data.data.length * 360;
      var lon = j/row.length * 360;
      var alt = 512;
      //var sph = _this.spherical2Cartesian(lat,lon,alt);

      sphericalPositions[(i*row.length+j)*3+0] = lat;
      sphericalPositions[(i*row.length+j)*3+1] = lon;
      sphericalPositions[(i*row.length+j)*3+2] = alt;
      
      var ringRadius = radiusScale(i);
      var ringDegree = degreeScale(j);
      ringPositions[(i*row.length+j)*3+0] = ringRadius;
      ringPositions[(i*row.length+j)*3+1] = ringDegree;
      ringPositions[(i*row.length+j)*3+2] = 0;

      positions[(i*row.length+j)*3+0] = j;
      positions[(i*row.length+j)*3+1] = i;
      positions[(i*row.length+j)*3+2] = 0;
      flatPositions[(i*row.length+j)*3+0] = j;
      flatPositions[(i*row.length+j)*3+1] = i;
      flatPositions[(i*row.length+j)*3+2] = 0;
      
      colors[(i*f+j)*3+0] = cell/255;
      colors[(i*f+j)*3+1] = cell/255;
      colors[(i*f+j)*3+2] = cell/255;
      alpha[i*f+j] = 1.0;
      sizes[i*f+j] = 15;
      frequencies[i*f+j] = 0.0;
      character[i*f+j] = Math.round(Math.random()-0.25);
    })
  })
  //})
  /*for(var i = 0;i<f;i++){
    for(var j=0;j<f;j++){
      positions[(i*f+j)*3+0] = j;
      positions[(i*f+j)*3+1] = i;
      positions[(i*f+j)*3+2] = 0;
      colors[(i*f+j)*3+0] = color.r;
      colors[(i*f+j)*3+1] = color.g;
      colors[(i*f+j)*3+2] = color.b;
      sizes[i*f+j] = 11;
    }
  }*/
  this.pointGeometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
  this.pointGeometry.addAttribute( 'customColor', new THREE.BufferAttribute( colors, 3 ) );
  this.pointGeometry.addAttribute( 'size', new THREE.BufferAttribute(sizes,1));
  this.pointGeometry.addAttribute( 'alpha', new THREE.BufferAttribute(alpha,1));
  this.pointGeometry.addAttribute( 'sphericalPosition',new THREE.BufferAttribute(sphericalPositions,3));
  this.pointGeometry.addAttribute( 'ringPosition',new THREE.BufferAttribute(ringPositions,3));
  this.pointGeometry.addAttribute( 'flatPosition',new THREE.BufferAttribute(flatPositions,3));
  this.pointGeometry.addAttribute( 'frequency',new THREE.BufferAttribute(frequencies,1));
  this.pointGeometry.addAttribute( 'character',new THREE.BufferAttribute(character,1));
  this.pointGeometry.computeBoundingSphere();
  var material = new THREE.PointsMaterial( { size: 15, vertexColors: THREE.VertexColors } );
  this.points = new THREE.Points( this.pointGeometry, shaderMaterial );
  this.points.position.set(-f/2,-f/2,0);
  this.scene.add( this.points );
}
GrandFinale.prototype.spherical2Cartesian = function(lat,lon,radius){
  var lat = lat * (Math.PI / 180);
  var lon = lon * (Math.PI / 180);
  var x = radius * Math.cos(lat)*Math.cos(lon);
  var y = radius * Math.cos(lat)*Math.sin(lon);
  var z = radius * Math.sin(lat);
  return new THREE.Vector3(x,y,z);
}
GrandFinale.prototype.updateAlpha = function(val){
  var data = this.pointGeometry.attributes.alpha.array;
  for(i=0;i<data.length;i++){
    this.pointGeometry.attributes.alpha.array[i] = val;
  }
  this.pointGeometry.attributes.alpha.needsUpdate = true;
}
GrandFinale.prototype.setSpherical = function(isSpherical){
  /*var data = this.pointGeometry.attributes.customColor.array;
  for(i=0;i<data.length;i++){
    this.pointGeometry.attributes.customColor.array[i] = 0.7;
  }
  this.pointGeometry.attributes.customColor.needsUpdate = true;*/
  this.uniforms.isSpherical.value = isSpherical;
}
GrandFinale.prototype.setRing = function(isRing){
  this.uniforms.isSpherical.value = false;
  this.uniforms.isRing.value = isRing;
}
GrandFinale.prototype.updateAnalyserData = function(){
  //this.freqDomain;
  var _this = this;

  if(typeof this.freqDomain == "undefined"){
    return false;
  }
  _this.analyser.getByteFrequencyData(_this.freqDomain);
  if(typeof this.frequencyScale == "undefined"){
    this.frequencyScale = d3.scaleLinear();
    this.alphaScale = d3.scaleLinear();
    
  }
  var filter = Array.prototype.filter;
  var allFreq = this.freqDomain;//.subarray()

  if(_this.useAllFrequencies){
    var frequencies = this.freqDomain;
  }
  else{
    var frequencies  = /*this.freqDomain;*/ filter.call(this.freqDomain,function(x,i){
      return x > 0;
    });
  }
  if(_this.reverseFrequencies){
    frequencies = frequencies.reverse();
  }
  _this.flatSVGXScale.domain([0,frequencies.length]);
  //var frequencies = this.freqDomain;
  var lineScaleMin = d3.min(frequencies);
  var lineScaleMax = d3.max(frequencies);
  this.flatSVGYScale.domain([lineScaleMin,lineScaleMax]);
  this.frequencyScale
    .domain([lineScaleMin,lineScaleMax])
    .range([0.01,0.01]);
  var scaleMax = _this.useAllFrequencies ? 0.5 : 0.35;
  this.alphaScale
    .domain([lineScaleMin,lineScaleMax])
    .range([0.01,scaleMax])
    .clamp(true);
  var len = this.pointGeometry.attributes.frequency.array.length;
  for(i=0;i<len;i++){
    var val = frequencies[/*Math.floor(Math.random()*frequencies.length)*/ Math.floor(i/1024/1024*frequencies.length)/*i % frequencies.length*/];
    this.pointGeometry.attributes.frequency.array[i] = _this.frequencyScale(val);
    if(this.uniforms.isRing.value){
      this.pointGeometry.attributes.alpha.array[i] = this.alphaScale(val);
    }
    /*else{
      if(!this.uniforms.isSpherical.value){
        this.pointGeometry.attributes.alpha.array[i] = 0.25;
      }
    }*/
  }
  if(this.uniforms.isRing.value)
    _this.pointGeometry.attributes.alpha.needsUpdate = true;
  
  _this.pointGeometry.attributes.frequency.needsUpdate = true;
  /*if(typeof _this.hasUpdatedFrequencies == "undefined"){
    _this.hasUpdatedFrequencies = true;
    _this.pointGeometry.attributes.alpha.needsUpdate = true;
    _this.pointGeometry.attributes.frequency.needsUpdate = true;
  }*/
  if(!_this.player.paused){
    var lines = this.flatSVG.select('g.lineGroup')
      .selectAll('line')
      .data(this.freqDomain);
    lines
      .attr('x1',function(d,i){
        return _this.flatSVGXScale(i);
      })
      .attr('x2',function(d,i){
        return _this.flatSVGXScale(i);
      })
      .attr('y1',function(d){
        var diff = ( _this.flatSVGYScale.range()[1] - _this.flatSVGYScale(d) ) / 2;
        return _this.flatSVGYScale.range()[0] + diff;
      })
      .attr('y2',function(d){
        var diff = ( _this.flatSVGYScale.range()[1] - _this.flatSVGYScale(d) ) / 2;
        return _this.flatSVGYScale.range()[1] - diff;//_this.flatSVGYScale.domain()[1] - diff;
      });
    lines.enter()
      .append('line')
      .classed('flatLine',true)
      .attr('x1',function(d,i){
        return _this.flatSVGXScale(i);
      })
      .attr('x2',function(d,i){
        return _this.flatSVGXScale(i);
      })
      .attr('y1',function(d){
        var diff = ( _this.flatSVGYScale.domain()[1] - _this.flatSVGYScale(d) ) / 2;
        return diff;
      })
      .attr('y2',function(d){
        var diff = ( _this.flatSVGYScale.domain()[1] - _this.flatSVGYScale(d) ) / 2;
        return diff + _this.flatSVGYScale(d);
      });
    lines.exit().remove();
  }
}
GrandFinale.prototype.animate = function(){
  var _this = this;
  if(this.updateUniforms){
    if(this.uniforms.amplitude.value <= -0.47 || this.uniforms.amplitude.value >= 0.47){
      this.updateUniformsValue *= -1;
    }
    this.uniforms.amplitude.value += this.updateUniformsValue;
  }
  this.animationFrame = window.requestAnimationFrame(function(){
    _this.animate();
  });
  this.updateAnalyserData();
  this.controls.update();
  this.renderer.render(this.scene,this.camera);
}
GrandFinale.prototype.startTour = function(){
  var _this = this;
  var points = [];
  var origin = _this.camera.position.clone();
  var opposite = _this.camera.position.clone().setZ(origin.clone().z*-1);

  for(var i=1;i<21;i+=1){
    if(i % 3 == 0){
      var tgt = new THREE.Vector3(-512,-512,0);
      var o = Math.random();
      if(o < 0.5){
        points.push({position:opposite,target:new THREE.Vector3(-512,-512,0)});
          }
      else{
        points.push({position:origin,target:new THREE.Vector3(-512,-512,0)});
      }
    }
    else{
      var tgt = new THREE.Vector3(Math.cos(i/21*Math.PI*2)*(512+Math.random()*512),Math.sin(i/21*Math.PI*2)*(512+Math.random()*512),0);
    }
    var deg = Math.random()*Math.PI*2;
    var rad = 600 + Math.random()*800;
    var pos = new THREE.Vector3(Math.cos(deg)*rad,Math.sin(deg)*rad,(-Math.random()+Math.random() )* 1024);
    
    points.push({position:pos,target:tgt});
  }
  _this.startCameraTrack(points);
}
GrandFinale.prototype.initDatGui = function(){
  var _this = this;
  var guiParams = {
    /*startMagnetism:function(){
      _this.updateAlpha(0.2);
      _this.start();
    },
    toggleSpherical:function(){
      var val = !_this.uniforms.isSpherical.value;
      if(val){
        _this.updateAlpha(1.0);
      }
      _this.setSpherical(val)
    },*/
    /*toggleRing: function(){
      var val = !_this.uniforms.isRing.value;
      if(val){
        _this.updateUniformsValue = -0.001;
        _this.saturnIcosahedron.material.opacity = 0.35;
      }
      else{
        _this.saturnIcosahedron.material.opacity = 0;
        _this.updateAlpha(0.3);
        _this.updateUniformsValue = -0.0001;

      }
      _this.setRing(val);
    },*/
    /*toggleCenteredBlurb: function(){
      $('#blurbArea').removeClass('rightAligned').toggle();
    },
    toggleRightAlignedBlurb: function(){
      $('#blurbArea').addClass('rightAligned').toggle();
    },*/
    ringColor:[0.996078431372549*255,0,0.820299884659746*255],
    useAllRingFrequencies: _this.useAllFrequencies,
    reverseFrequencies: _this.reverseFrequencies,
    LinearOrMagnetizeRings: _this.uniforms.isRingLinear.value,
    guidedTourSpeed:20,
    /*effect:'phaser',*/
    startGuidedTour:function(){

      var points = [];
      var origin = _this.camera.position.clone();
      var opposite = _this.camera.position.clone().setZ(origin.clone().z*-1);

      for(var i=1;i<21;i+=1){
        if(i % 3 == 0){
          var tgt = new THREE.Vector3(-512,-512,0);
          var o = Math.random();
          if(o < 0.5){
            points.push({position:opposite,target:new THREE.Vector3(-512,-512,0)});
              }
          else{
            points.push({position:origin,target:new THREE.Vector3(-512,-512,0)});
          }
        }
        else{
          var tgt = new THREE.Vector3(Math.cos(i/21*Math.PI*2)*(512+Math.random()*512),Math.sin(i/21*Math.PI*2)*(512+Math.random()*512),0);
        }
        var deg = Math.random()*Math.PI*2;
        var rad = 600 + Math.random()*800;
        var pos = new THREE.Vector3(Math.cos(deg)*rad,Math.sin(deg)*rad,(-Math.random()+Math.random() )* 1024);
        
        points.push({position:pos,target:tgt});
      }
      _this.startCameraTrack(points);
    },
    stopGuidedTour:function(){
      _this.cancelCameraTrack = true;
    }
  }
  var gui = new dat.GUI();
  /*gui.add(guiParams,'startMagnetism');
  gui.add(guiParams,'toggleSpherical');
  gui.add(guiParams,'toggleRing');
  gui.add(guiParams,'toggleCenteredBlurb');
  gui.add(guiParams,'toggleRightAlignedBlurb');*/
  var color = gui.addColor(guiParams,'ringColor')
  color.onChange(function(val){
    console.log('val',val);
    _this.uniforms.ringColor.value = new THREE.Vector3(val[0]/255,val[1]/255,val[2]/255);
    var color = new THREE.Color();
    $('.playPause').css('background','rgba('+val[0]+','+val[1]+','+val[2]+',0.2)')
    color.r = _this.uniforms.ringColor.value.x;
    color.g = _this.uniforms.ringColor.value.y;
    color.b = _this.uniforms.ringColor.value.z;
    _this.saturnIcosahedron.material.color = color;
  });
  var allFrequencies = gui.add(guiParams,'useAllRingFrequencies');
  allFrequencies.onChange(function(val){
    _this.useAllFrequencies = val;
  });
  var linearOrMag = gui.add(guiParams,'LinearOrMagnetizeRings');
  linearOrMag.onChange(function(val){
    _this.uniforms.isRingLinear.value = val;

  });
  var reversed = gui.add(guiParams,'reverseFrequencies');
  reversed.onChange(function(val){
    _this.reverseFrequencies = val;
  });
  var speed = gui.add(guiParams,'guidedTourSpeed',1,50,1);
  speed.onChange(function(val){
    _this.tourIncVal = val/50 * 0.05;
  });
  /*var effect = gui.add(guiParams,'effect',['phaser','bitcrusher','pingPongDelay','moog','wahwah','tremolo', 'delay']);
  effect.onChange(function(val){
    var effect = _this.effects[_this.activeEffect];
    effect.disconnect();

    //effect.disconnect(_this.input)
    //_this.input.disconnect(effect);

    //_this.output.disconnect(effect);
    //effect.disconnect(_this.input);
    _this.input.connect(_this.effects[val]);
    _this.effects[val].connect(_this.output);
    _this.activeEffect = val;
  })*/
  gui.add(guiParams,'startGuidedTour');
  gui.add(guiParams,'stopGuidedTour');
  gui.close();
}