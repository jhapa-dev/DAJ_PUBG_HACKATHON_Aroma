import serial
import tkinter as tk
import threading

# Change COM port and baud rate
ser = serial.Serial('COM15', 115200, timeout=1)

def send_message():
    msg = entry.get()
    if msg.strip():
        ser.write((msg + "\n").encode())  # Send to ESP32
        log.insert(tk.END, "You: " + msg + "\n")
        log.see(tk.END)
        entry.delete(0, tk.END)

def read_serial():
    while True:
        try:
            data = ser.readline().decode(errors='ignore').strip()
            if not data:
                continue

            # Ignore ESP32 debug prints
            if data.startswith("Sending custom message:") or data.startswith("State ->") or data.startswith("ESP32"):
                continue

            # Show as coming from User1
            log.insert(tk.END, "User1: " + data + "\n")
            log.see(tk.END)

        except:
            pass

# ---- Tkinter GUI ----
root = tk.Tk()
root.title("LoRa Two-Way Messenger")

log = tk.Text(root, height=30, width=120)
log.pack()

entry = tk.Entry(root, width=80)
entry.pack(side=tk.LEFT, padx=5)

send_btn = tk.Button(root, text="Send", command=send_message)
send_btn.pack(side=tk.LEFT)

# Start background thread for receiving messages
threading.Thread(target=read_serial, daemon=True).start()

root.mainloop()
