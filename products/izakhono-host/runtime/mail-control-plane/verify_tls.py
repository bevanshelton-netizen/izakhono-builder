import smtplib
import socket
import ssl

HOST = "mail.izakhonoafrica.co.za"
TIMEOUT = 10
context = ssl.create_default_context()
context.minimum_version = ssl.TLSVersion.TLSv1_2

for port in (465, 993):
    with socket.create_connection((HOST, port), timeout=TIMEOUT) as raw:
        with context.wrap_socket(raw, server_hostname=HOST) as tls:
            if not tls.getpeercert():
                raise SystemExit(f"No trusted TLS certificate presented on {HOST}:{port}")
            print(f"TLS OK: {HOST}:{port} {tls.version()}")

with smtplib.SMTP(HOST, 25, timeout=TIMEOUT) as smtp:
    smtp.ehlo()
    if not smtp.has_extn("starttls"):
        raise SystemExit(f"SMTP STARTTLS is not offered on {HOST}:25")
    smtp.starttls(context=context)
    smtp.ehlo()
    print(f"SMTP STARTTLS OK: {HOST}:25 {smtp.sock.version()}")

print("IZAKHONO Stalwart TLS acceptance passed.")
