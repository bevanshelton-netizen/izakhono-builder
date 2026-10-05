import {provisionDns} from './dns';

(async () => {

  const calls:unknown[]=[];
  const provider={publish:async(zone:string,records:unknown[])=>{calls.push({zone,records})},remove:async()=>{}};
  const result=await provisionDns(provider,'example.test',['ns1.example.test','ns2.example.test']);
  if(!result.published||result.verified) throw new Error('DNS provisioning contract failed');
  if(calls.length!==1) throw new Error('DNS provider was not called');
  console.log('IZAKHONO DNS tests passed');

} )();
