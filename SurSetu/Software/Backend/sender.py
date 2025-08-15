import serial
import threading
import tkinter as tk

# Change COM port for your device
ser = serial.Serial('COM4', 115200, timeout=1)

def send_message():
    msg = entry.get()
    if msg.strip():
        ser.write((msg + "\n").encode())
        log.insert(tk.END, "You: " + msg + "\n")
        entry.delete(0, tk.END)

def read_serial():
    while True:
        try:
            data = ser.readline().decode(errors='ignore').strip()
            if data:
                log.insert(tk.END, data + "\n")
                log.see(tk.END)
        except:
            pass

root = tk.Tk()
root.title("LoRa Chat")

log = tk.Text(root, height=20, width=60)
log.pack()

entry = tk.Entry(root, width=50)
entry.pack(side=tk.LEFT, padx=5)

send_btn = tk.Button(root, text="Send", command=send_message)
send_btn.pack(side=tk.LEFT)

threading.Thread(target=read_serial, daemon=True).start()

root.mainloop()
