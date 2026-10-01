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

#[derive(serde::Deserialize)]
struct Poll { active:bool, session_id:Option<String>, events:Vec<Input> }

#[derive(serde::Serialize)]
#[serde(rename_all="camelCase")]
struct Frame<'a> { device_id:&'a str, session_id:&'a str, data:String }

fn main() -> Result<(),Box<dyn std::error::Error>> {
    let server=env::var("COMMANDER_SERVER")?.trim_end_matches('/').to_string();
    let device=env::var("COMMANDER_DEVICE_ID")?;
    let token=env::var("COMMANDER_AGENT_TOKEN")?;
    let interval=Duration::from_millis(
        env::var("COMMANDER_FRAME_MS").ok().and_then(|x|x.parse().ok()).unwrap_or(100)
    );
    let mut enigo=Enigo::new(&Settings::default())?;
    let monitors=Monitor::all()?;
    println!("IZAKHONO COMMANDER graphics agent {device}; displays={}",monitors.len());

    loop {
        let poll=ureq::post(&format!("{server}/api/agent/graphics/poll"))
            .header("Authorization",&format!("Bearer {token}"))
            .send_json(serde_json::json!({"deviceId":device}))?;

        let p:Poll=poll.into_body().read_json()?;

        if p.active {
            if let Some(session)=p.session_id.as_deref() {
                for event in p.events {
                    if let Err(e)=apply_input(&mut enigo,event) {
                        eprintln!("input error: {e}");
                    }
                }

                if let Some(monitor)=monitors.first() {
                    let img=monitor.capture_image()?;
                    let encoded=encode_frame(&img)?;
                    let frame=Frame{device_id:&device,session_id:session,data:encoded};

                    match ureq::post(&format!("{server}/api/agent/graphics/frame"))
                        .header("Authorization",&format!("Bearer {token}"))
                        .send_json(&frame) {
                        Ok(_) => {}
                        Err(e) => eprintln!("frame transport error: {e}"),
                    }
                }
            }
        }

        thread::sleep(interval);
    }
}

fn encode_frame(
    img:&ImageBuffer<Rgba<u8>,Vec<u8>>
)->Result<String,Box<dyn std::error::Error>> {
    let mut bytes=Vec::new();
    image::DynamicImage::ImageRgba8(img.clone()).write_to(
        &mut std::io::Cursor::new(&mut bytes),
        image::ImageFormat::Jpeg
    )?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        bytes
    ))
}

fn apply_input(
    enigo:&mut Enigo,
    event:Input
)->Result<(),Box<dyn std::error::Error>> {
    match event {
        Input::PointerMove{x,y} => {
            enigo.move_mouse(x as i32,y as i32,Coordinate::Abs)?;
        }
        Input::MouseButton{button,down} => {
            let b=match button.as_str() {
                "left"=>Button::Left,
                "right"=>Button::Right,
                "middle"=>Button::Middle,
                _=>return Ok(())
            };
            enigo.button(
                b,
                if down {Direction::Press} else {Direction::Release}
            )?;
        }
        Input::Wheel{delta_y,..} => {
            enigo.scroll(delta_y as i32,enigo::Axis::Vertical)?;
        }
        Input::Key{code,down} => {
            let key=match code.as_str() {
                "Enter"=>Key::Return,
                "Escape"=>Key::Escape,
                "Space"=>Key::Space,
                "Tab"=>Key::Tab,
                "Backspace"=>Key::Backspace,
                "ArrowUp"=>Key::UpArrow,
                "ArrowDown"=>Key::DownArrow,
                "ArrowLeft"=>Key::LeftArrow,
                "ArrowRight"=>Key::RightArrow,
                _=>return Ok(())
            };
            enigo.key(key,if down {Direction::Press} else {Direction::Release})?;
        }
    }
    Ok(())
}