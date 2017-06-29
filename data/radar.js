var fs = require('fs');
var data = 'SBDR_01_D275_V02.TAB';
var index = 'SBDR.FMT';
function parseData(){
  fs.readFile(data,'utf8',function(err,d){
    //console.log('err',err,d);
    var ii = 0;
    console.log('dlen',d.length);
    d.split('\r').map(function(dd,i){
      if(dd.indexOf('END') > 0){
        console.log('line',dd,dd.length);
        ii = i;
      }
    });
    var dAfter = d.split('\r').slice(ii).join('\r');
    console.log('dafter len',dAfter.length,6613*1272,1272)
    var halved = d.split('END\r');
    var buf = new Buffer(dAfter)
    console.log('parsed buf',buf.readUIntBE(5,9).toString(16));
    //console.log('firsthalf',halved[0]);
    //console.log('2half length ',6613*1272,1272/*,halved[1].split('\r')*/)
    /*halved[1].split('\r').slice(1,halved[1].length-1)
      .map(function(d){
        console.log('d len',d.length);
        return d.length;
      })*/
  });
}

parseData(data);