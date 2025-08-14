import serial
import tkinter as tk

# Change COM port and baud rate
ser = serial.Serial('COM15', 115200)

def send_message():
    msg = entry.get()
    if msg.strip():
        ser.write((msg + "\n").encode())
        log.insert(tk.END, "You: " + msg + "\n")
        entry.delete(0, tk.END)

root = tk.Tk()
root.title("LoRa Message Sender")

log = tk.Text(root, height=15, width=50)
log.pack()

entry = tk.Entry(root, width=40)
entry.pack(side=tk.LEFT, padx=5)

send_btn = tk.Button(root, text="Send", command=send_message)
send_btn.pack(side=tk.LEFT)

root.mainloop()
