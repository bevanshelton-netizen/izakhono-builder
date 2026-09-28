import net from 'node:net';
const port=2525;
const server=net.createServer(socket=>{
  socket.setEncoding('utf8');
  socket.write('220 smtp-stub ESMTP\r\n');
  let dataMode=false,buf='';
  socket.on('data',chunk=>{
    buf+=chunk;
    while(true){
      const idx=buf.indexOf('\r\n');
      if(idx<0)break;
      const line=buf.slice(0,idx);buf=buf.slice(idx+2);
      if(dataMode){
        if(line==='.'){dataMode=false;socket.write('250 2.0.0 accepted stub-message\r\n');}
        continue;
      }
      if(/^EHLO /i.test(line))socket.write('250-smtp-stub\r\n250 AUTH PLAIN\r\n');
      else if(/^AUTH PLAIN /i.test(line))socket.write('235 2.7.0 authenticated\r\n');
      else if(/^MAIL FROM:/i.test(line))socket.write('250 2.1.0 ok\r\n');
      else if(/^RCPT TO:/i.test(line))socket.write('250 2.1.5 ok\r\n');
      else if(line==='DATA'){dataMode=true;socket.write('354 end with .\r\n');}
      else if(line==='QUIT'){socket.write('221 2.0.0 bye\r\n');socket.end();}
      else socket.write('250 ok\r\n');
    }
  });
});
server.listen(port,'0.0.0.0',()=>console.log('smtp-stub ready'));
