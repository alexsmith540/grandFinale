var app;
$(document).ready(function(){
  app = new GrandFinale($('#viz'));
})

var QueryString = function () {
  // This function is anonymous, is executed immediately and 
  // the return value is assigned to QueryString!
  var query_string = {};
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
        // If first entry with this name
    if (typeof query_string[pair[0]] === "undefined") {
      query_string[pair[0]] = decodeURIComponent(pair[1]);
        // If second entry with this name
    } else if (typeof query_string[pair[0]] === "string") {
      var arr = [ query_string[pair[0]],decodeURIComponent(pair[1]) ];
      query_string[pair[0]] = arr;
        // If third or later entry with this name
    } else {
      query_string[pair[0]].push(decodeURIComponent(pair[1]));
    }
  } 
  return query_string;
}();

var GrandFinale = function($el){
  var _this = this;
  this.spotifyApi = new SpotifyWebApi();
  this.spotifyClientID = "2514ac6b6ca448acb004884509e217d1";
  //DEV:
  //this.spotifyRedirectURI = "http://localhost:8001/";
  
  //PROD:
  this.spotifyRedirectURI = "https://alexsmith540.github.io/grandFinale/";

  if(localStorage.getItem('verifier') == null){
    localStorage.setItem('verifier',this.getSpotifyVerifier());
  }
  
  this.spotifyVerif = localStorage.getItem('verifier');

  if(localStorage.getItem('tokenExpires') != null){
    let expires = parseInt(localStorage.getItem('tokenExpires'));
    if(expires < new Date().getTime()){
      //has expired
      localStorage.removeItem('spotifyCode');
      localStorage.removeItem('refreshToken');
      $('#loginToSpotify #instruction').hide();
      $('#loginToSpotify #loginPage').show();
      $('#loginToSpotify').addClass('showing').removeClass('instructionShowing');
    }
    else{
      let diff =  expires - new Date().getTime() - 2000;
      if(diff > 0){
        setTimeout(()=>{
          this.refreshSpotifyToken();
        },diff)
      }
      else{
        this.refreshSpotifyToken();
      }
    }
  }
  if(typeof QueryString['code'] != "undefined" && localStorage.getItem('spotifyCode') == null){
    $.post('https://accounts.spotify.com/api/token',{
      client_id: this.spotifyClientID,
      grant_type: 'authorization_code',
      code:QueryString['code'],
      redirect_uri: this.spotifyRedirectURI,
      code_verifier: this.spotifyVerif//btoa('2e2e4f3453f4c8cef3838cc8306b848f1215a368d9e341f42d4f686f8b1a2300')
    },(data)=>{
      console.log('data received back',data);
      let token = data.access_token;
      let refreshToken = data.refresh_token;
      let expires = new Date().getTime() + (data.expires_in * 1000);

      localStorage.setItem('spotifyCode',token);
      localStorage.setItem('spotifyRefreshCode',refreshToken);
      localStorage.setItem('tokenExpires',expires);
      setTimeout(()=>{
        this.refreshSpotifyToken();
      },(data.expires_in-10) * 1000)
      $('#loginToSpotify #instruction').show();
      $('#loginToSpotify #loginPage').hide();
      $('#loginToSpotify').addClass('showing').addClass('instructionShowing');
      this.spotifyApi.setAccessToken(localStorage.getItem('spotifyCode'));
      this.pollSpotifyConnection();
    })
    
  }
  if(localStorage.getItem('spotifyCode') == null && typeof QueryString['code'] == "undefined"){
    //request a token
    setTimeout(()=>{
      $('#loginToSpotify').addClass('showing');  
      $('#loginToSpotify #login').off('click').on('click',()=>{
        this.loginToSpotify();
      })
    },200)
    
  }

  if(localStorage.getItem('spotifyCode') != null){
    this.spotifyApi.setAccessToken(localStorage.getItem('spotifyCode'));
    this.pollSpotifyConnection();
  }
  
  this.spotifyApi
  .getUserPlaylists() // note that we don't pass a user id
  .then(
    function (data) {
      console.log('User playlists', data);
    },
    function (err) {
      console.error(err);
    }
  );

  $('#skipNav .button').off('click').on('click',(e)=>{
    let id = $(e.target).attr('id');
    clearInterval(this.vizInterval);
    if(id == 'next'){
      this.spotifyApi.skipToNext();
    }
    if(id == 'prev'){
      this.spotifyApi.skipToPrevious();
    }
    setTimeout(()=>{
      this.getCurrentTrackInfo();
    },500)
  })

  //this.spotifyApi.getAudioAnalysisForTrack()
  //get progress: this.spotifyApi.getMyCurrentPlayingTrack() .result.progress_ms
  //app.spotifyApi.pause()
  //app.spotifyApi.play()
  //app.spotifyApi.skipToPrevious()
  //app.spotifyApi.skipToNext()

  //this.spotifyApi.getAudioAnalysisForTrack("5U1TBqjMgBoWS833c8lPuc")

  this.tourIncVal = 0.01;
  this.isPlaylist = false;
  this.cancelCameraTrack = false;
  this.$el = $el;
  this.scene = new THREE.Scene();
  this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 10000 );
  this.clientID = '9c1d801461f8c38a5ccd153c281cf3f0'; //for soundcloud
  this.soundCloudStream = {},
  this.streamPlaylistIndex = 0;
  
  

  /*this.input = this.context.createGain();
  this.output = this.context.createGain();
  this.input.connect(this.effects[_this.activeEffect]);
  this.effects[_this.activeEffect].connect(this.output);
  this.output.connect(this.context.destination)*/
  this.useAllFrequencies = true;
  this.reverseFrequencies = false;
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
    _this.setUIMeta();
    
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
GrandFinale.prototype.getCurrentTrackInfo = function(){
  //this.spotifyApi.getAudioAnalysisForTrack()
  //get progress: this.spotifyApi.getMyCurrentPlayingTrack() .result.progress_ms
  this.spotifyApi.getMyCurrentPlayingTrack().then(data=>{
    console.log('current track',data);
    let timeNow = new Date().getTime();
    data.timestamp = timeNow;
    if(data.is_playing){
      if(typeof data.item != "undefined"){
        
        this.spotifyApi.getAudioAnalysisForTrack(data.item.id).then(trackAnalysis=>{
          console.log('analysis',trackAnalysis);
          
          this.updateUIMeta(data)
          this.startTrackPlayback(data,trackAnalysis);
        }).catch(err=>{

        })
      }
    }
    else{
      this.spotifyApi.play().then(()=>{
        if(typeof data.item != "undefined"){
          this.spotifyApi.getAudioAnalysisForTrack(data.item.id).then(trackAnalysis=>{
            console.log('analysis',trackAnalysis);
            this.updateUIMeta(data)
            this.startTrackPlayback(data,trackAnalysis);
          }).catch(err=>{
            
          })
        }
      }).catch(err=>{
        console.log('error playing track',JSON.parse(err.response));
        this.showErrorMessage(JSON.parse(err.response));
      })
    }
    
  }).catch(err=>{
    console.log('error fetching current track',err);
  })
}
GrandFinale.prototype.showErrorMessage = function(msg){

  $('#errorMessage #message').html(msg.error.message);
  $('#errorMessage #resolution').html('')
  if(msg.error.reason == "NO_ACTIVE_DEVICE"){
    $('#errorMessage #resolution').html('Open the Spotify App on any device and play a song, then click "connect" again.')
    clearInterval(this.vizInterval);
    this.cancelCameraTrack = true;
    $('.playPause').html('connect').addClass('isPaused');
  }
  $('#errorMessage').show();
  $('#errorMessage #close').off('click').on('click',()=>{
    $('#errorMessage').hide();
  })
}
GrandFinale.prototype.updateUIMeta = function(data){
  let trackLink = data.item.external_urls.spotify;
  let artistLink = data.item.album.external_urls.spotify
  let albumImage = data.item.album.images[0].url;
  var linkTrack = $('<a class="trackTitle" href="'+trackLink+'" target="_blank">'+data.item.name+'</a>')
  var linkArtist = $('<a class="trackArtist" href="'+artistLink+'" target="_blank">'+data.item.album.name+'</a>')
  $('.nowPlaying .trackImage').html('<img class="albumImage" src="'+albumImage+'" />')
  $('.nowPlaying .trackName').html(linkTrack);
  $('.nowPlaying .trackName').append(' | ');
  $('.nowPlaying .trackName').append(linkArtist);
  $('.nowPlaying .trackName').append('<div class="artistName">'+data.item.album.artists[0].name+'</div>')
}
GrandFinale.prototype.refreshSpotifyToken = function(){
  $.post('https://accounts.spotify.com/api/token',{
    grant_type:'refresh_token',
    refresh_token: localStorage.getItem('refreshToken'),
    client_id:this.spotifyClientID
  },(data)=>{
    let token = data.access_token;
    let refreshToken = data.refresh_token;
    let expires = new Date().getTime() + (data.expires_in * 1000);
    localStorage.setItem('spotifyCode',token);
    this.spotifyApi.setAccessToken(localStorage.getItem('spotifyCode'));
    localStorage.setItem('refreshToken',refreshToken);
    localStorage.setItem('tokenExpires',expires);
    setTimeout(()=>{
      console.log('to refresh token')
      this.refreshSpotifyToken();
    },(data.expires_in-10)*1000)
  })
}
GrandFinale.prototype.loginToSpotify = function(){
  //request a token
  let scopes = "user-modify-playback-state user-read-playback-position user-read-playback-state user-read-currently-playing user-read-recently-played";
  
  let url = 'https://accounts.spotify.com/authorize'
  this.getSpotifyChallenge(this.spotifyVerif).then(challenge=>{
    url += '?response_type=code' + '&client_id=' + this.spotifyClientID ;
    url += '&scope=' + encodeURIComponent(scopes) ;
    url += '&redirect_uri=' + encodeURIComponent(this.spotifyRedirectURI);
    url += '&code_challenge_method=S256'
    url += '&code_challenge='+ challenge;

    window.location.href = url;
  });

}
GrandFinale.prototype.pollSpotifyConnection = function(){

  this.spotifyApi.getMyCurrentPlayingTrack().then(data=>{
    //console.log('poll res',data,thpeo);
    if(data == ""){
      $('#loginToSpotify #instruction').show();
      $('#loginToSpotify #loginPage').hide();
      $('#loginToSpotify').addClass('showing').addClass('instructionShowing');
      //no active track, 
      this.trackCheckInterval = setInterval(()=>{
        this.spotifyApi.getMyCurrentPlayingTrack().then(data=>{
          console.log('polling')
          if(data != ""){
            clearInterval(this.trackCheckInterval);
            //$('.playPause.isPaused').trigger('click')
            $('.playPause').html('pause').removeClass('isPaused')
            setTimeout(()=>{this.startTour();},2000);
            $('#loginToSpotify').removeClass('showing')
            this.getCurrentTrackInfo();
          }
        });
      },500)
    }
    else{
      //$('.playPause.isPaused').trigger('click')
      $('.playPause').html('pause').removeClass('isPaused')
      setTimeout(()=>{this.startTour();},2000);
      $('#loginToSpotify').removeClass('showing')
      this.getCurrentTrackInfo();
    }
  })
}
GrandFinale.prototype.startTrackPlayback = function(playbackMeta,trackAnalysis){
  console.log('start track playback')
  let loudnessExtent = d3.extent(trackAnalysis.segments,d=>{
    return d.loudness_max;
  });
  let loudnessScale = d3.scaleLinear()
    .domain(loudnessExtent)
    .range([0.1,1.0])

  let timeNow = new Date().getTime();
  let durNow = ((timeNow - (playbackMeta.timestamp )) + playbackMeta.progress_ms)/1000 ;
  
  let binNow = trackAnalysis.segments.find((d,i)=>{
    d.index = i;
    return d.start >= durNow && durNow <= (d.start+d.duration);
  });
  console.log('binnow',binNow,durNow)
  let binData = [];
  binNow.pitches.map((pitch,i)=>{
    binData.push(pitch*1000*loudnessScale(binNow.loudness_max),binNow.timbre[i]);
    //return pitch * binNow.timbre[i] * loudnessScale(binNow.loudness_max);
  });
  let binIndex = binNow.index;
  this.freqDomain = binData;
  let binNext = typeof trackAnalysis.segments[binIndex+1] != "undefined" ? trackAnalysis.segments[binIndex+1] : binNow;
  let binNextData = [];
  binNext.pitches.map((pitch,i)=>{
    binNextData.push(pitch*1000*loudnessScale(binNext.loudness_max),binNext.timbre[i]);
    //return pitch * binNext.timbre[i] * loudnessScale(binNext.loudness_max);
  });
  this.uniforms.amplitude.value = NaN;//loudnessScale(binNow.loudness_max)*0.0;
  this.freqDomainNext = binNextData;
  this.freqDuration = binNow.duration;
  
  this.updateAnalyserData();
  this.uniforms.duration.value = this.freqDuration;
  this.uniforms.durationDelta.value = 0.0;
  const _this = this;
  let diff = 0;
  let timeStart = new Date().getTime();
  let timeout = setInterval(()=>{
    let tDiff = new Date().getTime() - timeStart;

    diff += tDiff;
    this.uniforms.durationDelta.value += diff/1000;
    if(diff > binNow.duration*1000){
      this.uniforms.durationDelta.value = 0;
      //console.log('diff',diff,binNow.duration*1000)
      diff = 0;
      timeStart = new Date().getTime();
      durNow = ((timeStart - playbackMeta.timestamp) + playbackMeta.progress_ms)/1000;
      this.updateProgressBar(durNow,trackAnalysis.track.duration);
      let drifted = trackAnalysis.segments.find((d,i)=>{
        d.index = i;
        return d.start >= durNow && durNow <= (d.start+d.duration);
      });
      //console.log('durations',trackAnalysis.track.duration , durNow);
      if(typeof drifted == "undefined" || trackAnalysis.track.duration < durNow){
        //might be new track..
        clearInterval(timeout);
        /*
        console.log('durnow = ',durNow);
        console.log('meta',playbackMeta);*/
        //setTimeout(()=>{
        if(durNow < trackAnalysis.track.duration){
          //console.log('track is done but time is less',trackAnalysis.track.duration , durNow,(trackAnalysis.track.duration - durNow)*1000 + 4000)
          setTimeout(()=>{
            this.getCurrentTrackInfo();
          },(trackAnalysis.track.duration - durNow)*1000 + 4000);
        }
        else{
          //console.log('track is done, time is more')
          this.getCurrentTrackInfo();
        }
          /*this.spotifyApi.skipToNext().then(()=>{
            this.getCurrentTrackInfo();
          })*/
          
        //},5000)
      }
      else{
        binIndex = drifted.index;
        doNextBin();
      }
      
    }
  },10)
  this.vizInterval = timeout;
  doNextBin();
  

  function doNextBin(){
    //console.log('nextbin',binNow.duration,binNow.duration*1000);
    //let callD = new Date().getTime();
    //binNow = trackAnalysis.segments[binNow.index+1]
    if(typeof trackAnalysis.segments[binIndex+1] != "undefined"){
      //setTimeout(()=>{
      //console.log('bin ticking');
      //let timeout = setExactTimeout(()=>{
      //console.log('complete');
      binIndex++;
      binNow = trackAnalysis.segments[binIndex];
      binData = binNow.pitches.map((pitch,i)=>{
        return pitch * binNow.timbre[i];
      });
      binNext = typeof trackAnalysis.segments[binIndex+1] != "undefined" ? trackAnalysis.segments[binIndex+1] : binNow;
      binNextData = binNext.pitches.map((pitch,i)=>{
        return pitch * binNext.timbre[i] * 100 * binNext.loudness_max;
      });
      _this.freqDomain = binData;
      _this.freqDomainNext = binNextData;
      _this.freqDuration = binNow.duration;
      _this.uniforms.duration.value = _this.freqDuration;
      _this.updateAnalyserData();
      
      //_this.uniforms.durationDelta.value = 0.0;
      let binComp = new Date().getTime();
      //console.log('timediff',binComp - callD);
      //clearExactTimeout(timeout);
      //doNextBin();
          //tick.stop();
        

      //},Math.floor(binNow.duration*1000),100);
      //console.log('did set');
      /*tick.start(binNow.duration*1000);
      this.tick = tick;*/
      //},binNow.duration*1000);
    }
    else{
      /*clearInterval(timeout);
      setTimeout(()=>{
        _this.getCurrentTrackInfo();
      },2000)*/
    }
  }
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

GrandFinale.prototype.setUIMeta = function(){
  //stub, where we display song meta info.
  var _this = this;
  
  $('.nowPlaying .playPause').off('click').on('click',function(){
    console.log("CLICK PLAY");
    $('#loginToSpotify').removeClass('showing')
    
    if($(this).hasClass('isPaused')){
      _this.getCurrentTrackInfo();
      $(this).html('pause').removeClass('isPaused')
      setTimeout(function(){_this.startTour();},2000);
    }
    else{
      _this.spotifyApi.pause();
      clearInterval(_this.vizInterval);
      _this.cancelCameraTrack = true;
      $(this).html('play').addClass('isPaused');
    }

  });
  $('.trackURL .go').off('click').on('click',function(){
    if($('.trackURL input').val() != ''){
      window.location.hash = '';
      window.location.href = '/#'+$('.trackURL input').val();
      window.location.reload();
    }
  });
  

}
GrandFinale.prototype.updateProgressBar = function(durationNow,trackDuration){
  var val = durationNow;
  var s = trackDuration;
  var perc = val / trackDuration;
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

  var duration = trackDuration;
  var dm = Math.floor(duration/60);
  if(dm < 10){
    dm = '0'+dm;
  }
  var ds = Math.floor(duration % 60);
  if(ds < 10){
    ds = '0'+ds;
  }
  $('.nowPlaying .duration').html(dm+':'+ds)
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
      //console.log('pointi is now',pointI,points.length)
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
    
    //ringColor: {value: new THREE.Vector3(0.996078431372549,0,0.820299884659746)},
    ringColor: {value: new THREE.Vector3(0.5490196078431373, 0.11841599384851982, 0.4730307347852635)},
    isRingLinear:{value:true},
    isRing:{value:true},
    isSpherical: {value:false},
    duration: {value:0.0},
    durationDelta: {value:0.0}
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
  this.pointGeometry.addAttribute( 'alphaNext', new THREE.BufferAttribute(alpha,1));
  this.pointGeometry.addAttribute( 'sphericalPosition',new THREE.BufferAttribute(sphericalPositions,3));
  this.pointGeometry.addAttribute( 'ringPosition',new THREE.BufferAttribute(ringPositions,3));
  this.pointGeometry.addAttribute( 'flatPosition',new THREE.BufferAttribute(flatPositions,3));
  this.pointGeometry.addAttribute( 'frequency',new THREE.BufferAttribute(frequencies,1));
  this.pointGeometry.addAttribute( 'frequencyNext',new THREE.BufferAttribute(frequencies,1));
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
  //_this.analyser.getByteFrequencyData(_this.freqDomain);
  if(typeof this.frequencyScale == "undefined"){
    this.frequencyScale = d3.scaleLinear();
    this.alphaScale = d3.scaleLinear();

    this.frequencyScaleNext = d3.scaleLinear();
    this.alphaScaleNext = d3.scaleLinear();
    
  }
  var filter = Array.prototype.filter;
  var allFreq = this.freqDomain;//.subarray()
  let allFreqNext = this.freqDomainNext;
  let frequenciesNext;
  if(_this.useAllFrequencies){
    var frequencies = this.freqDomain;
    frequenciesNext = this.freqDomainNext;
  }
  else{
    var frequencies  = /*this.freqDomain;*/ filter.call(this.freqDomain,function(x,i){
      return x > 0;
    });
    frequenciesNext = filter.call(this.freqDomainNext,function(x,i){
      return x > 0;
    });
  }

  if(_this.reverseFrequencies){
    frequencies = frequencies.slice(0).reverse();
    frequenciesNext = frequenciesNext.slice(0).reverse();
  }

  
  //var frequencies = this.freqDomain;
  var lineScaleMin = d3.min(frequencies);
  var lineScaleMax = d3.max(frequencies);

  var lineScaleMinNext = d3.min(frequenciesNext);
  var lineScaleMaxNext = d3.max(frequenciesNext);

  this.flatSVGYScale.domain([lineScaleMin,lineScaleMax]);
  this.frequencyScale
    .domain([lineScaleMin,lineScaleMax])
    .range([0.01,0.01]);

  this.frequencyScaleNext
    .domain([lineScaleMinNext,lineScaleMaxNext])
    .range([0.01,0.01]);

  var scaleMax = _this.useAllFrequencies ? 0.5 : 0.35;

  this.alphaScale
    .domain([lineScaleMin,lineScaleMax])
    .range([0.01,scaleMax])
    .clamp(true);

  this.alphaScaleNext
    .domain([lineScaleMinNext,lineScaleMaxNext])
    .range([0.01,scaleMax])
    .clamp(true);

  var len = this.pointGeometry.attributes.frequency.array.length;

  for(i=0;i<len;i++){
    var val = frequencies[/*Math.floor(Math.random()*frequencies.length)*/ Math.floor(i/1024/1024*frequencies.length)/*i % frequencies.length*/];
    var valNext = frequenciesNext[Math.floor(i/1024/1024*frequenciesNext.length)];

    //this.pointGeometry.attributes.frequency.array[i] = _this.frequencyScale(val);
    //this.pointGeometry.attributes.frequencyNext.array[i] = _this.frequencyScaleNext(valNext);

    if(this.uniforms.isRing.value){
      this.pointGeometry.attributes.alpha.array[i] = this.alphaScale(val);
      this.pointGeometry.attributes.alphaNext.array[i] = this.alphaScaleNext(valNext) * 1.5 ;
    }
    /*else{
      if(!this.uniforms.isSpherical.value){
        this.pointGeometry.attributes.alpha.array[i] = 0.25;
      }
    }*/
  }
  if(this.uniforms.isRing.value)
    _this.pointGeometry.attributes.alpha.needsUpdate = true;
    _this.pointGeometry.attributes.alphaNext.needsUpdate = true;
    //_this.pointGeometry.attributes.frequency.needsUpdate = true;
    //_this.pointGeometry.attributes.frequencyNext.needsUpdate = true;
  /*if(typeof _this.hasUpdatedFrequencies == "undefined"){
    _this.hasUpdatedFrequencies = true;
    _this.pointGeometry.attributes.alpha.needsUpdate = true;
    _this.pointGeometry.attributes.frequency.needsUpdate = true;
  }*/
  //if(!_this.player.paused){
    let stretchedDomain = [];
    this.freqDomain.map(v=>{
      for(let i=0;i<Math.floor(256/this.freqDomain.length);i++){
        stretchedDomain.push(v);
      }
    })
    _this.flatSVGXScale.domain([0,stretchedDomain.length]);
    var lines = this.flatSVG.select('g.lineGroup')
      .selectAll('line')
      .data(stretchedDomain/*this.freqDomain*/);
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
  //}
}
GrandFinale.prototype.animate = function(){
  var _this = this;
  /*if(typeof this.clock == "undefined"){
    this.clock = new THREE.Clock();
  }*/
  if(this.updateUniforms){
    if(this.uniforms.amplitude.value <= -0.47 || this.uniforms.amplitude.value >= 0.47){
      this.updateUniformsValue *= -1;
    }
    this.uniforms.amplitude.value += this.updateUniformsValue;

  }
  /*if(typeof this.uniforms != "undefined"){
    this.uniforms.durationDelta.value += this.clock.getDelta();
    //console.log('uniform delta',this.uniforms.durationDelta.value,this.uniforms.duration.value);
  }*/
  
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
    //ringColor:[0.996078431372549*255,0,0.820299884659746*255],
    ringColor:[0.5490196078431373*255, 0.11841599384851982*255, 0.4730307347852635*255],
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
    //$('.flatFrequency svg line.flatLine').css('stroke','rgba('+val[0]+','+val[1]+','+val[2]+',1.0 )')
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

GrandFinale.prototype.getSpotifyVerifier = function(){
  // GENERATING CODE VERIFIER
  function dec2hex(dec) {
    return ("0" + dec.toString(16)).substr(-2);
  }
  function generateCodeVerifier() {
    var array = new Uint32Array(56 / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec2hex).join("");
  }
  return generateCodeVerifier();
}
GrandFinale.prototype.getSpotifyChallenge = function(verifier){
  function sha256(plain) {
    // returns promise ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest("SHA-256", data);
  }

  function base64urlencode(a) {
    var str = "";
    var bytes = new Uint8Array(a);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
      str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  async function generateCodeChallengeFromVerifier(v) {
    var hashed = await sha256(v);
    var base64encoded = base64urlencode(hashed);
    return base64encoded;
  }

  return generateCodeChallengeFromVerifier(verifier);
  
}