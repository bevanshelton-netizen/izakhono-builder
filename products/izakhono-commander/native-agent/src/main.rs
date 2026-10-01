use enigo::{Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use image::{ImageBuffer, Rgba};
use std::{env, thread, time::Duration};
use xcap::Monitor;

#[derive(serde::Deserialize)]
#[serde(tag="type")]
enum Input {
    #[serde(rename="pointer_move")] PointerMove{x:f64,y:f64},
    #[serde(rename="mouse_button")] MouseButton{button:String,down:bool},
    #[serde(rename="wheel")] Wheel{delta_x:f64,delta_y:f64},
    #[serde(rename="key")] Key{code:String,down:bool},
}

fn main() -> Result<(),Box<dyn std::error::Error>> {
    let server=env::var("COMMANDER_SERVER")?;
    let device=env::var("COMMANDER_DEVICE_ID")?;
    let token=env::var("COMMANDER_AGENT_TOKEN")?;
    let interval=Duration::from_millis(env::var("COMMANDER_FRAME_MS").ok().and_then(|x|x.parse().ok()).unwrap_or(100));
    println!("IZAKHONO COMMANDER native graphics agent: {device}");
    println!("Server: {server}");
    println!("Graphical capture/input is initialized locally.");
    let monitors=Monitor::all()?;
    println!("Displays detected: {}",monitors.len());
    let mut enigo=Enigo::new(&Settings::default())?;
    loop {
        if let Some(m)=monitors.first() {
            let img=m.capture_image()?;
            let _encoded=encode_frame(&img)?;
            // The transport layer sends _encoded through the authenticated WebRTC/data channel.
            // Keep capture local until a live graphics session is authorized.
        }
        // A real session transport must feed only authenticated Input events here.
        let _ = (&server,&device,&token,&mut enigo);
        thread::sleep(interval);
    }
}
fn encode_frame(img:&ImageBuffer<Rgba<u8>,Vec<u8>>)->Result<String,Box<dyn std::error::Error>>{
    let mut bytes=Vec::new();
    image::DynamicImage::ImageRgba8(img.clone()).write_to(
        &mut std::io::Cursor::new(&mut bytes),image::ImageFormat::Jpeg)?;
    Ok(base64::Engine::encode(&base64::engine::general_purpose::STANDARD,bytes))
}
fn apply_input(enigo:&mut Enigo,event:Input)->Result<(),Box<dyn std::error::Error>>{
    match event {
        Input::PointerMove{x,y}=>{enigo.move_mouse(x as i32,y as i32,Coordinate::Abs)?;},
        Input::MouseButton{button,down}=>{
            let b=match button.as_str(){"left"=>Button::Left,"right"=>Button::Right,"middle"=>Button::Middle,_=>return Ok(())};
            enigo.button(b,if down{Direction::Press}else{Direction::Release})?;
        },
        Input::Wheel{delta_y,..}=>{enigo.scroll(delta_y as i32,enigo::Axis::Vertical)?;},
        Input::Key{code,down}=>{let k=match code.as_str(){"Enter"=>Key::Return,"Escape"=>Key::Escape,"Space"=>Key::Space,_=>return Ok(())};enigo.key(k,if down{Direction::Press}else{Direction::Release})?;}
    }
    Ok(())
}
