export type GraphicsSession = {
  id:string;
  deviceId:string;
  operatorId:string;
  state:'requested'|'active'|'closed'|'revoked';
  createdAt:string;
  expiresAt:string;
};

export type DisplayInfo = {
  id:string;
  name:string;
  width:number;
  height:number;
  scale:number;
};

export type InputEvent =
  | {type:'pointer_move';x:number;y:number}
  | {type:'mouse_button';button:'left'|'middle'|'right';down:boolean}
  | {type:'wheel';deltaX:number;deltaY:number}
  | {type:'key';code:string;down:boolean};

export type SignalMessage =
  | {type:'offer';sdp:string}
  | {type:'answer';sdp:string}
  | {type:'ice';candidate:string}
  | {type:'input';event:InputEvent}
  | {type:'display_select';displayId:string}
  | {type:'close'};
