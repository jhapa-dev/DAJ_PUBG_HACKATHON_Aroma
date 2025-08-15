import tkinter as tk
from tkinter import scrolledtext
import serial
import threading
import time

# --------------------
# Serial Setup
# --------------------
PORT = "COM11"  # Change to your LoRa serial port
BAUD = 115200

try:
    ser = serial.Serial(PORT, BAUD, timeout=1)
except serial.SerialException as e:
    print(f"Error: {e}")
    ser = None

last_sent_message = None

# --------------------
# Send Function
# --------------------
def send_message(event=None):
    global last_sent_message
    message = entry.get().strip()
    if message and ser:
        timestamp = time.strftime("%I:%M %p")
        chat_area.config(state=tk.NORMAL)
        chat_area.insert(tk.END, f"{message}   [{timestamp}]\n", "sent")
        chat_area.config(state=tk.DISABLED)
        chat_area.yview(tk.END)
        
        ser.write(message.encode())
        last_sent_message = message
        entry.delete(0, tk.END)

# --------------------
# Receive Function
# --------------------
def read_from_port():
    global last_sent_message
    while ser:
        try:
            if ser.in_waiting > 0:
                incoming = ser.readline().decode(errors='ignore').strip()

                # Remove "Received:" prefix if present
                if incoming.startswith("Received:"):
                    incoming = incoming.split("MSG;", 1)[-1].strip()

                # Ignore if it's our own last sent message
                if incoming and incoming != last_sent_message:
                    timestamp = time.strftime("%I:%M %p")
                    chat_area.config(state=tk.NORMAL)
                    chat_area.insert(tk.END, f"{incoming}   [{timestamp}]\n", "received")
                    chat_area.config(state=tk.DISABLED)
                    chat_area.yview(tk.END)
        except Exception as e:
            print(f"Read error: {e}")
            break

# --------------------
# UI Setup
# --------------------
root = tk.Tk()
root.title("LoRa Chat")
root.geometry("900x500")
root.configure(bg="#e6dfd8")

chat_area = scrolledtext.ScrolledText(
    root,
    wrap=tk.WORD,
    state=tk.DISABLED,
    font=("Arial", 10),  # smaller font
    padx=8,  # inside padding
    pady=5
)

# Sent messages (right aligned, light green background, padding & spacing)
chat_area.tag_config(
    "sent",
    foreground="black",
    background="#d4f8d4",
    justify="right",
    spacing1=5,
    spacing3=5,
    lmargin1=50,
    rmargin=10
)

# Received messages (left aligned, white background, padding & spacing)
chat_area.tag_config(
    "received",
    foreground="black",
    background="white",
    justify="left",
    spacing1=5,
    spacing3=5,
    lmargin1=10,
    rmargin=50
)

chat_area.pack(padx=10, pady=10, fill=tk.BOTH, expand=True)

bottom_frame = tk.Frame(root, bg="#e6dfd8")
bottom_frame.pack(fill=tk.X, side=tk.BOTTOM)

entry = tk.Entry(bottom_frame, font=("Arial", 10))
entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0), pady=5)
entry.bind("<Return>", send_message)

send_btn = tk.Button(bottom_frame, text="Send", bg="green", fg="white", command=send_message)
send_btn.pack(side=tk.LEFT, padx=5, pady=5)

clear_btn = tk.Button(
    bottom_frame,
    text="Clear",
    bg="red",
    fg="white",
    command=lambda: chat_area.config(state=tk.NORMAL) or chat_area.delete(1.0, tk.END) or chat_area.config(state=tk.DISABLED)
)
clear_btn.pack(side=tk.LEFT, padx=5, pady=5)

# --------------------
# Start Serial Thread
# --------------------
if ser:
    threading.Thread(target=read_from_port, daemon=True).start()

root.mainloop()
