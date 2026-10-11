const channels = Object.freeze(['in_app','email','sms','push','webhook']);

export function createNotification({type='info', title='', body='', service='one', priority='normal', channels: requested=['in_app']}={}) {
  const selected = requested.filter(channel => channels.includes(channel));
  return {id:crypto.randomUUID(), type, title, body, service, priority, channels:selected.length ? selected : ['in_app'], createdAt:new Date().toISOString(), delivered:false};
}

export function supportedNotificationChannels(){ return [...channels]; }
