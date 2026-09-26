import http from 'node:http';

function encode(points, precision=6){
  const factor=10**precision; let prevLat=0,prevLng=0,out='';
  const enc=n=>{n=n<0?~(n<<1):(n<<1);let s='';while(n>=0x20){s+=String.fromCharCode((0x20|(n&0x1f))+63);n>>=5;}return s+String.fromCharCode(n+63);};
  for(const [lng,lat] of points){const ilat=Math.round(lat*factor),ilng=Math.round(lng*factor);out+=enc(ilat-prevLat)+enc(ilng-prevLng);prevLat=ilat;prevLng=ilng;}return out;
}
const coords=[[28.0473,-26.2041],[28.0480,-26.2000],[28.0478,-26.1950]];
const shape=encode(coords);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zf1sAAAAASUVORK5CYII=','base64');

const router=http.createServer((req,res)=>{
  if(req.url==='/status'){res.writeHead(200,{'content-type':'application/json'});return res.end('{"version":"mock"}');}
  if(req.url==='/route'&&req.method==='POST'){
    let body='';req.on('data',d=>body+=d);req.on('end',()=>{
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({trip:{summary:{length:1.2,time:180},legs:[{shape,summary:{length:1.2,time:180},maneuvers:[
        {type:1,instruction:'Start north',length:0.4,time:60,begin_shape_index:0,end_shape_index:1,street_names:['Main Road']},
        {type:10,instruction:'Continue straight',length:0.6,time:90,begin_shape_index:1,end_shape_index:2,street_names:['Main Road']},
        {type:4,instruction:'You have arrived',length:0.2,time:30,begin_shape_index:2,end_shape_index:2}
      ]}]}}));
    });return;
  }
  res.writeHead(404);res.end();
});
const search=http.createServer((req,res)=>{
  if(req.url?.startsWith('/status')){res.writeHead(200,{'content-type':'application/json'});return res.end('{"status":0,"message":"OK"}');}
  if(req.url?.startsWith('/search')){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify([{place_id:1,display_name:'Johannesburg, Gauteng, South Africa',lat:'-26.2041',lon:'28.0473',type:'city'}]));}
  res.writeHead(404);res.end();
});
const tiles=http.createServer((req,res)=>{
  if(req.url==='/catalog'){res.writeHead(200,{'content-type':'application/json'});return res.end('{"tiles":{"south-africa":{}}}');}
  if(req.url?.startsWith('/style/izakhono/')){res.writeHead(200,{'content-type':'image/png'});return res.end(png);}
  res.writeHead(404);res.end();
});
router.listen(18882,'127.0.0.1');
search.listen(18883,'127.0.0.1');
tiles.listen(18884,'127.0.0.1');
for(const sig of ['SIGINT','SIGTERM']) process.on(sig,()=>{router.close();search.close();tiles.close(()=>process.exit(0));});
